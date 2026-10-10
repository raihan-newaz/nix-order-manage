# NIX Studio development and milestone log

## Run

From the repository root:

```powershell
npm install
npm --prefix server install
npm --prefix client install
npm --prefix server run prisma:generate
npm --prefix server run builder:install
npm run dev:server
# In another terminal:
npm run dev:client
```

The existing MySQL database must be available with the configured DATABASE_URL.
Sign in with an existing authorized staff account, choose **Visual Studio**, create
a page, then open the fullscreen editor. Admin: `/builder`; editor:
`/builder/:id`; published page: `/b/:slug`. Preview uses the current staff session.

Click or drag elements from the palette. New elements enter the selected container
or the page root. Double-click plain text to edit and blur to commit. Layers supports
nested moves and keyboard-accessible up/down controls. Inspector exposes searchable
CSS properties; choose a device to create responsive overrides. Design manages
document variables, global classes, reusable components and custom breakpoints.
Save/autosave persists drafts; Publish updates the separate live snapshot.
For sales landing pages, open **Landing pages** and choose **Create in Studio**,
or choose **Design in Studio** on an existing landing page. Studio edits the
visual sections above checkout. The linked **Checkout settings** workspace
still manages products, coupon/payment options, public URL, SEO and activation.
Publish the checkout page with at least one active product, then publish the
Studio design. An unpublished Studio design leaves the legacy landing layout
visible; unpublishing Studio restores it.
On the page manager, **Manage site headers and footers** assigns published
builder pages to `/b/*` routes. Save the rules as a draft, then publish them.
Rules support include/exclude patterns and priority. Header/footer pages are
ordinary builder pages, so edit and publish their content in the same Studio.
The theme panel can preview saved draft rules against a selected page in an
authenticated, noindex tab before publishing.

## Validation commands

```powershell
npm run lint
npm run typecheck
npm run test:builder
npm run test:builder:e2e
npm run build:server
npm run build:client
npm run build:storefront
```

Lint applies to the new builder and migration installer, with strict no-any rules;
legacy files have no previous lint baseline. Typecheck covers the server and admin;
the storefront build performs its own TypeScript build. Unit tests use Node's test
runner and ts-node. Browser/API tests use Playwright with the installed Chrome
channel and actual local MySQL persistence. Test accounts have unique
`@builder-test.invalid` addresses; fixtures delete only their own users/pages,
templates and login audit entries. They do not seed or reset the application.

Playwright can start the development servers or reuse running ones. Avoid editing
server source during a browser run: nodemon will restart in-flight requests. Visual
baselines are generated using `npm run test:builder:e2e -- --update-snapshots` and
should be reviewed before accepting them. Never regenerate baselines merely to
hide an unexplained regression. Browser artifacts are in ignored `test-results`.

## Delivered milestone: integrated authoring foundation

- Repository audit and seven architecture/developer documents.
- Versioned JSON schema, guarded migrations, Widget SDK and Control SDK.
- Escaped semantic renderer, deterministic scoped CSS and lean server-rendered pages.
- Nested Flexbox/Grid, common media/text/layout widgets, native nested accordion.
- Isolated iframe editor, selection, inline text, drag/drop, navigator and shortcuts.
- Central commands, grouped bounded history, copy/paste/duplicate, lock/hide,
  wrap/unwrap and reset styles.
- Searchable style groups, responsive inheritance, custom breakpoints and base pseudo states.
- Document tokens/classes/components, detach/master replacement and templates.
- Real database persistence, draft/live separation, autosave, conflict recovery,
  versioned revisions, restore, preview, publish and unpublish.
- JSON export/import, SEO metadata, RTL, semantic container controls and basic
  image-alt/heading warnings.
- Server capabilities, schema/URL/CSS protection, CSP, resource budgets and tests.

## Delivered follow-on milestone: forms and access management

- Super-admin capability management with concurrent-update protection and audit
  records; effective builder access feeds existing sidebar/routing authorization.
- Live site-name binding from the existing StorefrontSettings record.
- Native form container, typed field and submit widgets with labels, required
  fields, numeric bounds, select options and plain-text defaults.
- Signed expiring sessions, origin checks, honeypot/rate limits, idempotent storage
  and server validation against the published form definition.
- Responses panel with search, status filters, review, pagination, deletion and
  CSV export (up to 1,000 matching submissions per export).
- `002_submissions.sql` adds BuilderSubmission; the installer runs both additive,
  repeatable migrations in order. Existing application data is preserved.

Forms currently submit through native POST and show a standalone receipt. Draft
previews disable submission. Form-bearing component masters are intentionally
rejected until form instance IDs can be represented safely. Passwords, uploads,
arbitrary regex, multi-step/conditional fields, emails, webhooks and external
redirect actions are not exposed. Public form pages contain no JavaScript.

## Delivered follow-on milestone: dynamic listings

- Content loop widget with arbitrary nested item templates and safe `item.*`
  bindings for title, excerpt, image, URL, price, SKU and category.
- Public product and published StorePage providers, with real-data editor previews.
- Search/category/sort controls and limits of 24 records per loop, five loops,
  100 queried items and 10,000 expanded elements per page.
- Query validation and explicit Prisma public-field projections. Draft products,
  inactive pages, staff/customer data and product costs are never exposed.
- Dynamic public pages bypass static HTML caching, so source updates are visible
  without republishing the layout. No client runtime/hydration is required.
- Product/content links respect `BUILDER_STOREFRONT_ORIGIN` (development default:
  `http://localhost:3001`; production default: same public origin). Landing records
  use the clean `/:slug` route. Legacy `/flow/:slug` links redirect there; no
  commerce business logic was replaced.

Nested loops, forms inside loops, fixed HTML IDs inside repeated items, query
pagination, custom content types and user-defined data providers remain future
work. Addons register reviewed server provider code and extend the shared query
schema/catalog rather than accepting raw SQL or arbitrary field paths.

## Delivered follow-on milestone: route-based site templates

- A versioned theme-rule document assigns independently published builder pages
  as semantic header and footer regions for matching `/b/:slug` pages.
- Include/exclude route globs and explicit priority choose one template per
  region. Staff can save drafts, publish rules, and restore revisions.
- Each region has its own CSS scope. Runtime rendering uses published snapshots,
  including public dynamic loops and forms. Cache keys include the theme and
  referenced template versions; dynamic fragments bypass the static cache.
- A semantic navigation widget provides an accessible named menu with editable
  visual link children for header templates.
- `003_theme.sql` installs the singleton theme and immutable revision tables.
  Theme rules affect builder pages only. Existing storefront routes are unchanged.

## Delivered follow-on milestone: landing pages in Studio

- `004_landing.sql` links a StorePage landing record to a BuilderPage without
  changing or deleting existing StorePage rows.
- Landing pages can be created from the Landing pages manager or connected to
  Studio later. Existing supported legacy sections become editable Studio draft
  nodes, including countdown, video and size chart. Older Studio drafts can add
  missing dynamic sections without overwriting edits; all original blocks remain
  stored for rollback.
- The storefront `/:slug` keeps its existing React checkout and order logic.
  It places a published Studio fragment above checkout, or legacy sections when
  Studio is unpublished. Only active, published StorePage records expose the
  fragment. The public fragment API uses no-store to reflect rollback promptly.
- Studio links to checkout settings and shows the canonical landing URL. The
  existing landing editor links back to Studio and opens the checkout workspace
  for connected pages. Duplicating a linked landing copies its checkout settings
  and Studio draft into a new unpublished pair; coupons stay on the original.

## Verification record

The current builder unit/security suite has 63 passing tests. Lint, TypeScript
checks and all three application builds pass. The nine browser end-to-end tests
still need a refreshed run against the new Elementor-style editor: the latest
run passed two tests, while seven failed. Several old selectors and screenshot
baselines no longer match the redesigned UI; the dynamic catalog link assertion
also needs investigation. A subsequent targeted rerun hit the login rate limit
(HTTP 429). Browser coverage must pass again before release sign-off.

## Files and migration

New server code: `server/src/modules/builder/{core,tests}`, routes, service,
permissions, and `server/src/scripts/installBuilder.ts`. New admin code:
`client/src/builder`. New tooling: root ESLint/Playwright config, tests/builder,
root dependency lockfile. New SQL: `server/prisma/builder-migrations/001_builder.sql`
`002_submissions.sql`, `003_theme.sql` and `004_landing.sql`.

Modified integration points: Prisma schema and generated local client, server
route mounting/package scripts, auth profile's effective builder-access flag,
admin App/navigation/package scripts, both Vite proxies, server configuration
and its example environment, root scripts/dependencies and .gitignore. Existing StorePage records,
checkout/business modules and storefront page implementations are not migrated.

The additive SQL creates BuilderPage, BuilderRevision, BuilderTemplate,
BuilderSubmission, BuilderTheme, BuilderThemeRevision and BuilderLanding, including
unique URL/version and lookup indexes. No existing table is dropped or rewritten.
There is no Git metadata in the supplied directory, so git diff/commit verification
is unavailable; changes are inventoried here instead.

## Remaining milestones and limitations

This is a working integrated milestone, **not the complete production-grade parity
requested in the master brief**. The following still require implementation:

1. Advanced authoring: multiselect/context menus, richer accessible DnD,
   structured rich text, visual spacing/color/gradient controls, responsive pseudo
   states, full class/variable managers, browser crash recovery, large-document
   profiling/virtualization, comprehensive error recovery and editor accessibility.
2. Site resources: independently versioned site-wide variables/classes/components,
   exposed component props/slots/variants, additional route families and template
   types, site-kit import/export and backups, scheduling/private pages.
3. CMS/dynamic engine: custom types/fields/taxonomies, more registered query providers,
   listing pagination, safe user/route/query contexts and search templates.
   Current bindings cover page title/slug, site name, year and public listing items.
4. Marketing: multi-step and conditional form fields, richer validation, distributed
   spam defenses, controlled email/webhook actions, popup triggers and
   accessible generic interactions/runtime loading.
5. Widget breadth: tabs/carousels/galleries/menus/lightboxes, commercial product
   widgets and checkout/cart/account adapters, plus their accessibility tests.
6. Governance: content-only diff authorization, notes/collaboration,
   revision pagination/retention, granular auditing, trusted scoped custom code,
   safe media enhancements and asset usage tracking.
7. Production hardening: load/performance budgets, exhaustive security review,
   multi-browser/mobile/RTL/accessibility regression suites, deployment/proxy
   verification and operational backups. Production storefront hosting must forward
   `/b/*` to Express. No production deployment is performed by this milestone.

Only working widgets/controls are exposed. Unimplemented features do not appear as
dummy controls. The shared command/registry/document boundaries are intended for
the subsequent milestones; they should be extended rather than replaced.
