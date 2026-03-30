const mongoose = require("mongoose");

const issueItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    batchNo: { type: String, default: "" }
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    issueNumber: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["sale", "issue", "transfer"],
      default: "issue"
    },
    destination: { type: String, default: "" },
    sourceLocation: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    targetLocation: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "completed", "cancelled"],
      default: "draft"
    },
    items: { type: [issueItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Issue", issueSchema);
