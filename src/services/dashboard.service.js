const Category = require("../models/Category");
const GoodsReceipt = require("../models/GoodsReceipt");
const Issue = require("../models/Issue");
const Notification = require("../models/Notification");
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const StockTransaction = require("../models/StockTransaction");
const { getForecastReport, getReorderSuggestions } = require("./report.service");

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

async function buildDashboardData() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const expiryCutoff = new Date();
  expiryCutoff.setDate(expiryCutoff.getDate() + 30);

  const [
    productCount,
    stockSum,
    lowStockItems,
    expiringItems,
    todayReceipts,
    todaySales,
    categories,
    recentNotifications,
    pendingPurchases,
    pendingIssues,
    movements,
    topCategories,
    forecast,
    reorderSuggestions
  ] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Product.aggregate([{ $group: { _id: null, total: { $sum: "$quantity" } } }]),
    Product.countDocuments({
      $expr: { $lte: ["$quantity", "$reorderLevel"] }
    }),
    Product.countDocuments({
      quantity: { $gt: 0 },
      expiryDate: { $gte: todayStart, $lte: expiryCutoff }
    }),
    GoodsReceipt.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd }
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          total: {
            $sum: { $multiply: ["$items.receivedQty", "$items.costPrice"] }
          }
        }
      }
    ]),
    Issue.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status: "completed"
        }
      },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]),
    Category.countDocuments(),
    Notification.find().sort({ createdAt: -1 }).limit(6).lean(),
    PurchaseOrder.countDocuments({
      status: { $in: ["draft", "pending_approval", "partial"] }
    }),
    Issue.countDocuments({
      status: { $in: ["draft", "pending_approval"] }
    }),
    StockTransaction.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 6))
          }
        }
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type"
          },
          total: { $sum: "$quantity" }
        }
      },
      { $sort: { "_id.day": 1 } }
    ]),
    Product.aggregate([
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$category.name",
          totalQty: { $sum: "$quantity" }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 }
    ]),
    getForecastReport({ horizonDays: 14 }),
    getReorderSuggestions()
  ]);

  return {
    summary: {
      totalProducts: productCount,
      totalStockUnits: stockSum[0]?.total || 0,
      lowStockItems,
      expiringItems,
      todayPurchaseValue: todayReceipts[0]?.total || 0,
      todaySalesValue: todaySales[0]?.total || 0,
      categories,
      pendingPurchases,
      pendingIssues
    },
    charts: {
      stockMovement: movements,
      categoryBreakdown: topCategories,
      forecast
    },
    alerts: recentNotifications,
    reorderSuggestions: reorderSuggestions.slice(0, 8)
  };
}

module.exports = { buildDashboardData };
