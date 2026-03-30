const express = require("express");
const User = require("../models/User");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { createAuditLog } = require("../services/audit.service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  authorize("Admin", "Manager"),
  asyncHandler(async (_req, res) => {
    const users = await User.find().select("-password").sort({ name: 1 });
    res.json(users);
  })
);

router.post(
  "/",
  authorize("Admin"),
  asyncHandler(async (req, res) => {
    const user = await User.create(req.body);
    await createAuditLog({
      req,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user._id,
      metadata: { role: user.role }
    });
    res.status(201).json({ ...user.toObject(), password: undefined });
  })
);

router.put(
  "/:id",
  authorize("Admin"),
  asyncHandler(async (req, res) => {
    const updates = { ...req.body };
    if (!updates.password) {
      delete updates.password;
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    Object.assign(user, updates);
    await user.save();
    await createAuditLog({
      req,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: user._id
    });
    res.json({ ...user.toObject(), password: undefined });
  })
);

router.patch(
  "/:id/toggle",
  authorize("Admin"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.isActive = !user.isActive;
    await user.save();
    await createAuditLog({
      req,
      action: "TOGGLE_USER",
      entityType: "User",
      entityId: user._id,
      metadata: { isActive: user.isActive }
    });
    res.json({ ...user.toObject(), password: undefined });
  })
);

module.exports = router;
