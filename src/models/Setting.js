const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: "Inventory Management System" },
    currency: { type: String, default: "USD" },
    taxRate: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    expiryAlertDays: { type: Number, default: 30 },
    units: [{ type: String }],
    cloudSyncEnabled: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
