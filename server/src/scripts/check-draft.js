const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const page = await prisma.builderPage.findFirst({ where: { slug: 'earbuds-pro-offer' } });
  if (!page) {
    console.log('No page found');
    return;
  }
  const doc = JSON.parse(page.draft);
  console.log('ROOT NODES COUNT:', doc.rootNodes.length);
  function findImages(nodes) {
    for (const node of nodes) {
      if (node.type === 'image') {
        console.log('FOUND IMAGE NODE:', JSON.stringify(node, null, 2));
      }
      if (node.children) findImages(node.children);
    }
  }
  findImages(doc.rootNodes);
}
main().finally(() => prisma.$disconnect());
