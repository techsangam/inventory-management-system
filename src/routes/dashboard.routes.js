const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const { buildDashboardData } = require("../services/dashboard.service");
const { bus } = require("../services/eventBus");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const data = await buildDashboardData();
    res.json(data);
  })
);

router.get(
  "/events",
  asyncHandler(async (req, res) => {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ message: "Missing event token" });
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "change-this-secret"
    );
    const user = await User.findById(payload.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid event token" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    send({ type: "connected", timestamp: new Date().toISOString() });
    const listener = (event) => send(event);
    bus.on("event", listener);

    req.on("close", () => {
      bus.off("event", listener);
      res.end();
    });
  })
);

module.exports = router;
