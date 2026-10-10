# Unified Pages and Studio: code audit and implementation plan

## Decision

Use one Pages manager and Visual Studio as the only visual editor. Treat Landing page, Content page and System page as page types in that manager. A landing page has checkout enabled; a content page does not. Checkout is a settings panel inside Studio, using the existing order, product, coupon, shipping and payment services.

Target workflow: Pages → New page → choose page type → design in Studio → configure checkout if needed → Preview → Publish → copy live URL.

This document records the audit and rollout plan. The first phase below has been implemented without changing existing publication states.

## Implemented first phase

- `/pages` now lists landing, storefront content, and standalone Studio pages. New landing pages are created here. The sidebar has one Pages entry; previous landing list and edit URLs redirect to the manager or the linked Studio editor.
- Studio has Checkout settings for linked landings, including product selection, coupons, payment methods, page title, and SEO. Checkout changes save to `LandingCheckoutDraft` without changing the live StorePage.
- Publishing a linked Studio page validates its checkout and active products, then publishes the design and StorePage checkout/status in one database transaction. Unpublishing hides the whole landing. The old StorePage update/active endpoints reject linked pages so they cannot bypass this path.
- Existing content and system pages remain in their established editor and at their established public URLs. Their Studio conversion, unified preview, and retirement of the old content editor are still future work; the first phase does not claim those acceptance checks.

## Findings in the current code

| Finding | Source | Consequence |
| --- | --- | --- |
| Studio creation posts to `/builder/pages`; landing creation posts to `/builder/landings` | `client/src/builder/StudioPage.tsx`, `client/src/pages/LandingPagesPage.tsx` | Two creation paths produce different kinds of pages and URLs. |
| BuilderPage publication, StorePage status and StorePage isActive are independent | `server/src/modules/builder/service.ts`, `server/src/modules/storefront/storePageController.ts` | A card can say Published while its public route returns 404. |
| Studio Publish saves only the design | `client/src/builder/useStudio.ts` | Publishing in the modern editor does not make its linked checkout available. |
| Checkout Save draft writes status DRAFT to the same StorePage used by the storefront | `client/src/pages/LandingPagesPage.tsx` | Saving checkout changes as a draft can take a live landing offline. There is no independent checkout draft snapshot. |
| Unpublishing a BuilderPage clears its published design but does not unpublish its StorePage | `server/src/modules/builder/service.ts`, `storefront/src/LandingPage.tsx` | The old landing design can reappear instead of the whole page being unpublished. |
| Any design-fetch error falls back to legacy content | `storefront/src/LandingPage.tsx` | A server or rendering error can silently switch a migrated page back to its old layout. |
| Public rendering removes entire root sections containing Studio forms, but publishing rejects those forms | `server/src/modules/builder/routes.ts`, `service.ts` | An already connected page can render but fail its next publish; a mixed section can lose unrelated content. |
| Connecting an existing Studio page requires an active product ID hidden inside a form | `server/src/modules/builder/landingService.ts` | A normal modern page cannot enable checkout without a hidden-field workaround. |
| Pages has another independent block editor | `client/src/pages/StorePagesPage.tsx` | Staff must learn three editing surfaces. Content pages do not use Studio. |
| Pages, Visual Studio and Landing Pages have separate navigation entries | `client/src/components/layout/navigation.ts` | There is no obvious primary page management entry point. |
| StorePage preserves systemKey, aliases and coupon relations | `server/prisma/schema.prisma` | Deleting/recreating these records during consolidation risks existing URLs and relationships. |

## Product changes

### One Pages manager

- Keep `/pages` as the primary management route, with All, Landing, Content, System and Trash filters.
- Each row shows one effective publication state: Draft, Live, Live with unpublished changes, or Unpublished. Trash remains a separate lifecycle state.
- Actions: Edit in Studio, Preview, Copy URL, View live, Duplicate and Move to Trash. Show View live only for an actually live page.
- New page asks for title, public slug and type. Creating a landing automatically attaches an empty checkout draft; selecting a product happens through the normal product picker.
- Remove the separate Landing Pages and Visual Studio page-list entries after compatibility routes exist. Studio remains the editor, reachable from Edit in Studio.
- Keep Theme Customizer for site-wide settings; templates and theme design stay accessible within Studio.

### One editing workspace

Studio contains Design, Checkout (landing only), Page settings and History. Page settings owns the public URL and SEO. The internal BuilderPage slug must not compete with the public StorePage slug.

Extract the useful CheckoutSettings and checkout preview components out of LandingPagesPage.tsx. Remove the legacy visual canvas, section editor, add-section controls and separate Publish/Active controls from the normal editing path.

The canvas shows a managed checkout section with live product/shipping data and an Edit checkout action. The existing server-authoritative checkout handles actual orders. Generic Studio forms remain available on ordinary content pages, but cannot masquerade as checkout.

### One publication action

Publish validates and activates the complete page. Update publishes the latest complete revision. Unpublish makes the public page unavailable. Do not require a second Active checkbox to finish publishing.

Draft saves preserve the currently published page. A failed publish leaves the previous live revision intact. Preview renders design and checkout together without publishing; preview order submission is disabled unless an explicitly separate test-order workflow exists.

## Backend design

Retain StorePage IDs, public slugs, aliases, system keys and coupon/order relationships. Retain BuilderPage documents and revision history. Extend the existing one-to-one link to support content pages as well as landing pages; do not rebuild the page builder or commerce backend.

Introduce a versioned page draft/publication model for page metadata and checkout configuration. A published revision references the exact immutable Studio design revision plus checkout configuration and SEO. It must not reference a mutable draft or whichever design happened to be published most recently.

Unified publication service:

1. Check page-management and Studio publish permissions server-side.
2. Verify expected design and checkout/page versions to reject stale editors.
3. Validate the document, slug uniqueness/reserved routes and checkout product selection. Reuse existing product/payment validation. Product price, stock and coupon validity remain checked by the order service at submission time.
4. In one transaction, create the immutable publication revision, update the live pointer and mark the page published/active.
5. Return the effective state, revision and canonical live URL to refresh the editor and list immediately.

All publish/unpublish entry points for linked pages must call this service. Old management endpoints must not bypass it. Public rendering, coupon validation and order creation must resolve the same published checkout configuration. Otherwise separate draft storage alone will not solve the conflict.

For pages marked as migrated to Studio, design-render failure must be explicit and observable; never silently serve legacy blocks. Legacy fallback is permitted only for records still explicitly marked as legacy during migration.

## Existing Pages and migration

- Content pages such as About, FAQ, Privacy and Terms use Studio too, with the normal storefront header/footer and no checkout.
- Preserve existing system-page protections and systemKey mappings. Preserve URLs and aliases, including links used by checkout and storefront navigation.
- Add a content-page converter for TEXT, IMAGE, BUTTON and sanitized HTML blocks. The current landing converter is not a general content-page converter; unsupported content must be reported rather than discarded.
- Existing connected Studio pages retain their current documents. Do not re-import legacy blocks over edited designs.
- Before conversion, export a backup and generate a dry-run inventory: page ID, type, public URL, current live state, linked design, supported sections and conversion warnings.
- Convert legacy pages into Studio drafts and compare previews. Until conversion is accepted/published, their existing live output remains unchanged.
- Convert old checkout forms deliberately into the managed checkout section. Preserve surrounding content and fix `#order`/`#order-form` CTA targets; do not filter out an entire mixed root section.
- Preserve standalone `/b/:slug` pages and their URLs until assigned a canonical storefront URL. Redirect old URLs only after a working destination exists.
- Redirect `/landing-pages` to the Landing filter, `/builder` to the manager, old landing creation to the unified creation flow and legacy edit URLs to the corresponding Studio page/panel. Keep preview routes protected.
- Retire legacy editor code only after every old route has a replacement. Keep legacy data as a migration backup until separately approved for removal.

## Implementation order

1. Add draft/publication storage and the unified publication service, including storefront/order/coupon consumers. Preserve current live output during backfill.
2. Embed Checkout and Page settings in Studio; wire its Publish/Update/Unpublish to the unified service. Support enabling checkout without hidden form fields.
3. Build the unified Pages manager and creation flow; replace old navigation with compatibility redirects.
4. Add content/system-page conversion and migration reporting; migrate existing designs without overwriting Studio edits.
5. Retire legacy editor entry points and duplicate publication controls; document rollback and management behavior.

## Acceptance checks

- A new landing can be designed, assigned products and published from one workspace; its returned public URL loads design plus checkout.
- Saving a draft of a live page leaves its live design and checkout unchanged.
- Publishing with missing/inactive products or stale versions fails without partially changing the live page.
- Unpublish hides the whole page; it never restores legacy content automatically.
- Preview works for drafts and does not create orders or emit normal purchase events.
- Checkout, coupons, shipping, variants, prices and stock validation use the published configuration and existing commerce services.
- Existing public URLs, system pages, aliases, coupon relationships and existing Studio designs survive migration.
- Old admin URLs reach the correct new workspace. Ordinary content pages have no checkout; landing pages have exactly one managed checkout.
- Unauthorized roles cannot publish via either old or new endpoints.

## Scope of this audit

Reviewed the page creation/editing routes, both legacy editors, Studio list and publish hook, builder publication and landing conversion services, StorePage validation/public lookup, storefront landing rendering, navigation, permission checks and relevant Prisma models. No database migration or live page state change was performed for this audit.
