export interface ShortcutActions { undo: () => void; redo: () => void; save: () => void; publish: () => void; copy: () => void; paste: () => void; duplicate: () => void; remove: () => void; deselect: () => void }
export const shortcutLabels = ['Ctrl/⌘ Z — Undo', 'Ctrl/⌘ Shift Z — Redo', 'Ctrl/⌘ S — Save draft', 'Ctrl/⌘ Shift S — Publish', 'Ctrl/⌘ C / V — Copy / paste element', 'Ctrl/⌘ D — Duplicate', 'Delete — Remove selection', 'Escape — Deselect'];
export function handleShortcut(event: KeyboardEvent, actions: ShortcutActions) {
  const target = event.target as HTMLElement | null;
  if (target?.closest?.('input,textarea,select,[contenteditable=true]')) return;
  const mod = event.ctrlKey || event.metaKey; const key = event.key.toLowerCase();
  let action: keyof ShortcutActions | undefined;
  if (mod && key === 'z') action = event.shiftKey ? 'redo' : 'undo';
  if (mod && key === 's') action = event.shiftKey ? 'publish' : 'save';
  if (mod && key === 'd') action = 'duplicate';
  if (mod && key === 'c') action = 'copy';
  if (mod && key === 'v') action = 'paste';
  if (!mod && ['delete', 'backspace'].includes(key)) action = 'remove';
  if (key === 'escape') action = 'deselect';
  if (action) { event.preventDefault(); actions[action](); }
}
