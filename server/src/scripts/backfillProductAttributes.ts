import prisma from '../prisma';

type AttributeDefinition = { attributeId?: string; id?: string; name: string; options?: unknown; values?: unknown; visible?: boolean; variation?: boolean; [key: string]: unknown };

const canonicalName = (name: string) => {
  const clean = name.trim();
  if (/color|colour/i.test(clean)) return 'Color';
  if (/size/i.test(clean)) return 'Size';
  return clean;
};

const readObject = (value?: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};

const readDefinitions = (value?: string | null): AttributeDefinition[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item) => item && typeof item === 'object' && item.name).map((item) => ({ ...item, name: canonicalName(String(item.name)) }));
    if (parsed && typeof parsed === 'object') return Object.entries(parsed).map(([name, options]) => ({ name: canonicalName(name), options }));
  } catch { /* Keep malformed legacy metadata untouched outside this migration. */ }
  return [];
};

const readOptions = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : String(value).split(/[|,]/);
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const products = await prisma.product.findMany({ where: { variants: { some: {} } }, include: { variants: true } });
  const optionSets = new Map<string, Set<string>>();
  const productAttributes = new Map<string, AttributeDefinition[]>();
  const normalizedVariants = new Map<string, Array<{ id: string; attributes: Record<string, string>; color: string | null; size: string | null }>>();

  for (const product of products) {
    const activeVariants = product.variants.filter((variant) => variant.status !== 'ARCHIVED');
    const perProduct = new Map<string, Set<string>>();
    const normalized = product.variants.map((variant) => {
      const existing = readObject(variant.attributes);
      const attributes: Record<string, string> = {};
      for (const [rawName, rawValue] of Object.entries(existing)) {
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;
        attributes[canonicalName(rawName)] = String(rawValue).trim();
      }
      if (variant.color && !Object.keys(attributes).some((name) => name === 'Color')) attributes.Color = variant.color.trim();
      if (variant.size && !Object.keys(attributes).some((name) => name === 'Size')) attributes.Size = variant.size.trim();
      if (variant.status !== 'ARCHIVED') {
        for (const [name, value] of Object.entries(attributes)) {
          if (!perProduct.has(name)) perProduct.set(name, new Set());
          perProduct.get(name)!.add(value);
          if (!optionSets.has(name)) optionSets.set(name, new Set());
          optionSets.get(name)!.add(value);
        }
      }
      return {
        id: variant.id,
        attributes,
        color: attributes.Color || variant.color || null,
        size: attributes.Size || variant.size || null,
      };
    });

    // Preserve existing product-level attribute metadata and options, even if
    // the source variation record no longer contains all of its old terms.
    const currentDefinitions = readDefinitions(product.attributes);
    for (const definition of currentDefinitions) {
      const name = canonicalName(definition.name);
      if (!optionSets.has(name)) optionSets.set(name, new Set());
      for (const option of readOptions(definition.options ?? definition.values)) optionSets.get(name)!.add(option);
    }
    const definitionsByName = new Map(currentDefinitions.map((definition) => [canonicalName(definition.name).toLowerCase(), definition]));
    const merged = new Map<string, AttributeDefinition>();
    for (const [name, options] of perProduct) {
      const previous = definitionsByName.get(name.toLowerCase());
      merged.set(name.toLowerCase(), {
        ...previous,
        name,
        options: [...new Set([...readOptions(previous?.options ?? previous?.values), ...options])],
        visible: previous?.visible !== false,
        variation: previous?.variation !== false,
      });
    }
    for (const [key, definition] of definitionsByName) {
      if (!merged.has(key)) merged.set(key, { ...definition, name: canonicalName(definition.name), options: readOptions(definition.options ?? definition.values) });
    }
    productAttributes.set(product.id, [...merged.values()]);
    normalizedVariants.set(product.id, normalized);
  }

  await prisma.$transaction(async (tx) => {
    const globalAttributes = new Map<string, { id: string; name: string }>();
    for (const [name, options] of optionSets) {
      const slug = slugify(name);
      const saved = await tx.productAttribute.upsert({
        where: { name },
        update: { slug, options: JSON.stringify([...options].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) },
        create: { name, slug, options: JSON.stringify([...options].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) },
        select: { id: true, name: true },
      });
      globalAttributes.set(name.toLowerCase(), saved);
    }

    let updatedProducts = 0;
    let updatedVariants = 0;
    for (const product of products) {
      const definitions = (productAttributes.get(product.id) || []).map((definition) => {
        const attribute = globalAttributes.get(canonicalName(definition.name).toLowerCase());
        return attribute ? { ...definition, attributeId: attribute.id, name: attribute.name } : definition;
      });
      if (definitions.length) {
        await tx.product.update({ where: { id: product.id }, data: { attributes: JSON.stringify(definitions) } });
        updatedProducts += 1;
      }
      for (const variant of normalizedVariants.get(product.id) || []) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            attributes: JSON.stringify(variant.attributes),
            color: variant.color,
            size: variant.size,
          },
        });
        updatedVariants += 1;
      }
    }
    console.log(JSON.stringify({ globalAttributes: [...globalAttributes.values()].map(({ name }) => ({ name, options: optionSets.get(name)?.size || 0 })), productsUpdated: updatedProducts, variationsNormalized: updatedVariants, activeVariationProducts: products.filter((product) => product.variants.some((variant) => variant.status !== 'ARCHIVED')).length }, null, 2));
  }, { timeout: 30000 });
}

main().catch((error) => {
  console.error('Product attribute backfill failed:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
