import { z } from 'zod';
import type { BuilderNode, PageDocument } from './schema';

export const loopQuerySchema = z.object({ provider: z.enum(['products', 'pages']), limit: z.number().int().min(1).max(24), search: z.string().max(100), category: z.string().max(100), sort: z.enum(['newest', 'oldest', 'title']) }).strict();
export type LoopQuery = z.infer<typeof loopQuerySchema>;
export type LoopItem = { title: string; excerpt: string; image: string; url: string; price: string; sku: string; category: string };
export type LoopData = Record<string, LoopItem[]>;
export function documentLoops(doc: PageDocument): Array<{ id: string; query: LoopQuery }> {
  const loops: Array<{ id: string; query: LoopQuery }> = []; let cost = 0;
  const walk = (nodes: BuilderNode[], multiplier = 1, inLoop = false, componentChain: string[] = []) => {
    for (const node of nodes) {
      cost += multiplier; if (cost > 10000) throw new Error('Loop expansion exceeds the 10,000 element render budget');
      if (inLoop && (node.type === 'form' || node.attributes.id)) throw new Error('Repeated items cannot contain forms or fixed HTML IDs');
      let factor = multiplier; let nested = inLoop;
      if (node.type === 'loop') {
        if (inLoop) throw new Error('Nested loops are not supported');
        const query = loopQuerySchema.parse({ provider: node.props.provider, limit: node.props.limit, search: node.props.search, category: node.props.category, sort: node.props.sort });
        loops.push({ id: node.id, query }); factor *= query.limit; nested = true;
      }
      if (node.type === 'component') {
        const key = String(node.props.component);
        if (componentChain.includes(key) || componentChain.length > 16) throw new Error('Circular component reference');
        if (doc.components[key]) walk(doc.components[key].nodes, factor, nested, [...componentChain, key]);
      }
      walk(node.children, factor, nested, componentChain);
    }
  };
  walk(doc.rootNodes);
  if (loops.length > 5 || loops.reduce((total, loop) => total + loop.query.limit, 0) > 100) throw new Error('Use at most five loops and 100 queried items per page');
  return loops;
}
