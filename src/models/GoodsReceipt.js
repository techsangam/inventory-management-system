const mongoose = require("mongoose");

const goodsReceiptSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, required: true, unique: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        receivedQty: { type: Number, required: true, min: 1 },
        costPrice: { type: Number, required: true, min: 0 },
        batchNo: { type: String, default: "" },
        expiryDate: { type: Date },
        location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" }
      }
    ],
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("GoodsReceipt", goodsReceiptSchema);
