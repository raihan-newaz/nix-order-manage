import 'dotenv/config';
import prisma from '../prisma';

const productId = 'd03bf4d3-8afa-4417-8610-b24aefac8677';
const colors: Record<string, string> = {
  'Emerald Green': '#064e3b',
  'Jet Black': '#18181b',
};

async function main() {
  await prisma.$transaction(async tx => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Borka product was not found');
    const productAttributes = JSON.parse(product.attributes || '[]');
    const colorAttribute = productAttributes.find((attribute: any) => attribute.name === 'Color');
    if (colorAttribute) colorAttribute.optionColors = { ...colorAttribute.optionColors, ...colors };

    const globalAttribute = await tx.productAttribute.findUnique({ where: { slug: 'color' } });
    if (!globalAttribute) throw new Error('Reusable Color attribute was not found');
    const options = JSON.parse(globalAttribute.options) as string[];
    for (const color of Object.keys(colors)) if (!options.includes(color)) options.push(color);
    const optionColors = { ...JSON.parse(globalAttribute.optionColors || '{}'), ...colors };

    await tx.productAttribute.update({ where: { id: globalAttribute.id }, data: {
      options: JSON.stringify(options), optionColors: JSON.stringify(optionColors), type: 'COLOR', displayStyle: 'SQUARE',
    } });
    await tx.product.update({ where: { id: productId }, data: { attributes: JSON.stringify(productAttributes) } });
  });
  console.log('Borka Color attribute now includes Emerald Green and Jet Black with square color swatches.');
}

main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
