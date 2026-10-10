import fs from 'fs';
import path from 'path';
import https from 'https';
import prisma from '../prisma';

interface ImageDef {
  fileName: string;
  url: string;
  altText: string;
  downloadUrl: string;
}

const imagesToRegister: ImageDef[] = [
  {
    fileName: 'product-earbuds-hero.jpg',
    url: '/uploads/media/product-earbuds-hero.jpg',
    altText: 'Active Noise Cancelling Wireless Earbuds TWS - Hero View',
    downloadUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80'
  },
  {
    fileName: 'product-earbuds-case.jpg',
    url: '/uploads/media/product-earbuds-case.jpg',
    altText: 'Earbuds Fast Charging Case & LED Display',
    downloadUrl: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&auto=format&fit=crop&q=80'
  },
  {
    fileName: 'product-earbuds-sound.jpg',
    url: '/uploads/media/product-earbuds-sound.jpg',
    altText: 'Hi-Fi Deep Bass 13mm Dynamic Driver',
    downloadUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80'
  },
  {
    fileName: 'product-earbuds-lifestyle.jpg',
    url: '/uploads/media/product-earbuds-lifestyle.jpg',
    altText: 'Earbuds In-Ear Ergonomic Fit & IPX5 Waterproof',
    downloadUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'
  },
  {
    fileName: 'product-earbuds-black.jpg',
    url: '/uploads/media/product-earbuds-black.jpg',
    altText: 'Matte Black Premium Edition Earbuds',
    downloadUrl: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&auto=format&fit=crop&q=80'
  }
];

function downloadFile(url: string, dest: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const getWithRedirect = (currentUrl: string) => {
      https.get(currentUrl, response => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          getWithRedirect(response.headers.location);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: status ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            const stats = fs.statSync(dest);
            resolve(stats.size);
          });
        });
      }).on('error', err => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    getWithRedirect(url);
  });
}

async function main() {
  const mediaDir = path.resolve(__dirname, '../../uploads/media');
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
    console.log(`Created directory: ${mediaDir}`);
  }

  console.log('Downloading and registering images into Media Gallery...');

  for (const img of imagesToRegister) {
    const destPath = path.join(mediaDir, img.fileName);
    let size = 0;
    try {
      if (!fs.existsSync(destPath) || fs.statSync(destPath).size < 1000) {
        console.log(`Downloading ${img.fileName}...`);
        size = await downloadFile(img.downloadUrl, destPath);
        console.log(`Saved ${img.fileName} (${size} bytes)`);
      } else {
        size = fs.statSync(destPath).size;
        console.log(`Already exists: ${img.fileName} (${size} bytes)`);
      }

      // Upsert into MediaAsset table
      const existing = await prisma.mediaAsset.findUnique({ where: { url: img.url } });
      if (!existing) {
        await prisma.mediaAsset.create({
          data: {
            fileName: img.fileName,
            url: img.url,
            altText: img.altText,
            mimeType: 'image/jpeg',
            size
          }
        });
        console.log(`✅ Registered in MediaAsset: ${img.url}`);
      } else {
        await prisma.mediaAsset.update({
          where: { url: img.url },
          data: {
            altText: img.altText,
            size
          }
        });
        console.log(`Updated MediaAsset: ${img.url}`);
      }
    } catch (err) {
      console.error(`Error processing ${img.fileName}:`, err);
    }
  }

  // Update or create product with local media gallery images
  console.log('\nUpdating product with local Media Gallery images...');
  let product = await prisma.product.findFirst({
    where: {
      name: { contains: 'Earbuds' }
    }
  });

  const heroImage = '/uploads/media/product-earbuds-hero.jpg';
  const galleryImages = JSON.stringify([
    '/uploads/media/product-earbuds-hero.jpg',
    '/uploads/media/product-earbuds-case.jpg',
    '/uploads/media/product-earbuds-sound.jpg',
    '/uploads/media/product-earbuds-lifestyle.jpg',
    '/uploads/media/product-earbuds-black.jpg'
  ]);

  if (product) {
    product = await prisma.product.update({
      where: { id: product.id },
      data: {
        image: heroImage,
        gallery: galleryImages,
        status: 'ACTIVE',
        stockQuantity: 150,
        regularPrice: 1850,
        salePrice: 1390,
        buyPrice: 950
      }
    });
    console.log(`✅ Updated Product ID: ${product.id} (SKU: ${product.sku}) with local Media Gallery images!`);
  } else {
    product = await prisma.product.create({
      data: {
        name: 'Active Noise Cancelling Wireless Earbuds TWS',
        sku: 'EARBUD-TWS-PRO',
        regularPrice: 1850,
        salePrice: 1390,
        buyPrice: 950,
        stockQuantity: 150,
        category: 'Electronics',
        image: heroImage,
        gallery: galleryImages,
        description: 'প্রিমিয়াম ওয়্যারলেস এয়ারবাডস - অ্যাক্টিভ নয়েজ ক্যান্সেলেশন, ডিপ বাস এবং ৩৬ ঘণ্টার ব্যাকআপ সহ।',
        status: 'ACTIVE'
      }
    });
    console.log(`✅ Created Product ID: ${product.id} (SKU: ${product.sku}) with local Media Gallery images!`);
  }

  console.log('\nMedia Gallery and Product setup completed successfully!');
}

main()
  .catch(err => {
    console.error('Failed to setup media and product:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
