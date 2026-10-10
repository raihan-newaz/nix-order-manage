# NIX Studio architecture

## Repository audit (2026-09-27)

The repository has three independent TypeScript packages. `server` is Express 4,
Prisma 5, MySQL, Zod, Socket.IO, Helmet and express-rate-limit. `client` is the
React 18/Vite admin, React Router, Tailwind and Lucide. `storefront` is a separate
React 18/Vite application using plain CSS. TypeScript is strict in the server
and admin. The checked-in SQLite files are historical; the active Prisma
datasource is MySQL. No migration history, automated test suite, lint config,
Dockerfile, reverse proxy config or Git metadata was found during the audit.

Staff authentication uses HTTP-only cookies (or bearer tokens), JWT session
versions checked against User, and database roles. Cookie writes have an origin
check in server.ts. Existing roles include SUPER_ADMIN and OPERATIONS_MANAGER;
User.permissions is present but not consumed by the existing auth middleware.
Customer sessions are separate. Never use staff records as public dynamic data.

Existing StorePage stores structured blocks, including landing checkout content.
StorefrontSettings stores merchandising/theme preferences. MediaAsset supports
JPEG, PNG, GIF and WebP with magic-byte verification. Reuse uploads and media
selection; do not add an unsafe SVG upload path. Orders, inventory, coupons,
payments and courier modules remain the business-logic authority.

Admin routes /pages, /landing-pages, /theme-customizer and storefront routes must
remain intact. The server serves the admin build in production; the storefront
has its own deployment. Development Vite proxies /api and /uploads. There is no
existing shared package, server-side storefront renderer or document cache.

## Integration decision

Add `/builder` and `/builder/:id` in the admin. Add authenticated `/api/builder`
APIs and public, server-rendered `/b/:slug` pages, ahead of the admin SPA fallback.
This reserved namespace avoids replacing checkout, information and order routes.
Both Vite applications proxy /b in development. Production storefront hosting
must forward /b to Express to use the same public URLs.

Keep legacy StorePage unchanged: its checkout-oriented block model cannot safely
represent arbitrary nested visual documents. Add BuilderPage and BuilderRevision
with an additive, idempotent SQL installer because the existing database uses
db push and has no Prisma migration baseline. Never run migrate reset or reset a
production database. Revision writes and version compare-and-swap are atomic.

## Document and rendering architecture

Framework-independent core lives in `server/src/modules/builder/core`. The admin
imports only this pure core; it never imports Prisma, Express, secrets or auth.
Documents contain a schema version, stable UUID nodes, semantic props, styles,
responsive overrides, pseudo states, classes, tokens, reusable components and
breakpoints. Zod validation, depth/node budgets, safe property allowlists and
widget-specific validation precede persistence and rendering. Unknown widget
types survive serialization and receive a visible editor fallback.

The widget registry defines version, controls, defaults, child support and an
escaped HTML renderer. The Control SDK describes editable values independently
of React. A deterministic CSS compiler emits scoped node/class selectors,
token custom properties, descending max-width media queries and pseudo states.
Public output uses the same renderer as the iframe canvas. Public routes contain
no React, editor bundle or admin metadata. Native HTML widgets need no hydration.
Interactive extensions must supply an explicitly reviewed runtime adapter.

## Editor

An iframe isolates page styles. A command reducer owns persistent mutations and
bounded undo/redo history. Selection, hover, device width, panel state and status
are transient. Tree operations reject cycles and invalid parent placement.
Inspector controls are registry-driven; layout styling uses the shared property
catalog. Canvas and navigator share selection. All changes enter through commands,
providing a future AI/agent interface without exposing raw database writes.

Autosave is debounced and serialized. baseVersion is mandatory for every update,
publish and restore. Conflicts stop autosave and preserve local work for export.
Draft updates cannot change the published snapshot. Preview requires staff auth
and returns no-store/noindex. Publishing creates an immutable revision; restoring
creates a new draft revision and does not implicitly publish.

## Security model

Server-side builder capability checks use existing roles and explicit user
overrides. Default access: admins and operations managers; publish is separately
checked. Requests retain the application's cookie origin guard. No eval, arbitrary
scripts, raw HTML, arbitrary CSS, server-side URL fetching or ZIP extraction is
enabled by the foundation. Text/attributes are escaped; URLs and CSS are allowlisted.
Limits bound depth, bytes, nodes, revisions returned and API list sizes.

## Design and responsive model

Desktop is the base. Smaller max-width breakpoints inherit larger ones unless
overridden. Custom breakpoints are named, unique and bounded. Tokens compile to
CSS properties. Ordered global classes provide reusable declarations; local
styles win. Component masters resolve at render time, with cycle detection and
bounded expansion. Design resources are document-scoped initially; cross-page
site-wide resources require a separately versioned site release model to avoid
draft edits changing published pages accidentally.

## Versioning and delivery

Schema v1 is the first supported format. A migration registry advances one version
at a time and rejects future versions. Widget versions have explicit migrations.
Published documents remain immutable snapshots. Imports validate before entering
history and require an explicit save; older persisted revisions remain available.

Implement in coherent milestones: core/schema/rendering/persistence; visual editor
and styling; reusable design; CMS/theme/loops; forms/popups/interactions; ecommerce
adapters; full hardening. Track delivered versus pending work in
page-builder-development.md. The existence of an editor is not a parity claim.

## Forms milestone

Forms extend the same widget tree with a form container and typed field widgets.
The server discovers fields from the published snapshot, never from submitted
client metadata. Field keys are unique and bounded; nested forms and form-bearing
component masters are rejected until instance-specific form identity is supported.
Native HTML submission requires no editor or interaction bundle on the public page.

Each rendered form receives a short-lived HMAC token bound to page, form, published
version and a same-site random cookie, plus a unique submission ID. Form pages use
no-store responses. The POST handler checks origin, token, honeypot, limits and
field types, then stores an idempotent submission. No passwords, arbitrary regex,
uploads, external redirects or webhooks are accepted in this milestone. Submissions
use a dedicated capability and support review/status/deletion/CSV export. CSV
formula characters are neutralized. Broader form actions need separate adapters
and threat reviews before exposure in the editor.

## Dynamic listing milestone

A loop widget owns a bounded query and an arbitrary item template. A server-side
provider registry resolves only explicitly public fields from existing catalog
and published StorePage records. The editor requests the same context over an
authenticated endpoint, so its preview uses real records. Item bindings are fixed
property paths, never expressions or raw ORM input. Provider/category/search/sort
and limit are validated before queries; all queries use Prisma select/where maps.

Limits bound loops per document, records per loop and expanded rendering cost.
Nested loops, forms inside repeated items and fixed HTML IDs inside repeated items
are rejected initially. Dynamic pages bypass static HTML caching so changes to
catalog/content records appear without republishing a layout. Product links use
the existing storefront detail route; purchase/payment behavior remains owned by
the existing store. Publishing under the storefront origin requires its /b proxy.

## Route-based site templates

The theme is a separately versioned singleton document of ordered header/footer
rules. Each rule references a builder page and contains bounded include/exclude
`/b/` route globs plus an integer priority. The highest-priority matching rule
wins per region; specificity and stable UUID order break ties. Publishing requires
all referenced pages to have published snapshots. Saving and publishing use
optimistic base versions and immutable theme revisions.

The public renderer chooses rules against the requested builder-page route and
renders the selected published pages as semantic `header`/`footer` fragments.
Their CSS scopes differ from the main page and from each other. Cache keys cover
the theme version and referenced page versions; loops or forms in any fragment
disable static caching. Staff can preview saved theme drafts and referenced page
drafts through an authenticated, noindex endpoint. Theme rules currently apply
only to `/b/:slug`, preserving all existing storefront routes.

## Existing landing-page integration

The StorePage `flow-*` record remains the authority for `/:slug`, checkout,
products, coupons, payment and status. An additive BuilderLanding link pairs it
with a BuilderPage whose document owns only the visual content above checkout.
Connecting an existing page imports supported legacy sections into a draft and
keeps the old blocks for rollback. The storefront loads the published BuilderPage
as sanitized HTML plus scoped CSS; while it is unpublished, it renders the
legacy sections. The checkout React component is never replaced by builder HTML.
The fragment API requires the StorePage to be published and active and uses
`no-store`, so publish/unpublish changes become visible on refresh.
