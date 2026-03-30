const express = require("express");
const Supplier = require("../models/Supplier");
const PurchaseOrder = require("../models/PurchaseOrder");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { createAuditLog } = require("../services/audit.service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json(suppliers);
  })
);

router.post(
  "/",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.create(req.body);
    await createAuditLog({
      req,
      action: "CREATE_SUPPLIER",
      entityType: "Supplier",
      entityId: supplier._id
    });
    res.status(201).json(supplier);
  })
);

router.put(
  "/:id",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    await createAuditLog({
      req,
      action: "UPDATE_SUPPLIER",
      entityType: "Supplier",
      entityId: supplier._id
    });
    res.json(supplier);
  })
);

router.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const history = await PurchaseOrder.find({ supplier: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(history);
  })
);

router.delete(
  "/:id",
  authorize("Admin"),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    await createAuditLog({
      req,
      action: "DELETE_SUPPLIER",
      entityType: "Supplier",
      entityId: supplier._id
    });
    res.json({ message: "Supplier deleted" });
  })
);

module.exports = router;
