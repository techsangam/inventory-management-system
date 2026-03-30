const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    itemName: { type: String, required: true },
    sku: { type: String, required: true },
    orderedQty: { type: Number, required: true, min: 1 },
    receivedQty: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    batchNo: { type: String, default: "" },
    expiryDate: { type: Date }
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    expectedDate: { type: Date },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "partial", "completed", "cancelled"],
      default: "draft"
    },
    approvalRequired: { type: Boolean, default: true },
    items: { type: [purchaseItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
