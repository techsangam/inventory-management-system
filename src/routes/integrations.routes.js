const express = require("express");
const Category = require("../models/Category");
const Issue = require("../models/Issue");
const Location = require("../models/Location");
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const Setting = require("../models/Setting");
const Supplier = require("../models/Supplier");
const { authorize, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const settings = await Setting.findOne();
    res.json({
      cloudSyncEnabled: settings?.cloudSyncEnabled || false,
      apiReady: true,
      exportedAt: new Date().toISOString()
    });
  })
);

router.get(
  "/sync-payload",
  authorize("Admin", "Manager"),
  asyncHandler(async (_req, res) => {
    const [products, suppliers, categories, locations, purchases, issues] =
      await Promise.all([
        Product.find().lean(),
        Supplier.find().lean(),
        Category.find().lean(),
        Location.find().lean(),
        PurchaseOrder.find().lean(),
        Issue.find().lean()
      ]);

    res.json({
      meta: {
        exportedAt: new Date().toISOString(),
        version: 1
      },
      products,
      suppliers,
      categories,
      locations,
      purchases,
      issues
    });
  })
);

module.exports = router;
