# Studio portable documents

The current package format is JSON:

```json
{ "format": "nix-studio", "version": 1, "document": { "schemaVersion": 1 } }
```

The document example above is abbreviated; use Page settings → Export document
to get the complete validated structure. Export includes nodes, local and shared
styles, variables, classes, components, breakpoints and page settings. Media are
URL references, not binary attachments. No staff credentials or revisions are
included. Import rejects unsupported manifests and files larger than 1 MB and
runs the same schema/renderer validation before entering editor history.

Import preserves the destination title and slug, replaces its draft content, and
is undoable. The published snapshot is unchanged until an authorized publish.
Previous saved versions remain available in History. Export local work before
reloading after a concurrency conflict. Templates are persisted on the server;
using a template creates an independent draft, not a live link to its source.

Cross-site media remapping, ZIP website kits, site settings, theme templates and
full-site backup/restore are not implemented. Do not treat document export as a
database or media backup. Element clipboard currently supports copies within the
open editor; it does not yet transfer dependent resources across pages.
