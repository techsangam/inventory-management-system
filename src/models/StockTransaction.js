const mongoose = require("mongoose");

const stockTransactionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    type: {
      type: String,
      enum: ["in", "out", "adjustment", "transfer_in", "transfer_out"],
      required: true
    },
    quantity: { type: Number, required: true },
    beforeQty: { type: Number, default: 0 },
    afterQty: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    referenceType: { type: String, default: "" },
    referenceId: { type: String, default: "" },
    batchNo: { type: String, default: "" },
    expiryDate: { type: Date },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
