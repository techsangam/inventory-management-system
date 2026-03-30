# Inventory Management System

A modular inventory platform built with Node.js, Express, MongoDB, vanilla HTML/CSS/JavaScript, and an optional Electron desktop shell.

## Features

- JWT authentication with Admin, Manager, and Staff roles
- Dashboard with stock summary, low-stock alerts, expiry alerts, purchase/sales snapshots, movement charts, and reorder suggestions
- Product management with SKU, batch, expiry, multi-location stock, and barcode image generation
- Inventory tracking for stock in, stock out, adjustment, and warehouse transfer
- Purchase orders, approval workflow, and GRN processing
- Sales / issue management with approval and completion flow
- Supplier management with outstanding balance tracking
- Reports for stock, expiry, velocity, purchase vs sales, profit margin, forecast, and reorder insights
- Excel import/export, PDF export, notification center, audit logging, and API-ready sync payload endpoint
- Responsive UI and Electron launcher

## Project Structure

```text
client/                 Frontend SPA (HTML, CSS, JavaScript)
electron/               Electron desktop launcher
scripts/                Seed script
src/
  config/               Database config
  middleware/           Auth and error middleware
  models/               Mongoose models
  routes/               REST API routes
  services/             Business logic (stock, reports, audit, dashboard)
  utils/                Shared helpers
```

## Setup

1. Install dependencies.

```bash
npm install
```

2. Local development now defaults to an embedded MongoDB through `.env`, so the app can start even if MongoDB is not installed as a Windows service.

3. Start the app.

```bash
npm start
```

4. Seed sample data.

```bash
npm run seed
```

5. Open [http://localhost:4000](http://localhost:4000)

Optional desktop mode:

```bash
npm run desktop
```

## Production / External MongoDB

If you want to use a normal MongoDB instance instead of the embedded development fallback, update `.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/inventory_management
USE_EMBEDDED_MONGO=false
```

## Sample Users

- Admin: `admin@inventory.local` / `Password123!`
- Manager: `manager@inventory.local` / `Password123!`
- Staff: `staff@inventory.local` / `Password123!`

## Core API Endpoints

- `POST /api/auth/login`
- `POST /api/auth/bootstrap-admin`
- `GET /api/dashboard`
- `GET /api/products`
- `POST /api/products`
- `POST /api/products/import`
- `GET /api/products/:id/barcode-image`
- `GET /api/purchases`
- `POST /api/purchases`
- `PATCH /api/purchases/:id/approve`
- `PATCH /api/purchases/:id/receive`
- `GET /api/issues`
- `POST /api/issues`
- `PATCH /api/issues/:id/approve`
- `PATCH /api/issues/:id/complete`
- `POST /api/inventory/stock-in`
- `POST /api/inventory/stock-out`
- `POST /api/inventory/adjustment`
- `POST /api/inventory/transfer`
- `GET /api/reports/*`
- `GET /api/notifications`
- `GET /api/logs`
- `GET /api/integrations/sync-payload`

## Notes

- The frontend is intentionally framework-free so it runs without a build step.
- Barcode scanning works with keyboard-emulating USB or Bluetooth scanners by focusing the barcode lookup field.
- The embedded MongoDB path is intended for local development and demos. Use a managed or self-hosted MongoDB instance in production.
- The app is structured so cloud sync or third-party integrations can consume the existing REST endpoints or the sync payload export.
