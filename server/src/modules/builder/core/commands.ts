import { type BuilderNode, type PageDocument, parseDocument } from './schema';
import { createNode, validateWidget, widgets } from './registry';
import { documentForms } from './forms';
import { documentLoops } from './loops';

export function findNode(nodes: BuilderNode[], id: string): BuilderNode | undefined {
  for (const node of nodes) { if (node.id === id) return node; const found = findNode(node.children, id); if (found) return found; }
}
export function locateNode(nodes: BuilderNode[], id: string): { siblings: BuilderNode[]; index: number } | undefined {
  const index = nodes.findIndex(node => node.id === id);
  if (index >= 0) return { siblings: nodes, index };
  for (const node of nodes) { const found = locateNode(node.children, id); if (found) return found; }
}
export function parentOf(nodes: BuilderNode[], id: string, parentId?: string): { parentId?: string; index: number } | undefined {
  for (let index = 0; index < nodes.length; index++) {
    if (nodes[index].id === id) return { parentId, index };
    const found = parentOf(nodes[index].children, id, nodes[index].id); if (found) return found;
  }
}
export function cloneNode(node: BuilderNode): BuilderNode {
  const id = globalThis.crypto.randomUUID();
  return { ...structuredClone(node), id, props: { ...node.props, ...(node.type === 'form-field' ? { fieldName: `${String(node.props.fieldName).slice(0, 30)}_${id.slice(0, 8)}` } : {}) }, children: node.children.map(cloneNode) };
}
export type Command =
  | { type: 'insert'; node: BuilderNode; parentId?: string; index?: number }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string }
  | { type: 'move'; id: string; parentId?: string; index?: number }
  | { type: 'update'; id: string; patch: Partial<Omit<BuilderNode, 'id' | 'type' | 'children' | 'version'>> }
  | { type: 'document'; patch: Partial<Omit<PageDocument, 'schemaVersion' | 'rootNodes'>> }
  | { type: 'replace'; document: PageDocument }
  | { type: 'component'; id: string; key: string; name: string }
  | { type: 'detach'; id: string }
  | { type: 'wrap'; id: string }
  | { type: 'unwrap'; id: string };
function assertUnlocked(nodes: BuilderNode[], id: string): void {
  for (const node of nodes) {
    if (node.id === id || findNode(node.children, id)) {
      if (node.locked) throw new Error('Unlock the element or its parent first');
      if (node.id !== id) assertUnlocked(node.children, id);
      return;
    }
  }
}
export function execute(document: PageDocument, command: Command): PageDocument {
  const validate = (value: PageDocument) => {
    const parsed = parseDocument(value);
    const walk = (nodes: BuilderNode[]) => { for (const node of nodes) { validateWidget(node); walk(node.children); } };
    walk(parsed.rootNodes); Object.values(parsed.components).forEach(component => walk(component.nodes));
    documentForms(parsed);
    documentLoops(parsed);
    return parsed;
  };
  if (command.type === 'replace') return validate(command.document);
  const draft = structuredClone(document);
  const destination = (parentId?: string) => {
    if (!parentId) return draft.rootNodes;
    const parent = findNode(draft.rootNodes, parentId);
    if (!parent || !widgets.get(parent.type)?.children) throw new Error('Choose a container');
    assertUnlocked(draft.rootNodes, parentId); return parent.children;
  };
  if (command.type === 'document') Object.assign(draft, command.patch);
  else if (command.type === 'insert') {
    const children = destination(command.parentId); children.splice(command.index ?? children.length, 0, command.node);
  } else {
    const place = locateNode(draft.rootNodes, command.id);
    if (!place) throw new Error('Element no longer exists');
    const node = place.siblings[place.index];
    if (!(command.type === 'update' && Object.keys(command.patch).length === 1 && command.patch.locked === false)) assertUnlocked(draft.rootNodes, command.id);
    if (command.type === 'remove') place.siblings.splice(place.index, 1);
    if (command.type === 'duplicate') place.siblings.splice(place.index + 1, 0, cloneNode(node));
    if (command.type === 'update') Object.assign(node, command.patch);
    if (command.type === 'move') {
      if (command.parentId === node.id || (command.parentId && findNode(node.children, command.parentId))) throw new Error('Cannot move an element inside itself');
      const children = destination(command.parentId);
      let index = command.index ?? children.length;
      if (children === place.siblings && place.index < index) index--;
      place.siblings.splice(place.index, 1); children.splice(Math.max(0, index), 0, node);
    }
    if (command.type === 'component') {
      if (Object.prototype.hasOwnProperty.call(draft.components, command.key)) throw new Error('Component key already exists');
      draft.components[command.key] = { name: command.name, nodes: [cloneNode(node)] };
      Object.assign(node, { type: 'component', name: command.name, props: { component: command.key }, children: [], styles: {}, responsiveStyles: {}, states: {}, classes: [], bindings: {} });
    }
    if (command.type === 'detach') {
      const component = draft.components[String(node.props.component)];
      if (node.type !== 'component' || !component) throw new Error('Choose a component instance');
      Object.assign(node, { type: 'container', props: { tag: 'div' }, children: component.nodes.map(cloneNode) });
    }
    if (command.type === 'wrap') {
      const wrapper = createNode('container'); wrapper.children = [node];
      place.siblings.splice(place.index, 1, wrapper);
    }
    if (command.type === 'unwrap') {
      if (!widgets.get(node.type)?.children) throw new Error('Only containers can be unwrapped');
      place.siblings.splice(place.index, 1, ...node.children);
    }
  }
  return validate(draft);
}
export interface EditorHistory { present: PageDocument; past: PageDocument[]; future: PageDocument[]; group?: string; at?: number }
export function applyCommand(state: EditorHistory, command: Command, group?: string, now = Date.now()): EditorHistory {
  const present = execute(state.present, command);
  const coalesce = !!group && group === state.group && now - (state.at || 0) < 1000;
  return { present, past: coalesce ? state.past : [...state.past, state.present].slice(-50), future: [], group, at: now };
}
export function undo(state: EditorHistory): EditorHistory {
  if (!state.past.length) return state;
  return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future] };
}
export function redo(state: EditorHistory): EditorHistory {
  if (!state.future.length) return state;
  return { present: state.future[0], past: [...state.past, state.present].slice(-50), future: state.future.slice(1) };
}
