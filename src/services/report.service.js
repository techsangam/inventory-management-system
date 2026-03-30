const GoodsReceipt = require("../models/GoodsReceipt");
const Issue = require("../models/Issue");
const Product = require("../models/Product");
const StockTransaction = require("../models/StockTransaction");

function normalizeRange(startDate, endDate) {
  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate ? new Date(endDate) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function getStockReport() {
  return Product.find()
    .populate("category", "name")
    .populate("supplier", "name")
    .populate("locationStocks.location", "name type")
    .sort({ name: 1 })
    .lean();
}

async function getExpiryReport({ days = 60 } = {}) {
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + Number(days));

  return Product.find({
    quantity: { $gt: 0 },
    expiryDate: { $gte: today, $lte: future }
  })
    .populate("category", "name")
    .sort({ expiryDate: 1 })
    .lean();
}

async function getVelocityReport({ days = 30 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  const movement = await StockTransaction.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        type: { $in: ["out", "transfer_out"] }
      }
    },
    {
      $group: {
        _id: "$product",
        quantityMoved: { $sum: "$quantity" },
        transactions: { $sum: 1 }
      }
    },
    { $sort: { quantityMoved: -1 } }
  ]);

  const products = await Product.find({
    _id: { $in: movement.map((item) => item._id) }
  })
    .select("name sku quantity reorderLevel")
    .lean();

  return movement.map((item) => {
    const product = products.find(
      (candidate) => String(candidate._id) === String(item._id)
    );
    return {
      productId: item._id,
      name: product?.name || "Unknown",
      sku: product?.sku || "",
      quantityOnHand: product?.quantity || 0,
      reorderLevel: product?.reorderLevel || 0,
      quantityMoved: item.quantityMoved,
      transactions: item.transactions
    };
  });
}

async function getPurchaseSalesReport({ startDate, endDate } = {}) {
  const { start, end } = normalizeRange(startDate, endDate);

  const [purchases, sales] = await Promise.all([
    GoodsReceipt.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: { $multiply: ["$items.receivedQty", "$items.costPrice"] } }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Issue.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: "completed"
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$total" }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  return { purchases, sales, range: { start, end } };
}

async function getProfitMarginReport() {
  const issues = await Issue.find({
    type: "sale",
    status: "completed"
  }).lean();

  const rows = [];
  for (const issue of issues) {
    for (const item of issue.items) {
      const revenue = Number(item.sellingPrice || 0) * Number(item.quantity || 0);
      const cost = Number(item.costPrice || 0) * Number(item.quantity || 0);
      rows.push({
        issueNumber: issue.issueNumber,
        productId: item.product,
        quantity: item.quantity,
        revenue,
        cost,
        margin: revenue - cost
      });
    }
  }

  return rows;
}

async function getForecastReport({ lookbackDays = 30, horizonDays = 14 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - Number(lookbackDays));

  const movement = await StockTransaction.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        type: { $in: ["out", "transfer_out"] }
      }
    },
    {
      $group: {
        _id: "$product",
        quantityMoved: { $sum: "$quantity" }
      }
    }
  ]);

  const products = await Product.find().lean();
  return products.map((product) => {
    const sale = movement.find(
      (item) => String(item._id) === String(product._id)
    );
    const dailyDemand = Number(((sale?.quantityMoved || 0) / lookbackDays).toFixed(2));
    const projectedDemand = Number((dailyDemand * horizonDays).toFixed(2));
    const projectedClosing = Number((product.quantity - projectedDemand).toFixed(2));
    return {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      onHand: product.quantity,
      reorderLevel: product.reorderLevel,
      dailyDemand,
      projectedDemand,
      projectedClosing
    };
  });
}

async function getReorderSuggestions() {
  const forecast = await getForecastReport({ lookbackDays: 30, horizonDays: 14 });
  return forecast
    .filter(
      (item) =>
        item.onHand <= 0 ||
        item.projectedClosing <= 0 ||
        item.onHand <= (item.reorderLevel || 10)
    )
    .sort((a, b) => a.projectedClosing - b.projectedClosing);
}

module.exports = {
  getStockReport,
  getExpiryReport,
  getVelocityReport,
  getPurchaseSalesReport,
  getProfitMarginReport,
  getForecastReport,
  getReorderSuggestions
};
