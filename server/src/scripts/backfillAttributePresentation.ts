import prisma from '../prisma';

const inferredColor = (name: string) => {
  const colors: Record<string, string> = {
    black: '#171717', white: '#ffffff', red: '#dc2626', blue: '#2563eb', navy: '#1e3a8a',
    green: '#15803d', yellow: '#eab308', pink: '#ec4899', purple: '#7e22ce', brown: '#7c4a2d',
    beige: '#d6c5a1', cream: '#f5f0dc', grey: '#808080', gray: '#808080', maroon: '#800000',
    terracotta: '#c65d3b', olive: '#737c32', charcoal: '#424242', tan: '#c19a6b',
  };
  return colors[name.trim().toLowerCase()];
};

async function main() {
  const attributes = await prisma.productAttribute.findMany();
  for (const attribute of attributes) {
    let terms: string[] = [];
    try { terms = JSON.parse(attribute.options); } catch { terms = []; }
    const name = attribute.name.trim().toLowerCase();
    const type = attribute.type !== 'TEXT' ? attribute.type : /^(color|colour)$/.test(name) ? 'COLOR'
      : name === 'size' ? (terms.length && terms.every((term) => /^\d+(\.\d+)?$/.test(term)) ? 'SIZE_NUMBER' : 'SIZE_TEXT') : attribute.type;
    if (type !== attribute.type) await prisma.productAttribute.update({ where: { id: attribute.id }, data: { type } });
    if (type === 'COLOR' && !attribute.optionColors) {
      const palette = Object.fromEntries(terms.map((term) => [term, inferredColor(term)]).filter((entry): entry is [string, string] => Boolean(entry[1])));
      if (Object.keys(palette).length) await prisma.productAttribute.update({ where: { id: attribute.id }, data: { optionColors: JSON.stringify(palette) } });
    }
  }

  const refreshed = await prisma.productAttribute.findMany();
  const byId = new Map(refreshed.map((attribute) => [attribute.id, attribute]));
  const byName = new Map(refreshed.map((attribute) => [attribute.name.trim().toLowerCase(), attribute]));
  const products = await prisma.product.findMany({ select: { id: true, attributes: true } });
  let updated = 0;
  for (const product of products) {
    let definitions: any[];
    try { definitions = JSON.parse(product.attributes || '[]'); } catch { continue; }
    if (!Array.isArray(definitions)) continue;
    const enriched = definitions.map((definition) => {
      const global = byId.get(definition.attributeId || definition.id) || byName.get(String(definition.name || '').trim().toLowerCase());
      const normalizedName = String(definition.name || '').trim().toLowerCase();
      const options = definition.options || definition.values || [];
      const inferredType = /^(color|colour)$/.test(normalizedName) ? 'COLOR' : normalizedName === 'size'
        ? (options.length && options.every((term: string) => /^\d+(\.\d+)?$/.test(term)) ? 'SIZE_NUMBER' : 'SIZE_TEXT') : 'TEXT';
      let globalColors: Record<string,string> = {};
      try { globalColors = global?.optionColors ? JSON.parse(global.optionColors) : {}; } catch { globalColors = {}; }
      const inferredColors = Object.fromEntries((options as string[]).map((term) => [term, inferredColor(term)]).filter((entry): entry is [string, string] => Boolean(entry[1])));
      return { ...definition, type: global?.type || definition.type || inferredType, displayStyle: global?.displayStyle || definition.displayStyle || 'SOFT', optionColors: { ...globalColors, ...inferredColors, ...(definition.optionColors || {}) } };
    });
    if (JSON.stringify(definitions) !== JSON.stringify(enriched)) {
      await prisma.product.update({ where: { id: product.id }, data: { attributes: JSON.stringify(enriched) } });
      updated += 1;
    }
  }
  console.log(`Backfilled attribute presentation metadata on ${updated} product(s).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
