const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.product.findMany({ take: 10 });
  console.log('PRODUCTS_FOUND:', JSON.stringify(products.map(p => ({
    id: p.id,
    name: p.name,
    salePrice: p.salePrice,
    regularPrice: p.regularPrice,
    image: p.image,
    description: p.description,
    category: p.category
  })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
