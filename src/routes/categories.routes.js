const express = require("express");
const Category = require("../models/Category");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { createAuditLog } = require("../services/audit.service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await Category.find().sort({ name: 1 }));
  })
);

router.post(
  "/",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const category = await Category.create(req.body);
    await createAuditLog({
      req,
      action: "CREATE_CATEGORY",
      entityType: "Category",
      entityId: category._id
    });
    res.status(201).json(category);
  })
);

router.put(
  "/:id",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    await createAuditLog({
      req,
      action: "UPDATE_CATEGORY",
      entityType: "Category",
      entityId: category._id
    });
    res.json(category);
  })
);

router.delete(
  "/:id",
  authorize("Admin"),
  asyncHandler(async (req, res) => {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    await createAuditLog({
      req,
      action: "DELETE_CATEGORY",
      entityType: "Category",
      entityId: category._id
    });
    res.json({ message: "Category deleted" });
  })
);

module.exports = router;
