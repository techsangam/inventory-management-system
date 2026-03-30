const Product = require("../models/Product");
const Notification = require("../models/Notification");
const Setting = require("../models/Setting");
const StockTransaction = require("../models/StockTransaction");
const { emitAppEvent } = require("./eventBus");

async function getSettings() {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({
      units: ["pcs", "box", "strip", "bottle"]
    });
  }
  return settings;
}

function syncLocationStock(product, locationId, delta) {
  if (!locationId) {
    return;
  }

  const key = String(locationId);
  const current = product.locationStocks.find(
    (entry) => String(entry.location) === key
  );

  if (!current) {
    product.locationStocks.push({ location: locationId, quantity: Math.max(0, delta) });
    return;
  }

  current.quantity = Math.max(0, Number(current.quantity || 0) + delta);
}

async function refreshProductAlerts(product) {
  const settings = await getSettings();
  const alertDays = settings.expiryAlertDays || 30;
  const lowThreshold = product.reorderLevel || settings.lowStockThreshold || 10;
  const alerts = [];

  await Notification.deleteMany({
    product: product._id,
    type: { $in: ["low_stock", "expiry", "overstock"] }
  });

  if (product.quantity <= lowThreshold) {
    alerts.push({
      type: "low_stock",
      severity: "critical",
      title: `Low stock: ${product.name}`,
      message: `${product.name} is down to ${product.quantity} ${product.unit}.`,
      targetRoles: ["Admin", "Manager", "Staff"]
    });
  }

  if (product.quantity >= (product.overstockLevel || 500)) {
    alerts.push({
      type: "overstock",
      severity: "warning",
      title: `Overstock: ${product.name}`,
      message: `${product.name} exceeded the overstock level with ${product.quantity} ${product.unit}.`,
      targetRoles: ["Admin", "Manager"]
    });
  }

  if (product.expiryDate) {
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + alertDays);
    if (product.expiryDate >= today && product.expiryDate <= future) {
      alerts.push({
        type: "expiry",
        severity: "warning",
        title: `Expiry alert: ${product.name}`,
        message: `${product.name} will expire on ${product.expiryDate.toISOString().slice(0, 10)}.`,
        targetRoles: ["Admin", "Manager", "Staff"]
      });
    }
  }

  if (alerts.length > 0) {
    await Notification.insertMany(
      alerts.map((alert) => ({
        ...alert,
        product: product._id,
        entityType: "Product",
        entityId: String(product._id)
      }))
    );
  }

  emitAppEvent("notifications.updated", { productId: product._id });
}

async function createMovement({
  productId,
  locationId,
  quantity,
  type,
  reason,
  referenceType,
  referenceId,
  batchNo,
  expiryDate,
  userId
}) {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error("Product not found");
  }

  const numericQty = Number(quantity);
  if (!numericQty || numericQty <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  const outgoingTypes = ["out", "transfer_out"];
  const delta = outgoingTypes.includes(type) ? -numericQty : numericQty;
  const beforeQty = product.quantity;
  const afterQty = beforeQty + delta;

  if (afterQty < 0) {
    throw new Error(`Insufficient stock for ${product.name}`);
  }

  product.quantity = afterQty;
  if (batchNo) {
    product.batchNo = batchNo;
  }
  if (expiryDate) {
    product.expiryDate = expiryDate;
  }
  syncLocationStock(product, locationId, delta);
  await product.save();

  const transaction = await StockTransaction.create({
    product: product._id,
    location: locationId,
    type,
    quantity: numericQty,
    beforeQty,
    afterQty,
    reason: reason || "",
    referenceType: referenceType || "",
    referenceId: referenceId ? String(referenceId) : "",
    batchNo: batchNo || product.batchNo || "",
    expiryDate: expiryDate || product.expiryDate,
    performedBy: userId
  });

  await refreshProductAlerts(product);
  emitAppEvent("inventory.updated", {
    productId: product._id,
    type,
    quantity: numericQty,
    locationId
  });

  return { product, transaction };
}

async function transferStock({
  productId,
  sourceLocationId,
  targetLocationId,
  quantity,
  reason,
  referenceType,
  referenceId,
  userId
}) {
  if (!sourceLocationId || !targetLocationId) {
    throw new Error("Source and target locations are required");
  }

  await createMovement({
    productId,
    locationId: sourceLocationId,
    quantity,
    type: "transfer_out",
    reason,
    referenceType,
    referenceId,
    userId
  });

  return createMovement({
    productId,
    locationId: targetLocationId,
    quantity,
    type: "transfer_in",
    reason,
    referenceType,
    referenceId,
    userId
  });
}

module.exports = {
  createMovement,
  transferStock,
  refreshProductAlerts,
  getSettings
};
