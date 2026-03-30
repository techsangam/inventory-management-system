const mongoose = require("mongoose");

const locationStockSchema = new mongoose.Schema(
  {
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    quantity: { type: Number, default: 0 }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode: { type: String, unique: true, sparse: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    description: { type: String, default: "" },
    batchNo: { type: String, default: "" },
    expiryDate: { type: Date },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 10 },
    overstockLevel: { type: Number, default: 500 },
    unit: { type: String, default: "pcs" },
    serialTracking: { type: Boolean, default: false },
    batchTracking: { type: Boolean, default: true },
    serialNumbers: [{ type: String }],
    locationStocks: [locationStockSchema],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

productSchema.pre("save", function applyBarcode(next) {
  if (!this.barcode) {
    this.barcode = this.sku;
  }
  return next();
});

module.exports = mongoose.model("Product", productSchema);
