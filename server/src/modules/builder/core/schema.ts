import { z } from 'zod';
import { hasControlCharacters, safeCssValue, safeCustomCss, states, styleProperties } from './styles';

export const identifier = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/);
export const safeUrl = (value: string) => value === '' || (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(value) && !hasControlCharacters(value) && !/[\s<>"'\\]/.test(value));
const scalar = z.union([z.string().max(50000), z.number().finite(), z.boolean(), z.array(z.any()), z.record(z.string(), z.any())]);

export const stylesSchema = z.record(z.string().refine(key => styleProperties.has(key), 'Unsupported CSS property'), z.string().refine(safeCssValue, 'Unsafe CSS value'));
const responsiveSchema = z.record(identifier, stylesSchema);
const statesSchema = z.record(z.enum(states), stylesSchema);

export const shapeDividerSchema = z.object({
  type: z.string().max(50),
  color: z.string().max(100).refine(safeCssValue, 'Unsafe shape color').optional(),
  height: z.union([z.string().refine(safeCssValue, 'Unsafe shape height'), z.number().finite().min(0).max(2560)]).optional(),
  flip: z.boolean().optional(),
  invert: z.boolean().optional(),
  bringToFront: z.boolean().optional()
}).strict();

export const appearanceSchema = z.object({
  styles: stylesSchema,
  responsiveStyles: responsiveSchema,
  states: statesSchema,
  shapeDividers: z.object({
    top: shapeDividerSchema.optional(),
    bottom: shapeDividerSchema.optional()
  }).optional(),
  // Advanced controls hold widget-specific JSON whose shape varies by widget.
  advanced: z.record(z.string(), z.any()).refine(value => value.customCss === undefined || safeCustomCss(value.customCss), 'Unsafe custom CSS').optional()
});

export type Appearance = z.infer<typeof appearanceSchema>;

export interface BuilderNode extends Appearance {
  id: string;
  type: string;
  version: number;
  name: string;
  // Props are validated against their widget definitions at render time.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any>;
  attributes: Record<string, string>;
  classes: string[];
  bindings: Record<string, string>;
  children: BuilderNode[];
  locked: boolean;
  hidden: boolean;
}

const nodeSchema: z.ZodType<BuilderNode> = z.lazy(() => appearanceSchema.extend({
  id: z.string().uuid(),
  type: identifier,
  version: z.number().int().min(1).max(100),
  name: z.string().max(120),
  props: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/), scalar),
  attributes: z.record(z.string().regex(/^(id|title|role|target|rel|aria-[a-z-]+|data-[a-z-]+)$/).refine(key => !key.startsWith('data-builder-')), z.string().max(2000)),
  classes: z.array(identifier).max(30),
  bindings: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/), z.string().regex(/^(page\.(title|slug)|site\.(name)|date\.(year)|item\.(title|excerpt|image|url|price|sku|category)|product\.(title|price|regularPrice|sku))$/)),
  children: z.array(nodeSchema).max(1000),
  locked: z.boolean(),
  hidden: z.boolean(),
}).strict());

export const documentSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  seo: z.object({ title: z.string().max(160), description: z.string().max(320), noindex: z.boolean() }).strict(),
  settings: z.object({ lang: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/), direction: z.enum(['ltr', 'rtl']) }).strict(),
  breakpoints: z.array(z.object({ id: identifier, label: z.string().min(1).max(40), maxWidth: z.number().int().min(240).max(2560) }).strict()).max(10),
  tokens: z.record(identifier, z.string().refine(safeCssValue, 'Unsafe token value')),
  classes: z.record(identifier, appearanceSchema.strict()),
  components: z.record(identifier, z.object({ name: z.string().min(1).max(120), nodes: z.array(nodeSchema).max(1000) }).strict()),
  rootNodes: z.array(nodeSchema).max(1000),
}).strict();

export type PageDocument = z.infer<typeof documentSchema>;

export function emptyDocument(title = 'Untitled page', slug = 'untitled'): PageDocument {
  return {
    schemaVersion: 1,
    title,
    slug,
    seo: { title: '', description: '', noindex: false },
    settings: { lang: 'en', direction: 'ltr' },
    breakpoints: [
      { id: 'tablet', label: 'Tablet', maxWidth: 1024 },
      { id: 'mobile', label: 'Mobile', maxWidth: 640 }
    ],
    tokens: {
      'brand-primary': '#176b53',
      'brand-secondary': '#d78d2c',
      'text-primary': '#172d28',
      'spacing-md': '24px'
    },
    classes: {},
    components: {},
    rootNodes: []
  };
}

export function parseDocument(input: unknown): PageDocument {
  if (JSON.stringify(input).length > 2000000) throw new Error('Document exceeds 2 MB');
  const queue: Array<[unknown, number]> = [[input, 0]];
  let visited = 0;
  while (queue.length) {
    const [value, depth] = queue.pop()!;
    if (depth > 100 || ++visited > 100000) throw new Error('Document exceeds complexity limits');
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe object key');
        if (child && typeof child === 'object') queue.push([child, depth + 1]);
      }
    }
  }
  const doc = documentSchema.parse(input);
  const ids = new Set<string>();
  let count = 0;
  const bp = new Set(doc.breakpoints.map(b => b.id));
  if (bp.size !== doc.breakpoints.length || new Set(doc.breakpoints.map(b => b.maxWidth)).size !== bp.size || bp.has('desktop')) {
    throw new Error('Breakpoints must have unique names and widths');
  }
  const checkAppearance = (a: Appearance) => {
    for (const key of Object.keys(a.responsiveStyles)) {
      if (!bp.has(key)) throw new Error(`Unknown breakpoint: ${key}`);
    }
  };
  const walk = (nodes: BuilderNode[], depth: number) => {
    if (depth > 32) throw new Error('Maximum node depth is 32');
    for (const node of nodes) {
      if (++count > 2000 || ids.has(node.id)) throw new Error('Too many nodes or duplicate UUID');
      ids.add(node.id);
      checkAppearance(node);
      if (node.classes.some(name => !Object.prototype.hasOwnProperty.call(doc.classes, name))) throw new Error('Unknown global class');
      walk(node.children, depth + 1);
    }
  };
  walk(doc.rootNodes, 0);
  Object.values(doc.classes).forEach(checkAppearance);
  for (const component of Object.values(doc.components)) walk(component.nodes, 0);
  const expand = (nodes: BuilderNode[], chain: string[], budget: { count: number }) => {
    for (const node of nodes) {
      if (++budget.count > 5000 || chain.length > 16) throw new Error('Component expansion limit exceeded');
      if (node.type === 'component') {
        const key = String(node.props.component || '');
        if (!Object.prototype.hasOwnProperty.call(doc.components, key)) throw new Error('Missing component');
        if (chain.includes(key)) throw new Error('Circular component reference');
        expand(doc.components[key].nodes, [...chain, key], budget);
      }
      expand(node.children, chain, budget);
    }
  };
  expand(doc.rootNodes, [], { count: 0 });
  for (const [key, component] of Object.entries(doc.components)) expand(component.nodes, [key], { count: 0 });
  return doc;
}
