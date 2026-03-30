const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const bwipjs = require("bwip-js");
const Product = require("../models/Product");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { buildExcelBuffer } = require("../services/export.service");
const { createAuditLog } = require("../services/audit.service");
const { refreshProductAlerts } = require("../services/stock.service");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

router.get(
  "/export/excel",
  authorize("Admin", "Manager"),
  asyncHandler(async (_req, res) => {
    const products = await Product.find()
      .populate("category", "name")
      .populate("supplier", "name")
      .lean();

    const buffer = await buildExcelBuffer({
      sheetName: "Products",
      columns: [
        { header: "Item Name", key: "name" },
        { header: "SKU", key: "sku" },
        { header: "Barcode", key: "barcode" },
        { header: "Category", key: "category" },
        { header: "Supplier", key: "supplier" },
        { header: "Batch No", key: "batchNo" },
        { header: "Expiry Date", key: "expiryDate" },
        { header: "Purchase Price", key: "purchasePrice" },
        { header: "Selling Price", key: "sellingPrice" },
        { header: "Quantity", key: "quantity" },
        { header: "Unit", key: "unit" }
      ],
      rows: products.map((product) => ({
        ...product,
        category: product.category?.name || "",
        supplier: product.supplier?.name || "",
        expiryDate: product.expiryDate
          ? new Date(product.expiryDate).toISOString().slice(0, 10)
          : ""
      }))
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="products.xlsx"');
    res.send(Buffer.from(buffer));
  })
);

router.post(
  "/import",
  authorize("Admin", "Manager"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Excel file is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    const imported = [];

    for (const row of rows) {
      const sku = String(row.SKU || row.sku || "").toUpperCase();
      if (!sku) {
        continue;
      }

      const product = await Product.findOneAndUpdate(
        { sku },
        {
          name: row["Item Name"] || row.name,
          sku,
          barcode: row.Barcode || row.barcode,
          batchNo: row["Batch No"] || row.batchNo || "",
          purchasePrice: Number(row["Purchase Price"] || row.purchasePrice || 0),
          sellingPrice: Number(row["Selling Price"] || row.sellingPrice || 0),
          quantity: Number(row.Quantity || row.quantity || 0),
          unit: row.Unit || row.unit || "pcs",
          reorderLevel: Number(row["Reorder Level"] || row.reorderLevel || 10),
          overstockLevel: Number(row["Overstock Level"] || row.overstockLevel || 500)
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
      await refreshProductAlerts(product);
      imported.push(product);
    }

    await createAuditLog({
      req,
      action: "IMPORT_PRODUCTS",
      entityType: "Product",
      metadata: { count: imported.length }
    });

    res.json({ count: imported.length, products: imported });
  })
);

router.get(
  "/barcode/:code",
  asyncHandler(async (req, res) => {
    const product = await Product.findOne({ barcode: req.params.code })
      .populate("category", "name")
      .populate("supplier", "name")
      .populate("locationStocks.location", "name type");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  })
);

router.get(
  "/:id/barcode-image",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: product.barcode || product.sku,
      scale: 3,
      height: 10,
      includetext: true
    });

    res.setHeader("Content-Type", "image/png");
    res.send(png);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = req.query.search || "";
    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { sku: { $regex: search, $options: "i" } },
            { barcode: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("supplier", "name")
      .populate("locationStocks.location", "name type")
      .sort({ createdAt: -1 });
    res.json(products);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("supplier", "name")
      .populate("locationStocks.location", "name type");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  })
);

router.post(
  "/",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const product = await Product.create(req.body);
    await refreshProductAlerts(product);
    await createAuditLog({
      req,
      action: "CREATE_PRODUCT",
      entityType: "Product",
      entityId: product._id
    });
    res.status(201).json(product);
  })
);

router.put(
  "/:id",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    Object.assign(product, req.body);
    await product.save();
    await refreshProductAlerts(product);
    await createAuditLog({
      req,
      action: "UPDATE_PRODUCT",
      entityType: "Product",
      entityId: product._id
    });
    res.json(product);
  })
);

router.delete(
  "/:id",
  authorize("Admin"),
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    await createAuditLog({
      req,
      action: "DELETE_PRODUCT",
      entityType: "Product",
      entityId: product._id
    });
    res.json({ message: "Product deleted" });
  })
);

module.exports = router;
