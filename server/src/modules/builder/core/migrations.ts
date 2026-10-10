import { parseDocument, type PageDocument } from './schema';
import { widgets } from './registry';

export type Migration = (document: unknown) => unknown;
const migrations = new Map<number, Migration>();
export function registerMigration(fromVersion: number, migration: Migration) {
  if (migrations.has(fromVersion)) throw new Error('Migration already registered');
  migrations.set(fromVersion, migration);
}
export function migrateDocument(input: unknown): PageDocument {
  if (!input || typeof input !== 'object') throw new Error('Invalid document');
  let version = Number((input as { schemaVersion?: unknown }).schemaVersion);
  if (!Number.isInteger(version) || version < 1 || version > 1) throw new Error('Unsupported document schema version');
  while (version < 1) {
    const migrate = migrations.get(version);
    if (!migrate) throw new Error('Missing schema migration');
    input = migrate(input); version++;
  }
  const document = parseDocument(input);
  const visit = (nodes: PageDocument['rootNodes']): PageDocument['rootNodes'] => nodes.map(node => {
    // Imported Elementor-style layout props belong to the shared Style controls.
    if (node.type === 'flex') {
      for (const [prop, style] of Object.entries({ direction: 'flex-direction', justify: 'justify-content', align: 'align-items', wrap: 'flex-wrap', gap: 'gap' })) {
        const value = node.props[prop];
        if (value !== undefined) {
          if (node.styles[style] === undefined) node.styles[style] = typeof value === 'number' ? `${value}px` : String(value);
          delete node.props[prop];
        }
      }
    }
    const widget = widgets.get(node.type);
    if (widget && node.version < widget.version) {
      if (!widget.migrate) throw new Error('Missing widget migration');
      node = widget.migrate(node);
      if (node.version !== widget.version) throw new Error('Widget migration did not reach current version');
    }
    return { ...node, children: visit(node.children) };
  });
  document.rootNodes = visit(document.rootNodes);
  for (const component of Object.values(document.components)) component.nodes = visit(component.nodes);
  return parseDocument(document);
}
