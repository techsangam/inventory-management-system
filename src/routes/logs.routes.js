const express = require("express");
const AuditLog = require("../models/AuditLog");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  authorize("Admin", "Manager"),
  asyncHandler(async (_req, res) => {
    const logs = await AuditLog.find()
      .populate("user", "name role")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(logs);
  })
);

module.exports = router;
