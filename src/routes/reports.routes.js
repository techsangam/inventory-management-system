const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async");
const {
  getExpiryReport,
  getForecastReport,
  getProfitMarginReport,
  getPurchaseSalesReport,
  getReorderSuggestions,
  getStockReport,
  getVelocityReport
} = require("../services/report.service");
const { buildExcelBuffer, buildPdfBuffer } = require("../services/export.service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/stock",
  asyncHandler(async (_req, res) => {
    res.json(await getStockReport());
  })
);

router.get(
  "/expiry",
  asyncHandler(async (req, res) => {
    res.json(await getExpiryReport({ days: req.query.days || 60 }));
  })
);

router.get(
  "/velocity",
  asyncHandler(async (req, res) => {
    res.json(await getVelocityReport({ days: req.query.days || 30 }));
  })
);

router.get(
  "/purchase-sales",
  asyncHandler(async (req, res) => {
    res.json(
      await getPurchaseSalesReport({
        startDate: req.query.startDate,
        endDate: req.query.endDate
      })
    );
  })
);

router.get(
  "/profit-margin",
  asyncHandler(async (_req, res) => {
    res.json(await getProfitMarginReport());
  })
);

router.get(
  "/forecast",
  asyncHandler(async (_req, res) => {
    res.json(await getForecastReport({ lookbackDays: 30, horizonDays: 14 }));
  })
);

router.get(
  "/reorder-suggestions",
  asyncHandler(async (_req, res) => {
    res.json(await getReorderSuggestions());
  })
);

router.get(
  "/export/excel",
  asyncHandler(async (req, res) => {
    const type = req.query.type || "stock";
    const stock = await getStockReport();
    const expiry = await getExpiryReport();
    const rows = type === "expiry" ? expiry : stock;
    const buffer = await buildExcelBuffer({
      sheetName: "Report",
      columns:
        type === "expiry"
          ? [
              { header: "Item", key: "name" },
              { header: "SKU", key: "sku" },
              { header: "Expiry Date", key: "expiryDate" },
              { header: "Quantity", key: "quantity" }
            ]
          : [
              { header: "Item", key: "name" },
              { header: "SKU", key: "sku" },
              { header: "Quantity", key: "quantity" },
              { header: "Selling Price", key: "sellingPrice" },
              { header: "Purchase Price", key: "purchasePrice" }
            ],
      rows: rows.map((row) => ({
        ...row,
        expiryDate: row.expiryDate
          ? new Date(row.expiryDate).toISOString().slice(0, 10)
          : ""
      }))
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.xlsx"`);
    res.send(Buffer.from(buffer));
  })
);

router.get(
  "/export/pdf",
  asyncHandler(async (req, res) => {
    const type = req.query.type || "stock";
    const stock = await getStockReport();
    const lines = stock.map(
      (row) => `${row.name} | ${row.sku} | Qty: ${row.quantity} | Price: ${row.sellingPrice}`
    );
    const buffer = await buildPdfBuffer({
      title: `${type.toUpperCase()} REPORT`,
      lines
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.pdf"`);
    res.send(buffer);
  })
);

module.exports = router;
