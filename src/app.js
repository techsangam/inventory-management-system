const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { errorHandler, notFoundHandler } = require("./middleware/error");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const productRoutes = require("./routes/products.routes");
const supplierRoutes = require("./routes/suppliers.routes");
const locationRoutes = require("./routes/locations.routes");
const categoryRoutes = require("./routes/categories.routes");
const purchaseRoutes = require("./routes/purchases.routes");
const issueRoutes = require("./routes/issues.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const reportRoutes = require("./routes/reports.routes");
const notificationRoutes = require("./routes/notifications.routes");
const settingsRoutes = require("./routes/settings.routes");
const logRoutes = require("./routes/logs.routes");
const integrationRoutes = require("./routes/integrations.routes");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true
  })
);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Inventory Management System",
    time: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/integrations", integrationRoutes);

app.use(express.static(path.join(__dirname, "..", "client")));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  return res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
