# NIX Commerce OS — SaaS Redesign & Scale Roadmap

Last updated: 2026-09-22  
Status: Phase 0 complete; shared admin workspace redesign shipped; Phase 1 data foundations are next

## 1. Product direction

NIX will evolve from a single-store OMS demo into a tenant-aware commerce
operations SaaS for Bangladeshi online businesses. The product should give an
owner, call-center team, warehouse, accounts team, and dispatch team one shared
operating system for orders, stock, courier, customers, cash, and decisions.

### Product principles

1. Operations-first: the next action must be obvious and fast.
2. Exception-driven: surface delays, risk, stockouts, COD mismatches, and loss.
3. Trustworthy numbers: no random or demo analytics in production paths.
4. Tenant-safe by design: every business record belongs to an organization.
5. Async by default for integrations: webhooks and external APIs must not block
   core order work.
6. Progressive scale: start as a modular monolith, split services only when
   measured load or team ownership justifies it.

## 2. Current-state audit

### What already works

- React/Vite frontend with dark mode and role-aware authentication.
- Express/TypeScript API organized into domain modules.
- Orders, inventory, purchasing, CRM, accounting, courier, messaging,
  WooCommerce, audit, and dashboard flows.
- Prisma data model, demo seed data, Socket.IO, RBAC helpers, and audit logging.
- Production builds compile, and the API can serve the built SPA.

### Gaps before SaaS production

- All data is global; Organization, Membership, Store, Plan, and subscription
  boundaries do not exist.
- SQLite and missing query indexes will not support high write concurrency.
- External integrations run inline; there is no durable queue, retry policy,
  dead-letter queue, idempotency key, or webhook inbox/outbox.
- JWT uses browser localStorage; refresh-token rotation, session revocation,
  CSRF strategy, real 2FA, password reset, and login throttling are incomplete.
- Integration secrets can be returned to the client and are not encrypted at
  rest.
- Dashboard totals are all-time mixes and the 7-day trend contains random mock
  values. Date ranges, timezone, comparison periods, and metric definitions are
  missing.
- Controllers own validation, business logic, and persistence together; there
  is no service/repository boundary or consistent typed error contract.
- No automated unit, integration, contract, E2E, load, accessibility, or
  recovery tests.
- Large page components duplicate UI patterns; there is no reusable design
  system, query cache, route-level code splitting, or table virtualization.
- Sidebar/app shell is desktop-only and several apparent controls are not wired.

## 3. Target product navigation

### Command

- Overview
- Action Center
- Live Orders
- Fulfillment Board

### Sell

- Orders
- Returns & Exchanges
- Customers
- Campaign Attribution

### Operate

- Products & Inventory
- Purchase & Suppliers
- Warehouses & Transfers
- Courier & COD Reconciliation

### Finance

- Profitability
- Cash & Accounts
- Expenses
- Settlements

### Automate

- Inbox & Messages
- Rules & Workflows
- Integrations

### Manage

- Team & Permissions
- Audit & Security
- Organization, Billing & Settings

Navigation visibility will come from permissions, not hard-coded role names.

## 4. Modern UI direction

The interface will be a high-density operations console, not a marketing-style
dashboard. It will use a calm neutral canvas, deep ink text, cobalt as the main
action color, emerald/amber/rose only for semantic states, compact data tables,
and clear typography. Dark mode remains first-class.

### Shared UI foundations

- Responsive collapsible navigation, mobile drawer, organization/store switcher.
- [x] Conventional visible search for orders and products; no command-palette keyboard shortcut.
- [ ] Cross-entity universal search for orders, customers, products, and SKUs.
- Page header, date-range control, saved views, filter chips, bulk-action bar.
- Reusable Button, Input, Select, Dialog, Drawer, Card, Stat, Badge, EmptyState,
  Skeleton, DataTable, Pagination, and ErrorState components.
- Toast plus durable notification center; optimistic changes only where safe.
- Keyboard-first order processing and visible shortcut help.
- WCAG AA contrast, focus states, semantic labels, reduced-motion support.
- Route-level lazy loading and chart loading only on analytics routes.

### Dashboard v2

- Date ranges: today, yesterday, 7/30/90 days, custom; compare to prior period.
- KPI row: net sales, delivered revenue, contribution margin, orders, AOV,
  delivery rate, return rate, and outstanding COD.
- Action Center: pending calls, aging orders, failed syncs, low stock, overdue
  supplier dues, courier discrepancies, failed messages, and high-risk orders.
- Funnel: new -> confirmed -> packed -> shipped -> delivered/returned.
- Sales/profit trend with real database aggregates and metric definitions.
- Courier performance: delivery rate, average delivery time, return rate, charge.
- Product profitability and stock cover, not only revenue ranking.
- Team/SLA panel: queue age, calls handled, confirmation rate, throughput.
- Drill-down links preserve the dashboard filter context.

## 5. Business-essential feature backlog

### P0 — operational safety and control

- Organization/store/warehouse isolation with membership and granular permissions.
- Order activity timeline, ownership, internal mentions, tags, and SLA timers.
- Saved filters, bulk actions, CSV import/export, duplicate merge, and undo-safe
  status transitions.
- Returns/exchanges/RTO workflow with reasons, restock decision, refund state,
  loss calculation, and evidence attachments.
- Inventory reservations, available-to-promise stock, transfers, cycle counts,
  batches, and immutable stock ledger.
- Courier webhook ingestion, delivery status history, retry-safe dispatch, COD
  settlement import, discrepancy queue, and reconciliation approvals.
- Reliable WooCommerce sync with replayable webhook inbox and sync health page.
- Real notification center and integration health alerts.

### P1 — business intelligence

- Product/order/customer contribution margin.
- Cohorts, repeat purchase rate, LTV, RFM segments, and churn opportunities.
- Inventory aging, sell-through, days of cover, reorder suggestions, dead stock.
- Cash-flow forecast, receivables/payables, courier COD aging, supplier dues.
- Channel/campaign attribution with CPA, ROAS, contribution ROAS, and break-even
  ROAS.
- Scheduled reports and owner daily digest.

### P2 — automation and growth

- Visual automation rules: trigger, condition, action, cooldown, audit trail.
- Abandoned-call/order follow-up sequences and delivery confirmation messages.
- Fraud/risk rules with explainable scores and allow/block lists.
- Approval workflows for discounts, refunds, expenses, stock adjustments, and
  reconciliation differences.
- Customer support inbox, conversation assignment, canned replies, and SLA.
- Public API, scoped API keys, signed webhooks, and integration marketplace.

## 6. Target technical architecture

### Deployment shape

```text
Browser / Mobile Web
        |
 CDN + WAF + TLS
        |
 API / BFF (stateless Express modular monolith)
   |        |          |            |
Postgres   Redis     Object Store   Socket gateway
   |        |
Read model Queue -> Worker processes -> Woo/Courier/SMS/Email
   |
Outbox + Webhook inbox + Audit/event stream
```

### Core choices

- Frontend: React + TypeScript + Vite, TanStack Query, React Hook Form + Zod,
  route lazy-loading, reusable headless components, virtualized large tables.
- API: Express remains initially; controllers -> application services -> domain
  services -> repositories. Zod validates every external boundary.
- Primary DB: PostgreSQL. Monetary values become Decimal or integer minor units;
  all timestamps are UTC and rendered in organization timezone.
- Cache/queue: Redis plus BullMQ for sync, notifications, exports, reports,
  reconciliation, and webhook processing.
- Files: S3-compatible object storage with signed URLs and malware/type checks.
- Realtime: Socket.IO with authenticated organization rooms; database remains the
  source of truth.
- Observability: structured logs, request/correlation IDs, metrics, tracing,
  error reporting, queue dashboards, audit events, and health/readiness probes.

### Tenant and data safety rules

- Organization is the tenant root; Membership maps users to organizations.
- Every tenant-owned table has `organizationId`; stores and warehouses are scoped
  beneath it. Unique constraints and indexes include the tenant key.
- Tenant context is resolved in authentication and required by repositories.
- Integration credentials are envelope-encrypted and never returned in full.
- Webhooks use signature verification, timestamp tolerance, idempotency keys,
  and raw request preservation where required.
- Writes that create external side effects use transaction + outbox; workers are
  idempotent and retry with exponential backoff.
- Append-only ledgers back inventory and money. Corrections use reversal entries.

## 7. Performance and reliability targets

Initial production SLOs, revisited after real traffic is measured:

- 99.9% monthly availability for core order operations.
- API p95 under 300 ms for common reads and under 500 ms for common writes.
- Dashboard p95 under 1.5 s with pre-aggregated metrics where needed.
- 100k orders per organization without degraded table interaction.
- At-least-once background delivery with idempotent consumers.
- RPO <= 15 minutes and RTO <= 2 hours; restore drills are mandatory.
- Large exports, imports, syncs, and messaging always run asynchronously.

Required techniques: cursor pagination, selective projections, composite indexes,
bounded queries, query timeouts, connection pooling, rate limits per tenant/API
key, cache invalidation rules, backpressure, and queue concurrency controls.

## 8. Security baseline

- Short-lived access token plus rotating HttpOnly/Secure/SameSite refresh cookie.
- Session inventory, remote logout, password reset, verified email, and TOTP 2FA.
- Permission policies for every mutation; sensitive actions require step-up auth.
- Secrets in environment/secret manager; tenant integration secrets encrypted.
- Strict CORS allowlist, CSP, secure headers, input limits, output redaction.
- Separate public webhook rate limits and signature checks.
- Audit login, permission, export, finance, integration, inventory, and order events.
- Dependency scanning, SAST, secret scanning, backup encryption, and incident runbook.

## 9. Delivery phases

### Phase 0 — discovery and guardrails (complete)

- [x] Inventory frontend pages, API domains, data model, and runtime path.
- [x] Record current gaps, target product, architecture, and prioritized backlog.
- [x] Define phased delivery and acceptance gates.

Exit gate: this roadmap is the source of truth and changes are logged.

### Phase 1 — UI foundation and real dashboard

- [x] Add design tokens and initial reusable primitives.
- [x] Build responsive app shell, mobile navigation, conventional search, and
  permission-ready navigation config. Organization/store switching is deferred
  until the tenant model exists in Phase 2.
- [ ] Introduce TanStack Query and shared API/error/loading patterns.
- [ ] Add typed dashboard contract, date filters, prior-period comparison, real
  trend query, action-center query, and dashboard v2 UI.
- [ ] Lazy-load routes and split chart/vendor chunks.
- [ ] Add component tests and dashboard E2E smoke test.

Exit gate: dashboard has no random/mock metrics, works from 360 px to wide desktop,
keyboard navigation passes, and production bundle is split by route.

### Phase 2 — tenancy, identity, and platform safety

- [ ] Migrate SQLite development model to PostgreSQL-ready migrations.
- [ ] Add Organization, Membership, Store, Subscription, Session, Permission,
  ApiKey, Notification, and IntegrationSecret entities.
- [ ] Backfill all existing records into a default organization.
- [ ] Enforce organization filters, tenant composite indexes, and permission checks.
- [ ] Add refresh rotation, session revocation, password reset, TOTP, and secure
  secret storage/redaction.
- [ ] Add request IDs, structured logs, error codes, readiness, metrics, and tracing.

Exit gate: automated tenant-leak tests pass; no secret is exposed by API responses.

### Phase 3 — durable integrations and high-load processing

- [ ] Add Redis/BullMQ, worker process, job contracts, retries, DLQ, and job UI.
- [ ] Add webhook inbox, outbox, idempotency, signature validation, and replay.
- [ ] Move WooCommerce, courier, messaging, exports, and reports into jobs.
- [ ] Add integration health, sync cursor/checkpoint, and operator recovery flows.
- [ ] Load-test API and workers; add query/index budgets and backpressure.

Exit gate: duplicate webhook/job delivery cannot duplicate orders, parcels, stock,
messages, or money; failed work is visible and replayable.

### Phase 4 — operations depth

- [ ] Rebuild orders as saved operational views with timeline, assignment, SLA,
  bulk processing, keyboard flow, and safe transition policy.
- [ ] Implement returns/exchanges and inventory reservation/ledger/transfers/counts.
- [ ] Complete courier status history and COD reconciliation approval workflow.
- [ ] Add file attachments and generated/imported documents.

Exit gate: one order can be traced from source through stock, parcel, payment,
return, and every actor/action without ambiguous state.

### Phase 5 — finance, CRM, and intelligence

- [ ] Add double-entry-friendly immutable money ledger and settlement lifecycle.
- [ ] Add accurate margin, cash-flow, receivable/payable, attribution, cohort, RFM,
  inventory health, courier scorecard, and team performance reports.
- [ ] Add scheduled reports, exports, owner digest, and metric definitions.

Exit gate: dashboard/report totals reconcile to source ledgers and have drill-down.

### Phase 6 — automation, billing, and launch

- [ ] Add audited workflow automation and approval policies.
- [ ] Add plan limits, metering, billing lifecycle, onboarding, and trial state.
- [ ] Add public API keys/webhooks, documentation, data export/deletion tools.
- [ ] Complete security review, accessibility review, restore test, load test,
  monitoring alerts, runbooks, and staged rollout.

Exit gate: production launch checklist passes with rollback and support ownership.

## 10. Definition of done for every slice

A feature is not done until it has:

- Confirmed user outcome and permission rules.
- Typed request/response contract and boundary validation.
- Tenant-safe queries and required indexes.
- Loading, empty, error, retry, offline/timeout, and small-screen states.
- Audit events for sensitive changes and observable logs without secrets.
- Unit/integration coverage plus a critical-path E2E test where appropriate.
- Migration/rollback notes, updated documentation, and verified production build.
- No unresolved P0/P1 accessibility or security issue.

## 11. Decision gates before disruptive migrations

The following decisions must be explicit before Phase 2 schema migration:

1. True multi-tenant SaaS versus single-company deployment with tenant-ready data.
2. Hosting region/provider and managed PostgreSQL/Redis/object-storage services.
3. Subscription plans, usage meters, and payment provider.
4. Required data retention, invoice/tax rules, and Bangladesh compliance needs.
5. Expected 12-month peak orders/day, stores/organization, concurrent operators,
   webhook rate, and message volume.
