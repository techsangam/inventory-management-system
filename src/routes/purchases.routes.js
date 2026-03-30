const express = require("express");
const GoodsReceipt = require("../models/GoodsReceipt");
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const Supplier = require("../models/Supplier");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { generateNumber } = require("../utils/generateNumber");
const { createAuditLog } = require("../services/audit.service");
const { createMovement } = require("../services/stock.service");
const { emitAppEvent } = require("../services/eventBus");

const router = express.Router();

function calculateTotals(items, taxRate = 0) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.orderedQty || item.receivedQty || 0) * Number(item.costPrice || 0),
    0
  );
  const tax = Number(((subtotal * Number(taxRate || 0)) / 100).toFixed(2));
  return { subtotal, tax, total: subtotal + tax };
}

router.use(requireAuth);

router.get(
  "/grn",
  asyncHandler(async (_req, res) => {
    const receipts = await GoodsReceipt.find()
      .populate("supplier", "name")
      .populate("purchaseOrder", "poNumber")
      .sort({ createdAt: -1 });
    res.json(receipts);
  })
);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const orders = await PurchaseOrder.find()
      .populate("supplier", "name")
      .populate("createdBy", "name role")
      .populate("approvedBy", "name")
      .populate("items.location", "name")
      .sort({ createdAt: -1 });
    res.json(orders);
  })
);

router.post(
  "/",
  authorize("Admin", "Manager", "Staff"),
  asyncHandler(async (req, res) => {
    const items = (req.body.items || []).map((item) => ({
      ...item,
      orderedQty: Number(item.orderedQty || 0),
      costPrice: Number(item.costPrice || 0)
    }));
    const totals = calculateTotals(items, req.body.taxRate || 0);
    const order = await PurchaseOrder.create({
      poNumber: generateNumber("PO"),
      supplier: req.body.supplier,
      expectedDate: req.body.expectedDate,
      status: req.user.role === "Staff" ? "pending_approval" : req.body.status || "draft",
      items,
      ...totals,
      notes: req.body.notes || "",
      createdBy: req.user._id
    });

    await createAuditLog({
      req,
      action: "CREATE_PO",
      entityType: "PurchaseOrder",
      entityId: order._id,
      metadata: { poNumber: order.poNumber }
    });

    emitAppEvent("purchase.created", { purchaseOrderId: order._id });
    res.status(201).json(order);
  })
);

router.patch(
  "/:id/approve",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    order.status = "approved";
    order.approvedBy = req.user._id;
    await order.save();

    await createAuditLog({
      req,
      action: "APPROVE_PO",
      entityType: "PurchaseOrder",
      entityId: order._id
    });

    res.json(order);
  })
);

router.patch(
  "/:id/receive",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    const receiptItems = [];
    for (const item of req.body.items || []) {
      const poItem = order.items.find(
        (candidate) =>
          String(candidate.product || "") === String(item.product || "") &&
          String(candidate.location || "") === String(item.location || candidate.location || "")
      );

      if (!poItem) {
        continue;
      }

      const qty = Number(item.receivedQty || 0);
      if (!qty) {
        continue;
      }

      let product = poItem.product ? await Product.findById(poItem.product) : null;
      if (!product) {
        product = await Product.create({
          name: poItem.itemName,
          sku: poItem.sku,
          purchasePrice: poItem.costPrice,
          sellingPrice: Number(poItem.costPrice || 0) * 1.2
        });
      }

      poItem.receivedQty += qty;
      await createMovement({
        productId: product._id,
        locationId: item.location || poItem.location,
        quantity: qty,
        type: "in",
        reason: "GRN Receipt",
        referenceType: "PurchaseOrder",
        referenceId: order._id,
        batchNo: item.batchNo || poItem.batchNo,
        expiryDate: item.expiryDate || poItem.expiryDate,
        userId: req.user._id
      });

      receiptItems.push({
        product: product._id,
        receivedQty: qty,
        costPrice: poItem.costPrice,
        batchNo: item.batchNo || poItem.batchNo,
        expiryDate: item.expiryDate || poItem.expiryDate,
        location: item.location || poItem.location
      });
    }

    order.status = order.items.every((item) => item.receivedQty >= item.orderedQty)
      ? "completed"
      : "partial";
    await order.save();

    const grn = await GoodsReceipt.create({
      grnNumber: generateNumber("GRN"),
      purchaseOrder: order._id,
      supplier: order.supplier,
      items: receiptItems,
      receivedBy: req.user._id,
      notes: req.body.notes || ""
    });

    const supplier = await Supplier.findById(order.supplier);
    if (supplier) {
      supplier.outstandingBalance += Number(order.total || 0);
      await supplier.save();
    }

    await createAuditLog({
      req,
      action: "RECEIVE_PO",
      entityType: "GoodsReceipt",
      entityId: grn._id,
      metadata: { purchaseOrderId: order._id, lines: receiptItems.length }
    });

    emitAppEvent("purchase.received", {
      purchaseOrderId: order._id,
      grnId: grn._id
    });
    res.json({ order, grn });
  })
);

module.exports = router;
