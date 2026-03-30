const express = require("express");
const Setting = require("../models/Setting");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { createAuditLog } = require("../services/audit.service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        units: ["pcs", "box", "strip", "bottle", "carton"]
      });
    }
    res.json(settings);
  })
);

router.put(
  "/",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting();
    }
    Object.assign(settings, req.body);
    await settings.save();
    await createAuditLog({
      req,
      action: "UPDATE_SETTINGS",
      entityType: "Setting",
      entityId: settings._id
    });
    res.json(settings);
  })
);

module.exports = router;
