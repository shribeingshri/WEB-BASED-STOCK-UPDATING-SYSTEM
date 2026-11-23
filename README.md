# Buildmore Ventures LLP — Web-Based Stock Updating & Inventory Management System

A production-grade, full-stack inventory and stock updating platform built for **Buildmore Ventures LLP** (VTU Scheme 2022 — **BCS586**).

## Key Features

- **Role-Based Authentication & Security**: `bcrypt` password hashing, JWT stored in `HttpOnly` cookies, rate-limited login, Helmet security headers, CORS restrictions, and backend-enforced `ADMIN` / `STAFF` permissions.
- **Real-Time Stock Operations (Concurrency-Safe)**: Stock-In, Stock-Out, and Admin Stock Adjustments execute inside MySQL InnoDB transactions with `SELECT ... FOR UPDATE` row locking. Negative stock is strictly impossible.
- **Immutable Transaction Ledger & Audit Trail**: Every movement records previous stock, new stock, user, reference number, and timestamp. Items with transaction history are archived rather than hard-deleted.
- **Automated Low-Stock & Out-of-Stock Alerts**: Threshold monitoring auto-creates alerts when stock drops to/below minimum and auto-resolves them upon replenishment, synced across connected users via **Socket.IO**.
- **Interactive Dashboard & Analytics**: Real-time KPI cards and **Chart.js** visualizations (Stock Movement Daily/Weekly/Monthly, Stock Health Overview, Category Distribution).
- **Comprehensive Reporting**: Current Inventory, Stock-In, Stock-Out, Low-Stock, and Stock Movement reports with filters and exports to **CSV**, **Excel (`.xlsx` via ExcelJS)**, and **PDF (`.pdf` via PDFKit)**.
- **QR Code Support**: Instant QR code generation for each product in the inventory detail modal.

---

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla ES6+ JavaScript, Chart.js, Lucide Icons, Socket.IO Client
- **Backend**: Node.js, Express.js, Socket.IO, ExcelJS, PDFKit, QRCode
- **Database**: MySQL (InnoDB) with `mysql2/promise`

---

## Project Structure

```text
├── database/
│   ├── schema.sql              # Normalized MySQL InnoDB schema
│   └── seed.sql                # Default settings, categories, suppliers
├── public/
│   ├── index.html              # Main SPA shell
│   ├── login.html              # Authentication page
│   ├── css/                    # Design system & component styles
│   └── js/                     # Modular API, UI, Socket.IO, and 9 page modules
├── src/
│   ├── app.js                  # Express app & security middleware
│   ├── server.js               # HTTP + Socket.IO entry point
│   ├── config/                 # Environment & MySQL connection pool
│   ├── controllers/            # REST request handlers
│   ├── middleware/             # Auth, RBAC, validation, error handling
│   ├── routes/                 # Modular Express routers
│   ├── services/               # Transactional business logic
│   └── utils/                  # ApiError, asyncHandler, Socket.IO, DB init
└── tests/                      # Unit & integration/concurrency tests
```

---

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/shribeingshri/WEB-BASED-STOCK-UPDATING-SYSTEM.git
   cd WEB-BASED-STOCK-UPDATING-SYSTEM
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and a strong `JWT_SECRET`.

4. **Initialize the MySQL database**
   ```bash
   npm run db:init
   ```
   This creates the `buildmore_inventory` schema, seeds default categories/suppliers/sample items, and creates default accounts:
   - **Admin**: `admin@buildmoreventures.in` / `Admin@123`
   - **Staff**: `staff@buildmoreventures.in` / `Staff@123`

5. **Run the application**
   ```bash
   npm run dev     # Development with file watching
   npm start       # Production
   ```
   Open `http://localhost:3000` in your browser.

6. **Run tests**
   ```bash
   npm test
   ```

---

## Core API Endpoints

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/items`, `GET /api/items/:id/qr`, `GET /api/items/:id/transactions`
- `POST /api/stock/in`, `POST /api/stock/out`, `POST /api/stock/adjust`, `GET /api/stock/transactions`
- `GET /api/alerts`, `PATCH /api/alerts/:id/resolve`
- `GET /api/dashboard/summary`, `GET /api/dashboard/stock-movement`, `GET /api/dashboard/recent-transactions`, `GET /api/dashboard/low-stock`
- `GET /api/reports/:type?format=json|csv|xlsx|pdf` (`inventory`, `stock-in`, `stock-out`, `low-stock`, `movements`)
- `GET/POST/PUT /api/users`, `PATCH /api/users/:id/status` (Admin only)
- `GET/PUT /api/settings`, `GET /api/settings/audit-logs`

---

## Deployment Guide

1. Provision a hosted MySQL 5.7+ / 8.0+ database (e.g. AWS RDS, PlanetScale/Aiven, or Railway MySQL) and run `npm run db:init`.
2. Deploy the Node.js application to Render, Railway, or a Linux VPS behind Nginx with HTTPS enabled.
3. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, `CLIENT_ORIGIN=https://your-domain.com`, and a 32+ character `JWT_SECRET`.
4. Schedule automated daily `mysqldump` backups of `buildmore_inventory`.
