# Studio landing-page integration

## Existing contract

StorePage `flow-*` records own the public `/:slug` URL, status/active flag,
SEO metadata, coupon relation and the checkout block. The storefront React
checkout owns product/variant selection, shipping, payment, analytics and order
submission. Those business rules remain authoritative.

Legacy `/flow/:slug` links redirect to `/:slug`. The database `flow-*` prefix
remains internal so existing records and checkout integrations need no migration.

## Design ownership

An additive BuilderLanding link pairs one StorePage with one BuilderPage. The
BuilderPage document owns the visual content above checkout. Existing StorePage
blocks remain stored as a rollback source. Until a linked BuilderPage has a
published snapshot, the storefront shows the legacy blocks. After publishing,
the storefront fetches the sanitized server-rendered Studio fragment and scoped
CSS, then places it before the existing checkout block. A StorePage that is
draft, inactive or trashed never exposes its Studio design publicly.

The admin Landing pages manager lists both modes. Staff can connect an existing
landing page to Studio, or create a new landing page paired with a Studio draft.
Studio handles design revisions and publishing; the existing checkout workspace
continues to configure products, coupons and payment. The page manager shows
both publication states and direct links to each workspace.
Duplicating a linked landing page copies both its checkout configuration and
Studio draft into a new unpublished pair with fresh IDs. Coupons remain tied to
the original page and are not copied.
Permanently deleting a linked StorePage also deletes its paired BuilderPage in
one transaction; moving it to Trash leaves the design recoverable but private.

## Conversion and rollback

Connecting an existing page creates a Studio draft from supported legacy
sections, including countdown, video and size chart. The conversion never changes
the live page or deletes its blocks. Older Studio drafts can import missing
dynamic sections from the Studio warning banner without replacing edited nodes.
Sections that cannot be converted remain in the backup and are reported to staff
for review. Publishing
Studio design switches only the visual sections;
checkout logic remains intact. Unpublishing the BuilderPage restores the legacy
visual sections automatically. Duplicate connections are idempotent.

## Safety and release checks

Only published BuilderPage snapshots render publicly, through the same
validated/escaped renderer used by `/b/:slug`. The fragment endpoint returns no
editor code and checks the StorePage status. Save/publish continue to use
optimistic versions and immutable revisions. Tests cover existing landing-page
fallback, connected draft isolation, published design with live checkout,
unpublish rollback, inactive/trashed pages, and conversion behavior.
