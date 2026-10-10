import prisma from '../prisma';

async function main() {
  const categories = await prisma.category.findMany();
  console.log('--- CATEGORIES ---');
  console.log(JSON.stringify(categories, null, 2));

  const attributes = await prisma.productAttribute.findMany();
  console.log('--- ATTRIBUTES ---');
  console.log(JSON.stringify(attributes, null, 2));

  const products = await prisma.product.findMany({
    take: 5,
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      category: true,
      attributes: true,
      productType: true,
      variants: {
        take: 2,
        select: {
          id: true,
          name: true,
          sku: true,
          color: true,
          size: true,
          attributes: true
        }
      }
    }
  });
  console.log('--- PRODUCTS SAMPLE ---');
  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
