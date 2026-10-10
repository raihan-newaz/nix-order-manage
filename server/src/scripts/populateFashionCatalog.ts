import fs from 'fs';
import path from 'path';
import prisma from '../prisma';

const mediaDir = path.resolve(__dirname, '../../uploads/media');
const imageUrl = (fileName: string) => `/uploads/media/${fileName}`;

const categories = [
  ['New Arrivals', 'new-arrivals'],
  ['Shirts & Tops', 'shirts-tops'],
  ['Dresses', 'dresses'],
  ['Bottoms', 'bottoms'],
  ['Knitwear', 'knitwear'],
  ['Footwear', 'footwear'],
  ['Accessories', 'accessories'],
] as const;

const products = [
  { sku: 'NIX-OVR-001', name: 'Noir Relaxed Overshirt', category: 'shirts-tops', image: 'product-black-overshirt.png', buy: 850, regular: 1890, sale: 1590, stock: 24, description: 'A clean relaxed overshirt in breathable cotton twill, designed for everyday layering.' },
  { sku: 'NIX-LIN-002', name: 'Cloud Linen Button-Up', category: 'shirts-tops', image: 'product-cream-linen-shirt.png', buy: 780, regular: 1790, sale: 1490, stock: 18, description: 'An easy oversized linen shirt with a soft hand feel and effortless drape.' },
  { sku: 'NIX-DNM-003', name: 'Indigo Straight Denim', category: 'bottoms', image: 'product-indigo-denim.png', buy: 920, regular: 2190, sale: 1890, stock: 31, description: 'A straight-leg indigo denim with a comfortable everyday fit.' },
  { sku: 'NIX-KNT-004', name: 'Sage Ribbed Polo', category: 'knitwear', image: 'product-sage-knit-polo.png', buy: 690, regular: 1690, sale: 1390, stock: 16, description: 'Soft ribbed knit polo in a muted sage tone with a refined collar.' },
  { sku: 'NIX-HDY-005', name: 'Rust Weekend Hoodie', category: 'new-arrivals', image: 'product-rust-hoodie.png', buy: 760, regular: 1790, sale: 1490, stock: 22, description: 'A relaxed fleece hoodie in a warm rust colour for off-duty days.' },
  { sku: 'NIX-TRS-006', name: 'Charcoal Pleated Trouser', category: 'bottoms', image: 'product-charcoal-trouser.png', buy: 890, regular: 2090, sale: 1790, stock: 20, description: 'Wide-leg tailored trousers with soft pleats and a clean charcoal finish.' },
  { sku: 'NIX-DRS-007', name: 'Blush Satin Slip Dress', category: 'dresses', image: 'product-blush-slip-dress.png', buy: 980, regular: 2390, sale: 1990, stock: 14, description: 'A fluid satin slip dress with a softly polished finish.' },
  { sku: 'NIX-CAR-008', name: 'Navy Stripe Cardigan', category: 'knitwear', image: 'product-navy-cardigan.png', buy: 940, regular: 2290, sale: 1890, stock: 12, description: 'A navy and cream striped cardigan that layers beautifully through the season.' },
  { sku: 'NIX-SNK-009', name: 'Everyday White Sneakers', category: 'footwear', image: 'product-white-sneakers.png', buy: 1050, regular: 2490, sale: 2190, stock: 26, description: 'Minimal low-top sneakers with a clean white leather upper.' },
  { sku: 'NIX-BAG-010', name: 'Camel Crossbody Bag', category: 'accessories', image: 'product-camel-crossbody.png', buy: 820, regular: 1990, sale: 1690, stock: 15, description: 'A structured camel crossbody with an adjustable strap and daily capacity.' },
] as const;

const banners = [
  ['banner-city-overshirt.png', 'NIX editorial city overshirt banner'],
  ['banner-neutral-flatlay.png', 'NIX neutral essentials flat lay banner'],
  ['banner-sage-editorial.png', 'NIX sage editorial fashion banner'],
  ['banner-rust-accessories.png', 'NIX rust accessories editorial banner'],
] as const;

async function main() {
  for (const [name, slug] of categories) {
    await prisma.category.upsert({ where: { slug }, update: { name }, create: { name, slug, description: `${name} from the NIX edit` } });
  }

  for (const product of products) {
    const url = imageUrl(product.image);
    const file = fs.statSync(path.join(mediaDir, product.image));
    await prisma.mediaAsset.upsert({ where: { url }, update: { fileName: product.image, altText: product.name, mimeType: 'image/png', size: file.size }, create: { fileName: product.image, url, altText: product.name, mimeType: 'image/png', size: file.size } });
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: { name: product.name, category: product.category, description: product.description, image: url, gallery: JSON.stringify([url]), buyPrice: product.buy, regularPrice: product.regular, salePrice: product.sale, stockQuantity: product.stock, status: 'ACTIVE', productType: 'SIMPLE' },
      create: { sku: product.sku, name: product.name, category: product.category, description: product.description, image: url, gallery: JSON.stringify([url]), buyPrice: product.buy, regularPrice: product.regular, salePrice: product.sale, stockQuantity: product.stock, status: 'ACTIVE', productType: 'SIMPLE' },
    });
  }

  for (const [fileName, altText] of banners) {
    const url = imageUrl(fileName);
    const file = fs.statSync(path.join(mediaDir, fileName));
    await prisma.mediaAsset.upsert({ where: { url }, update: { fileName, altText, mimeType: 'image/png', size: file.size }, create: { fileName, url, altText, mimeType: 'image/png', size: file.size } });
  }

  const current = await prisma.storefrontSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
  const themeConfig = current.themeConfig && current.themeConfig.startsWith('{') ? JSON.parse(current.themeConfig) : {
    primaryColor: '#171815', accentColor: '#d8ff55', backgroundColor: '#f7f6f2', textColor: '#171815', mutedColor: '#707269', fontFamily: 'Manrope', buttonRadius: 'square', cardRadius: 'square', headerMode: 'STICKY', productDensity: 'COMFORTABLE', showAnnouncement: true, showTrustBar: true, showBestSellers: true, showAbout: true,
  };
  await prisma.storefrontSettings.update({ where: { id: 'default' }, data: {
    storeName: 'NIX',
    heroImages: JSON.stringify(banners.map(([fileName]) => imageUrl(fileName))),
    featuredCategories: JSON.stringify(categories.slice(0, 5).map(([, slug]) => slug)),
    themeConfig: JSON.stringify(themeConfig),
  } });
  console.log(`Created/updated ${products.length} products, ${categories.length} categories, ${banners.length} banners.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
