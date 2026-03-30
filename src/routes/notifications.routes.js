const express = require("express");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await Notification.find({
      $or: [{ targetRoles: { $size: 0 } }, { targetRoles: req.user.role }]
    })
      .populate("product", "name sku")
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(items);
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const item = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json(item);
  })
);

module.exports = router;
