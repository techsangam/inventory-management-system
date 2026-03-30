const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    unit: { type: String, default: "pcs" },
    reorderThreshold: { type: Number, default: 10 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
