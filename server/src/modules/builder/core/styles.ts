export const styleGroups: Record<string, string[]> = {
  Layout: [
    'display', 'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content',
    'gap', 'row-gap', 'column-gap', 'flex-grow', 'flex-shrink', 'flex-basis', 'order', 'align-self',
    'grid-template-columns', 'grid-template-rows', 'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
    'grid-column', 'grid-row', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
    'justify-items', 'justify-self'
  ],
  Size: ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'aspect-ratio'],
  Spacing: [
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-inline', 'padding-inline', 'margin-block', 'padding-block'
  ],
  Typography: [
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'word-spacing', 'text-align', 'text-transform', 'text-decoration',
    'text-indent', 'white-space', 'word-break', 'overflow-wrap', 'text-overflow',
    'direction', 'color', 'text-shadow', '-webkit-text-stroke', 'text-stroke'
  ],
  Background: [
    'background', 'background-color', 'background-image', 'background-size',
    'background-position', 'background-repeat', 'background-attachment', 'background-blend-mode',
    'background-clip', '-webkit-background-clip'
  ],
  Border: [
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-width', 'border-style', 'border-color', 'border-radius',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
    'outline', 'outline-offset', 'outline-color', 'outline-style', 'outline-width'
  ],
  Position: [
    'position', 'top', 'right', 'bottom', 'left', 'inset', 'inset-inline-start', 'inset-inline-end',
    'z-index', 'overflow', 'overflow-x', 'overflow-y', 'object-fit', 'object-position', 'visibility', 'isolation'
  ],
  Effects: [
    'animation', 'opacity', 'box-shadow', 'filter', 'backdrop-filter', 'mix-blend-mode',
    'transform', 'transform-origin', 'transform-style', 'perspective',
    'transition', 'transition-property', 'transition-duration', 'transition-delay', 'transition-timing-function',
    'cursor', 'pointer-events', 'user-select', 'clip-path'
  ]
};

export const styleProperties = new Set(Object.values(styleGroups).flat());
export const hasControlCharacters = (value: string) => [...value].some(char => char.charCodeAt(0) < 32);

export function safeCustomCss(value: unknown): boolean {
  return typeof value === 'string' && value.length <= 20000
    && !/[<>\\\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
    && !/\/\*|\*\/|@import|@charset|url\s*\(|image-set\s*\(|expression\s*\(|javascript|behavior|-moz-binding/i.test(value);
}

// No CSS escapes, comments, script execution, or unsafe declaration injection.
export function safeCssValue(value: string): boolean {
  return value.length <= 800 && !hasControlCharacters(value) && !/[{};<>\\@]/.test(value)
    && !/\/\*|\*\/|url\s*\(|expression\s*\(|javascript|behavior|image-set\s*\(|-moz-binding/i.test(value);
}

export const states = ['hover', 'focus', 'focus-visible', 'active', 'disabled', 'checked'] as const;

export function tokenUsageCount(value: unknown, name: string): number {
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(name)) return 0;
  return (JSON.stringify(value).match(new RegExp(`var\\(\\s*--${name}(?=[\\s,)])`, 'g')) || []).length;
}
