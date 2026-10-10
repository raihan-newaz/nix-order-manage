import { z } from 'zod';

const routePattern = z.string().regex(/^\/[a-z0-9/*-]*$/).min(2).max(120);
export const themeRuleSchema = z.object({
  id: z.string().uuid(), area: z.enum(['header', 'footer']), pageId: z.string().uuid(),
  include: z.array(routePattern).min(1).max(10), exclude: z.array(routePattern).max(10),
  priority: z.number().int().min(-100).max(100),
}).strict();
export const themeSchema = z.object({ schemaVersion: z.literal(1), rules: z.array(themeRuleSchema).max(100) }).strict();
export type ThemeDocument = z.infer<typeof themeSchema>;
export type ThemeRule = ThemeDocument['rules'][number];
export const emptyTheme = (): ThemeDocument => ({ schemaVersion: 1, rules: [] });
export function parseTheme(input: unknown): ThemeDocument {
  const document = themeSchema.parse(input);
  if (new Set(document.rules.map(rule => rule.id)).size !== document.rules.length) throw new Error('Theme rule IDs must be unique');
  return document;
}
export function matchesRoute(pattern: string, path: string) {
  const escaped = pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${escaped}$`).test(path);
}
export function selectThemeRule(document: ThemeDocument, area: ThemeRule['area'], path: string): ThemeRule | undefined {
  return document.rules.filter(rule => rule.area === area && rule.include.some(pattern => matchesRoute(pattern, path)) && !rule.exclude.some(pattern => matchesRoute(pattern, path)))
    .sort((left, right) => right.priority - left.priority || Math.max(...right.include.map(value => value.replace(/\*/g, '').length)) - Math.max(...left.include.map(value => value.replace(/\*/g, '').length)) || left.id.localeCompare(right.id))[0];
}
