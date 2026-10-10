# NIX Storefront — Architecture & Delivery Plan

Last updated: 2026-09-21  
Status: Phase S1 complete; Phase S2 planned

## Product goal

Build a conversion-focused fashion storefront connected to the existing NIX
admin, catalogue, variation inventory, customer, order, and audit system. The
storefront is independently deployable so customer traffic never downloads the
admin application.

## Architecture

```text
Customer browser -> Storefront CDN/app -> Public Storefront API
                                           |
                                      same Product,
                                      Variant, Customer,
                                      Order & Stock data
                                           |
Admin app <------------ authenticated Admin API + realtime order event
```

- `storefront/`: separate React/Vite app with route-level pages and plain CSS.
- `server/src/modules/storefront/`: public, rate-limited catalogue and COD order
  endpoints. Price, delivery charge, availability, and totals are authoritative
  on the server.
- Cart is local-first and persists in the browser; no account is required.
- Checkout initially supports Cash on Delivery only.
- Brand, contact details, navigation, delivery fees, and merchandising copy are
  centralized so the UI can be customized without rewriting components.

## Performance budget

- Independent storefront bundle; no admin charts, tables, or settings code.
- Initial JS target below 180 KB gzip and CSS below 30 KB gzip.
- Responsive images with lazy loading and fixed aspect ratios.
- Catalogue responses are pagination-ready and expose only public fields.
- Product/list pages cacheable; checkout/order creation is never cached.
- No heavy animation framework; motion uses CSS and respects reduced motion.
- Target Core Web Vitals: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on mid-range
  mobile and normal 4G after production image/CDN optimization.

## Checkout contract

1. Customer chooses an active in-stock variation.
2. Cart stores product/variation IDs and display data for responsiveness.
3. Checkout sends IDs, quantities, and customer delivery information only.
4. Server re-reads price and stock, calculates subtotal/delivery/COD total,
   creates/updates the customer, creates the order, and deducts stock in one
   transaction.
5. Admin receives the order in the existing `PENDING` queue.
6. Customer receives an order number and final server-calculated total.

## Delivery phases

### S1 — connected COD commerce MVP

- [x] Public catalogue and product detail API.
- [x] Transactional COD order endpoint with server-side totals and stock checks.
- [x] Home, catalogue, product, persistent cart, checkout, and success pages.
- [x] Variation selector and sold-out prevention.
- [x] Mobile-first header, trust content, delivery information, and empty/error
  states.
- [x] Build and isolated-database end-to-end API verification.

### S2 — full merchandising toolkit

- Category/collection/brand models, slugs, SEO metadata, menus, banners, product
  galleries, swatches, size guide, related products, coupons, reviews, wishlist,
  stock urgency, search suggestions, and admin-managed homepage sections.

### S3 — WooCommerce-grade operations

- Draft order recovery, abandoned checkout, returns/exchanges portal, customer
  accounts, shipment tracking, rule-based shipping, tax/invoice rules, analytics,
  Meta/Google events, sitemap/schema, consent, and headless CMS/page builder.

## Launch gates

- Prices and COD totals cannot be manipulated from the browser.
- Duplicate submissions are idempotent before production launch.
- Overselling tests pass on PostgreSQL with transactional inventory reservation.
- Rate limits, abuse/fraud checks, privacy policy, terms, returns policy, contact
  identity, production domain, image CDN, monitoring, backups, and accessibility
  review are complete.
