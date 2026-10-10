# Studio document and persistence model

`core/schema.ts` is the authoritative schema. Documents are JSON, not HTML blobs.
Each node has a UUID, independent widget type/version, name, scalar props, safe
attributes, styles, breakpoint overrides, pseudo states, ordered class keys,
allowlisted dynamic bindings, children, lock state and visibility. Editor selection,
hover, zoom, panel state and undo history are never persisted in the document.

Schema version 1 supports title, slug, SEO title/description/noindex, language,
direction, custom breakpoints, tokens, classes and component masters. Document
validation rejects duplicate node UUIDs, unknown class/breakpoint references,
component cycles, unsupported versions and prototype keys. Limits: 800 KB of JSON
text, 2,000 stored nodes, depth 32, 5,000 expanded nodes and 16 component levels.
The Express request ceiling is additionally 1 MB.

## Storage

BuilderPage holds the working draft, immutable published snapshot, independently
published slug, current integer version, published version and author IDs.
BuilderRevision records each create/save/publish/unpublish/restore with full
document, version, author ID/name, action and timestamp. BuilderTemplate holds
reusable complete document snapshots. These models do not alter StorePage.

BuilderSubmission holds a signed-request UUID, page/form identity, published
version, form name, validated field values, review status and timestamps. Indexes
cover page/date and page/form/status. It stores no IP address or user-agent.
Migration 002 adds this table. Deleting a page cascades its submissions; the UI
does not expose page deletion in this milestone.

BuilderTheme is a singleton with separately versioned draft and published
snapshots. Its JSON schema contains bounded header/footer rules: UUID, referenced
page UUID, include/exclude `/b/` route globs and priority. BuilderThemeRevision
stores immutable snapshots for save, publish and restore actions. Migration 003
adds both tables. Publishing checks that each referenced page has a published
snapshot; later edits to that page do not affect public output until the page is
published. Unpublishing a referenced page causes that region to be skipped.

BuilderLanding links one StorePage to one BuilderPage using unique IDs and
foreign keys (migration 004). It stores no duplicate checkout data. Deleting
either page cascades the link; the other page is retained. A connected builder
draft never changes the public landing page. When its published snapshot is
removed, the storefront uses the StorePage legacy design again.

Every mutation checks a positive baseVersion. Inside one Prisma transaction,
updateMany compares id + version and increments it, then inserts a revision.
Concurrent writes cannot silently overwrite each other. Unique indexes enforce
draft and public URLs and page/revision versions. A draft URL change does not move
the published URL until publish. Restoring an old revision creates a new draft
version; it never rewinds version counters or silently changes the live snapshot.

Revisions are retained indefinitely in this milestone. The UI/API return the most
recent 100; configurable retention and archival must precede high-volume rollout.
The page and template lists are bounded at 200 and currently have no pagination UI.

## Migration contract

`migrateDocument` rejects future formats, runs registered sequential migrations
for older supported formats, then widget migrations. There is no fictitious v0
migration: version 1 is the first supported format. Increase the current schema
version and register a tested transformation when introducing a breaking format.
Unknown removed widgets retain their JSON and show an editor fallback.

The SQL installer is additive and repeatable. It is not a replacement for a future
baseline of the existing Prisma schema. Back up the database before deployment;
run `npm --prefix server run prisma:generate` and `npm --prefix server run
builder:install`. Do not use migrate reset on the existing database.
