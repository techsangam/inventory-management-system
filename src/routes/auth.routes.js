const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth, authorize } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { createAuditLog } = require("../services/audit.service");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || "change-this-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
  );
}

router.post(
  "/bootstrap-admin",
  asyncHandler(async (req, res) => {
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      return res
        .status(400)
        .json({ message: "Bootstrap is only available before first setup" });
    }

    const user = await User.create({
      name: req.body.name || "System Admin",
      email: req.body.email,
      password: req.body.password,
      role: "Admin"
    });

    const token = signToken(user);
    await createAuditLog({
      action: "BOOTSTRAP_ADMIN",
      entityType: "User",
      entityId: user._id
    });

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase() });

    if (!user || !(await user.comparePassword(password || ""))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);
    await createAuditLog({
      req,
      userId: user._id,
      action: "LOGIN",
      entityType: "User",
      entityId: user._id
    });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

router.post(
  "/register",
  requireAuth,
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
    res.status(201).json(user);
  })
);

module.exports = router;
