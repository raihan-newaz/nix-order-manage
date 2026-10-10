# NIX Enterprise Order Management System (OMS), Accounting, ERP, CRM & Logistics

Product modernization is tracked in
[`docs/SAAS_REDESIGN_ROADMAP.md`](docs/SAAS_REDESIGN_ROADMAP.md), with delivered
work recorded in [`docs/IMPLEMENTATION_LOG.md`](docs/IMPLEMENTATION_LOG.md).

An enterprise-grade, high-security, full-stack E-commerce Order Management System (OMS) built with modern Node.js, Express, TypeScript, Prisma, PostgreSQL/SQLite, React, Vite, Tailwind CSS, and Lucide Icons.

---

## 🌟 Key Features

### 1. 🚀 Call-Center Order Processing Command Center
- **High-Speed Hotkey Order Pipeline**: `Pending Calls` ➔ `Confirmed` ➔ `Packaging` ➔ `In Courier` ➔ `Delivered` / `Returned`.
- **1-Click Call & 1-Click WhatsApp**: Instant direct call (`tel:`) and automated WhatsApp message via Baileys API or WhatsApp Web.
- **Fraud & Risk Detection Engine**: Automatic flagging for suspicious phone numbers, high cancellation rates, and duplicate orders within 24 hours.
- **Instant Printable Invoices**:
  - **80mm Thermal POS Receipt**: Custom formatted for thermal receipt and parcel sticker printers.
  - **A4 Standard Corporate Invoice**: Full breakdown with SKU, delivery fees, discount, and COD due.

### 2. 🚚 Direct Courier API Integrations (Steadfast, Pathao, RedX)
- **1-Click & Bulk Courier Consignment Creation**: Directly from the order screen without ever opening courier portals.
  - **Steadfast API**: Instant consignment booking, live tracking code generation, and delivery status updates.
  - **Pathao Courier API**: Dynamic City, Zone, and Area cascading dropdown selection.
  - **RedX Logistics API**: Instant parcel pickup store mapping and tracking ID assignment.
- **Automated Customer Alerts**: Auto-sends live tracking link to customer on dispatch via WhatsApp / SMS.
- **COD Settlement & Reconciliation**: Compares expected COD cash collection against delivered settlements to detect discrepancies.

### 3. 🛒 WooCommerce 2-Way Realtime Sync
- Inbound Webhook support (`/api/woocommerce/webhook`) for instant order ingestion when customers place orders on WordPress.
- Auto-deducts local inventory and syncs status updates back to WooCommerce.

### 4. 📊 Complete Accounting & Real Net Profit/Loss (P&L) Engine
$$\text{Net Profit} = \text{Delivered Sales} - \text{COGS} - \text{Courier Charges \& Returns} - \text{Ad Spend (FB/Google)} - \text{Operating Expenses}$$
- **Multi-Wallet MFS Ledger**: Manage Cash Counter, bKash Merchant/Personal, Nagad, and Corporate Bank Accounts with fund transfers.
- **Digital Marketing / Ad Spend Tracker**: Log Facebook Ads, Google Ads, TikTok Ads with foreign currency USD/BDT conversion, ROAS, CPA, and CPR.
- **Operating Expenses**: Track Rent, Salaries, Packaging, Server, and Utilities by category.

### 5. 📦 ERP Inventory, Multi-Warehouse & Purchases
- SKU & Barcode auto-generator and barcode scanner support.
- Weighted Average Cost (COGS) automatic recalculation upon purchase inward.
- Multi-Warehouse distribution (Dhaka Central, Chittagong Hub).
- Low stock threshold alerts.
- Supplier Ledger & Purchase Order (PO) history with due balances.

### 6. 👥 CRM & Customer 360° Intelligence
- Full customer profile with Lifetime Value (LTV), total orders, completed orders, and return rate %.
- Customer Risk Scoring (Low Risk, High Return Risk, Blacklisted).
- VIP and Wholesale tag segmentation.

### 7. 💬 WhatsApp Baileys & Multi-SMS Gateways
- Direct connection to local/remote **WhatsApp Baileys** instance (`/send-message`).
- Multi SMS Provider Failover (BulkSMSBD, Greenweb, Alpha SMS, Twilio, Generic HTTP).
- Dynamic message templates with `{customer_name}`, `{order_number}`, `{tracking_code}`, `{tracking_url}`, `{grand_total}`, `{cod_amount}` tags.

### 8. 🛡️ Enterprise Security & Role-Based Access Control (RBAC)
- JWT Authentication with HTTP-Only secure cookies and refresh tokens.
- Granular Roles: `SUPER_ADMIN`, `OPERATIONS_MANAGER`, `ACCOUNTANT`, `INVENTORY_MANAGER`, `CALL_CENTER_AGENT`, `DISPATCHER`.
- Tamper-proof Audit Trail recording IP addresses and actions for every critical update.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, Socket.IO, Helmet, CORS, Rate-Limit, Zod, Bcrypt.
- **Database**: MySQL/MariaDB through Prisma (XAMPP-compatible for local development).
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Recharts, React Hot Toast.

---

## 🚀 Quick Start Guide

### 1. Run the Backend Server
```bash
cd server
npm install
npm run prisma:generate
npm run prisma:push
$env:SEED_ADMIN_PASSWORD="use-a-unique-strong-password"
npm run prisma:seed # Preloads sample orders, products, accounts & staff users
npm run dev
```
*Backend runs on `http://localhost:5000`*

### 2. Run the Frontend Client
```bash
cd client
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`*

### Production build (single server)

The API can also serve the built React application, so deployment needs only
one public origin. Configure `server/.env` from `server/.env.example`, then:

```bash
cd client && npm run build
cd ../server && npm run build && npm start
```

Open `http://localhost:5000`. Before exposing it publicly, use a production
database, a unique `JWT_SECRET`, HTTPS, and real courier/WooCommerce/messaging
credentials through the Settings area.

---

## 🔑 Initial Login

The seed creates `admin@nix.bd`, `manager@nix.bd`, and `agent@nix.bd`. Their
password is never stored in source code; set a unique `SEED_ADMIN_PASSWORD`
before running the seed. Change staff passwords before a production launch.

---

## 🔗 WooCommerce Webhook Configuration
1. Go to your WordPress Admin ➔ **WooCommerce** ➔ **Settings** ➔ **Advanced** ➔ **Webhooks**.
2. Click **Add Webhook**:
   - **Name**: `NIX OMS Order Webhook`
   - **Status**: `Active`
   - **Topic**: `Order Created`
   - **Delivery URL**: `http://<your-server-ip>:5000/api/woocommerce/webhook`
   - **API Version**: `WP REST API Integration v3`
