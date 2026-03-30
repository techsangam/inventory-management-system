const express = require("express");
const Location = require("../models/Location");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { createAuditLog } = require("../services/audit.service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await Location.find().sort({ name: 1 }));
  })
);

router.post(
  "/",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const location = await Location.create(req.body);
    await createAuditLog({
      req,
      action: "CREATE_LOCATION",
      entityType: "Location",
      entityId: location._id
    });
    res.status(201).json(location);
  })
);

router.put(
  "/:id",
  authorize("Admin", "Manager"),
  asyncHandler(async (req, res) => {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    await createAuditLog({
      req,
      action: "UPDATE_LOCATION",
      entityType: "Location",
      entityId: location._id
    });
    res.json(location);
  })
);

router.delete(
  "/:id",
  authorize("Admin"),
  asyncHandler(async (req, res) => {
    const location = await Location.findByIdAndDelete(req.params.id);
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    await createAuditLog({
      req,
      action: "DELETE_LOCATION",
      entityType: "Location",
      entityId: location._id
    });
    res.json({ message: "Location deleted" });
  })
);

module.exports = router;
