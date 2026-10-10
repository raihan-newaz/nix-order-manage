# Storefront, admin and builder review — 2026-09-28

## Changes

- Product URLs now have a persisted, unique, editable slug. The editor sends it to the inventory API, and the storefront resolves it. Existing products received slugs through an additive migration. Product editor typography uses regular weights.
- Product input validates prices, quantities and variation IDs. Parent and variation changes now share a transaction: a duplicate URL cannot leave variation stock partially updated. Saving a simple product with an empty variations list preserves its submitted stock.
- Admin HTTP and Socket.IO authentication explicitly accept HS256 staff tokens and reject customer tokens. Account responses disable caching; asynchronous account routes forward errors to Express.
- Builder custom CSS and shape attributes reject injection patterns; storefront settings validate navigation URLs. General settings updates cannot overwrite privileged tracking secrets.
- Landing checkout rejects invalid variation IDs and does not demand global custom fields absent from its form.
- Landing pages have linked, editable Thank You documents. Existing broken Borka Thank You content was preserved in revision history and repaired. Studio links between landing and Thank You editors. Order receipts must match the requested order and landing; payment return routing uses verified payment results.
- Checkout labels and footer copy are editable in checkout settings. A builder footer, when present, renders after checkout. Imported flex properties migrate into supported styles; media controls are exposed in the widget editor.
- A temporary API/database failure no longer appears as a false “Page not found”; the dynamic page route offers Retry.

## Verification

- Builder regression suite: 71 passed, 0 failed, including CSS/shape injection, product validation and generated Thank You coverage.
- Server, admin client and storefront production builds passed. Storefront rebuilt after the retry-state change.
- Catalog integration check passed using isolated draft fixtures: create, slug edit, simple stock retention, invalid stock rejection, duplicate URL rejection and transaction rollback. Fixtures were cleaned up.
- Anonymous HTTP checks on 72 protected GET routes returned 401.
- Static admin linkage review compared 219 literal API calls with 197 route declarations; the two dynamic-path candidates resolved to declared routes. This is not a claim that every authenticated business workflow was exercised.
- Production dependency audit (`npm audit --omit=dev`) reported zero known vulnerabilities for server, client and storefront at review time.
- Latest database validation: all 57 stored draft/published builder documents rendered; 14 landing records have a paired Thank You page.
- The currently published Borka design uses nine supported widget types: container, text, button, image, badge, heading, paragraph, offer-price and HTML. Earlier imported carousel/video/flex widgets also remain registered.
- Browser: Borka rendered, Order CTA moved to checkout, and selecting Jet Black updated the selected variation.
- At a 390px viewport, document width stayed 390px; checkout had 10px outer margins; billing inputs and textarea computed to 16px, with visible inner padding. Evidence: `borka-mobile-audit.png`.
- Local API, admin, storefront and existing XAMPP database were restarted after they had stopped. The database outage exposed the false-404 issue above.

## Repeating database setup on another installation

Back up the target database before deployment. From `server`, run `npm run prisma:generate`, `npm run catalog:install-slugs`, and `npm run builder:install-thank-you`, then build and restart the application. The two installation scripts are additive/idempotent; do not replace an existing database with seed data. They have already been applied locally.

## Limits

This review does not certify the entire application free of security issues. No real purchase, gateway payment, courier dispatch, SMS or email was sent. Authenticated admin workflows and real iPhone Safari interactions were not fully exercised; mobile rendering was checked in the in-app browser. Changing a product slug changes its canonical URL; automatic historical-slug redirects are not implemented. Deployment outside localhost was not performed.
