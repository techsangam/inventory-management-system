const express = require("express");
const Product = require("../models/Product");
const StockTransaction = require("../models/StockTransaction");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { createAuditLog } = require("../services/audit.service");
const { createMovement, transferStock } = require("../services/stock.service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/transactions",
  asyncHandler(async (_req, res) => {
    const transactions = await StockTransaction.find()
      .populate("product", "name sku")
      .populate("location", "name")
      .populate("performedBy", "name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(transactions);
  })
);

router.post(
  "/stock-in",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const result = await createMovement({
      productId: req.body.productId,
      locationId: req.body.locationId,
      quantity: req.body.quantity,
      type: "in",
      reason: req.body.reason || "Manual stock in",
      referenceType: "Manual",
      batchNo: req.body.batchNo,
      expiryDate: req.body.expiryDate,
      userId: req.user._id
    });
    await createAuditLog({
      req,
      action: "STOCK_IN",
      entityType: "StockTransaction",
      entityId: result.transaction._id
    });
    res.json(result);
  })
);

router.post(
  "/stock-out",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const result = await createMovement({
      productId: req.body.productId,
      locationId: req.body.locationId,
      quantity: req.body.quantity,
      type: "out",
      reason: req.body.reason || "Manual stock out",
      referenceType: "Manual",
      batchNo: req.body.batchNo,
      userId: req.user._id
    });
    await createAuditLog({
      req,
      action: "STOCK_OUT",
      entityType: "StockTransaction",
      entityId: result.transaction._id
    });
    res.json(result);
  })
);

router.post(
  "/adjustment",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.body.productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const currentQty = product.quantity;
    const targetQty = Number(req.body.targetQuantity);

    if (targetQty > currentQty) {
      const result = await createMovement({
        productId: product._id,
        locationId: req.body.locationId,
        quantity: targetQty - currentQty,
        type: "adjustment",
        reason: req.body.reason || "Stock adjustment increase",
        referenceType: "Adjustment",
        userId: req.user._id
      });
      await createAuditLog({
        req,
        action: "ADJUST_STOCK",
        entityType: "StockTransaction",
        entityId: result.transaction._id
      });
      return res.json(result);
    }

    const result = await createMovement({
      productId: product._id,
      locationId: req.body.locationId,
      quantity: currentQty - targetQty,
      type: "out",
      reason: req.body.reason || "Stock adjustment decrease",
      referenceType: "Adjustment",
      userId: req.user._id
    });
    await createAuditLog({
      req,
      action: "ADJUST_STOCK",
      entityType: "StockTransaction",
      entityId: result.transaction._id
    });
    return res.json(result);
  })
);

router.post(
  "/transfer",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const result = await transferStock({
      productId: req.body.productId,
      sourceLocationId: req.body.sourceLocationId,
      targetLocationId: req.body.targetLocationId,
      quantity: req.body.quantity,
      reason: req.body.reason || "Manual transfer",
      referenceType: "Transfer",
      userId: req.user._id
    });
    await createAuditLog({
      req,
      action: "TRANSFER_STOCK",
      entityType: "Product",
      entityId: req.body.productId,
      metadata: {
        sourceLocationId: req.body.sourceLocationId,
        targetLocationId: req.body.targetLocationId,
        quantity: req.body.quantity
      }
    });
    res.json(result);
  })
);

module.exports = router;
