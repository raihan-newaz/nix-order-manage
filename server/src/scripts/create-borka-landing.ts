import { ensureLandingThankYou } from '../modules/builder/landingService';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { parseDocument, type BuilderNode, type PageDocument } from '../modules/builder/core/schema';
import { renderHtml } from '../modules/builder/core/renderer';

const prisma = new PrismaClient();

function createNode(
  type: string,
  name: string,
  props: Record<string, any> = {},
  styles: Record<string, string> = {},
  children: BuilderNode[] = [],
  responsiveStyles: Record<string, Record<string, string>> = {},
  attributes: Record<string, string> = {},
  classes: string[] = []
): BuilderNode {
  return {
    id: randomUUID(),
    type,
    version: 1,
    name,
    props,
    attributes,
    classes,
    bindings: {},
    children,
    locked: false,
    hidden: false,
    styles,
    responsiveStyles,
    states: {}
  };
}

interface ImageDef {
  fileName: string;
  url: string;
  altText: string;
  downloadUrl: string;
}

const borkaImages: ImageDef[] = [
  {
    fileName: 'borka-banner.png',
    url: '/uploads/media/borka-banner.png',
    altText: 'Dubai Cherry Borka Special Discount Offer Banner',
    downloadUrl: 'https://arabic.net.bd/wp-content/uploads/2025/04/png-41-1300x483.png'
  },
  {
    fileName: 'borka-model-1.jpg',
    url: '/uploads/media/borka-model-1.jpg',
    altText: 'Dubai Cherry Borka Full Length Look',
    downloadUrl: 'https://arabic.net.bd/wp-content/uploads/2026/07/IMG_20260722_022607.jpg'
  },
  {
    fileName: 'borka-model-2.jpg',
    url: '/uploads/media/borka-model-2.jpg',
    altText: 'Dubai Cherry Borka Side & Embroidery View',
    downloadUrl: 'https://arabic.net.bd/wp-content/uploads/2026/07/IMG_20260727_224706.jpg'
  },
  {
    fileName: 'borka-model-3.jpg',
    url: '/uploads/media/borka-model-3.jpg',
    altText: 'Dubai Cherry Borka Sleeve & Fabric Craftsmanship',
    downloadUrl: 'https://arabic.net.bd/wp-content/uploads/2026/07/IMG_20260722_022718-1.jpg'
  },
  {
    fileName: 'borka-model-4.jpg',
    url: '/uploads/media/borka-model-4.jpg',
    altText: 'Dubai Cherry Borka Elegant Fall & Fitting',
    downloadUrl: 'https://arabic.net.bd/wp-content/uploads/2026/07/IMG_20260722_024020-1-1.jpg'
  },
  {
    fileName: 'borka-thumb-1.jpg',
    url: '/uploads/media/borka-thumb-1.jpg',
    altText: 'Dubai Cherry Borka Thumbnail',
    downloadUrl: 'https://arabic.net.bd/wp-content/uploads/2026/09/1788899206850-woo-0-4-430x753.jpg'
  }
];

function downloadFile(url: string, dest: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const getWithRedirect = (currentUrl: string) => {
      https.get(currentUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, response => {
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
  console.log('--- 1. Downloading & Registering Authentic Borka Images ---');
  const mediaDir = path.resolve(__dirname, '../../uploads/media');
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  for (const img of borkaImages) {
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

      const existingMedia = await prisma.mediaAsset.findUnique({ where: { url: img.url } });
      if (!existingMedia) {
        await prisma.mediaAsset.create({
          data: {
            fileName: img.fileName,
            url: img.url,
            mimeType: img.fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
            size: size,
            altText: img.altText
          }
        });
        console.log(`Registered MediaAsset: ${img.url}`);
      }
    } catch (err: any) {
      console.warn(`Could not fetch image ${img.fileName}: ${err.message}`);
    }
  }

  console.log('\n--- 2. Creating / Updating Dubai Cherry Borka Product in Database ---');
  const regularPrice = 1650;
  const salePrice = 1190;
  const discountPercent = Math.round(((regularPrice - salePrice) / regularPrice) * 100);

  const productData = {
    name: 'দুবাই চেরি সিল্ক ডিজাইনার বোরখা',
    sku: 'BORKA-DUBAI-001',
    regularPrice,
    salePrice,
    buyPrice: 750,
    stockQuantity: 200,
    category: 'বোরকা কালেকশন',
    image: '/uploads/media/borka-model-1.jpg',
    gallery: JSON.stringify([
      '/uploads/media/borka-model-1.jpg',
      '/uploads/media/borka-model-2.jpg',
      '/uploads/media/borka-model-3.jpg',
      '/uploads/media/borka-model-4.jpg'
    ]),
    description: 'অরিজিনাল দুবাই চেরি জর্জেট ফেব্রিক্সে তৈরি নিখুঁত হাতের কাজ ও প্রিমিয়াম এমব্রয়ডারি। অত্যন্ত আরামদায়ক ও গর্জিয়াস লুক যা আপনাকে দেবে মার্জিত শালীনতা।',
    status: 'ACTIVE',
    productType: 'VARIABLE',
    attributes: JSON.stringify([
      { name: 'Size', values: ['50', '52', '54', '56'] },
      { name: 'Color', values: ['Black', 'Maroon', 'Navy Blue', 'Bottle Green'] }
    ])
  };

  let product = await prisma.product.findUnique({ where: { sku: productData.sku } });
  if (product) {
    product = await prisma.product.update({
      where: { id: product.id },
      data: productData
    });
    console.log(`Updated Product: ${product.name} (ID: ${product.id})`);
  } else {
    product = await prisma.product.create({
      data: productData
    });
    console.log(`Created Product: ${product.name} (ID: ${product.id})`);
  }

  // Ensure variants exist for all 16 Color x Size combinations
  const colors = [
    { name: 'Black', image: '/uploads/media/borka-model-1.jpg' },
    { name: 'Maroon', image: '/uploads/media/borka-model-2.jpg' },
    { name: 'Navy Blue', image: '/uploads/media/borka-model-3.jpg' },
    { name: 'Bottle Green', image: '/uploads/media/borka-model-4.jpg' }
  ];
  const sizes = ['50', '52', '54', '56'];

  for (const color of colors) {
    for (const size of sizes) {
      const colorCode = color.name.toLowerCase().replace(/\s+/g, '-');
      const varSku = `${product.sku}-${colorCode}-${size}`;
      const existingVar = await prisma.productVariant.findUnique({ where: { sku: varSku } });
      const variantPayload = {
        productId: product.id,
        sku: varSku,
        name: `${color.name} - সাইজ ${size}`,
        regularPrice,
        salePrice,
        stockQuantity: 50,
        status: 'ACTIVE',
        attributes: JSON.stringify({ Color: color.name, Size: size }),
        image: color.image
      };
      if (!existingVar) {
        await prisma.productVariant.create({ data: variantPayload });
      } else {
        await prisma.productVariant.update({
          where: { id: existingVar.id },
          data: variantPayload
        });
      }
    }
  }

  console.log('\n--- 3. Constructing 100% Authentic Reference Landing Page Document ---');
  const settings = (await prisma.storefrontSettings.findFirst()) || (await prisma.storefrontSettings.findUnique({ where: { id: 'default' } }));
  const insideDhaka = settings?.insideDhakaCharge ?? 70;
  const outsideDhaka = settings?.outsideDhakaCharge ?? 150;
  const initialTotal = salePrice + insideDhaka;

  const videoUrl = 'https://www.youtube.com/watch?v=EyCq1WOsWq8';

  const doc: PageDocument = {
    schemaVersion: 1,
    title: 'স্পেশাল ডিসকাউন্ট অফার দুবাই চেরি বোরখা মাত্র ১১৯০ টাকা',
    slug: 'borka-dubai-cherry',
    seo: {
      title: 'দুবাই চেরি সিল্ক ডিজাইনার বোরখা মাত্র ১১৯০ টাকা | স্পেশাল অফার',
      description: 'অরিজিনাল দুবাই চেরি সিল্ক ডিজাইনার বোরখা মাত্র ১১৯০ টাকা! সারা দেশে ক্যাশ অন ডেলিভারি এবং ৩ দিনের রিপ্লেসমেন্ট গ্যারান্টি।',
      noindex: false
    },
    settings: {
      lang: 'bn',
      direction: 'ltr'
    },
    breakpoints: [
      { id: 'tablet', label: 'Tablet', maxWidth: 1024 },
      { id: 'mobile', label: 'Mobile', maxWidth: 640 }
    ],
    tokens: {
      'brand-primary': '#e11d48',
      'brand-secondary': '#059669',
      'text-primary': '#1e293b',
      'spacing-md': '24px'
    },
    classes: {},
    components: {},
    rootNodes: [
      // 1. TOP HEADER BANNER IMAGE (Arabic Logo)
      createNode(
        'section',
        'Top Banner Section',
        { tag: 'section' },
        {
          'padding-top': '16px',
          'padding-bottom': '10px',
          'background-color': '#ffffff',
          'text-align': 'center'
        },
        [
          createNode(
            'image',
            'Top Banner Graphic',
            {
              src: '/uploads/media/borka-banner.png',
              alt: 'দুবাই চেরি বোরখা স্পেশাল ডিসকাউন্ট অফার'
            },
            {
              'width': '100%',
              'max-width': '140px',
              'height': 'auto',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'display': 'block'
            },
            [],
            {
              'mobile': { 'max-width': '110px' }
            }
          )
        ],
        {
          'mobile': { 'padding-top': '12px', 'padding-bottom': '8px' }
        }
      ),

      // 2. MAIN PROMOTIONAL HEADLINE
      createNode(
        'section',
        'Main Headline Section',
        { tag: 'section' },
        {
          'padding-top': '25px',
          'padding-bottom': '20px',
          'background': '#ffffff',
          'text-align': 'center'
        },
        [
          createNode(
            'container',
            'Headline Container',
            { tag: 'div' },
            {
              'max-width': '960px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '16px',
              'padding-right': '16px'
            },
            [
              createNode(
                'heading',
                'Promotional Headline',
                {
                  text: 'স্পেশাল ডিসকাউন্ট অফার দুবাই চেরি বোরখা মাত্র ১১৯০ টাকা। (হিজাব ছাড়া)',
                  level: 'h2',
                  size: 'large',
                  align: 'center'
                },
                {
                  'color': '#b91c1c',
                  'font-size': '30px',
                  'font-weight': '900',
                  'line-height': '1.35',
                  'margin': '0 0 16px 0',
                  'text-align': 'center'
                },
                [],
                {
                  'mobile': { 'font-size': '22px' }
                }
              )
            ]
          )
        ]
      ),

      // 3. YOUTUBE VIDEO SECTION
      createNode(
        'section',
        'Video Section',
        { tag: 'section' },
        {
          'padding-top': '10px',
          'padding-bottom': '30px',
          'background': '#ffffff'
        },
        [
          createNode(
            'container',
            'Video Container',
            { tag: 'div' },
            {
              'max-width': '800px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '16px',
              'padding-right': '16px',
              'text-align': 'center'
            },
            [
              createNode(
                'video',
                'Product Presentation Video',
                {
                  src: videoUrl,
                  autoplay: true,
                  loop: true,
                  controls: true
                },
                {
                  'border-radius': '16px',
                  'overflow': 'hidden',
                  'box-shadow': '0 15px 35px rgba(0, 0, 0, 0.15)',
                  'margin-bottom': '24px'
                }
              ),
              createNode(
                'button',
                'Video Order CTA Button',
                {
                  text: 'অর্ডার করতে চাই',
                  href: '#order-form',
                  type: 'danger',
                  size: 'large',
                  icon: 'shopping-cart'
                },
                {
                  'background': 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  'color': '#ffffff',
                  'padding': '16px 44px',
                  'font-size': '20px',
                  'font-weight': '800',
                  'border-radius': '999px',
                  'box-shadow': '0 10px 25px rgba(225, 29, 72, 0.35)',
                  'text-decoration': 'none',
                  'display': 'inline-block'
                }
              )
            ]
          )
        ]
      ),

      // 4. ANIMATED HEADLINE PRICE SECTION (Exact replica of arabic.net.bd)
      createNode(
        'section',
        'Animated Price Section',
        { tag: 'section' },
        {
          'padding-top': '40px',
          'padding-bottom': '40px',
          'background': 'linear-gradient(180deg, #fef2f2 0%, #fff1f2 100%)',
          'text-align': 'center',
          'border-top': '1px solid #fee2e2',
          'border-bottom': '1px solid #fee2e2'
        },
        [
          createNode(
            'container',
            'Price Container',
            { tag: 'div' },
            {
              'max-width': '720px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'heading',
                'Special Offer Tag',
                {
                  text: '✨ স্পেশাল ডিসকাউন্ট অফার! ✨',
                  level: 'h2',
                  size: 'large',
                  align: 'center'
                },
                {
                  'color': '#991b1b',
                  'font-size': '28px',
                  'font-weight': '900',
                  'margin-bottom': '20px',
                  'text-align': 'center'
                }
              ),

              // Animated Headline 1: Regular Price with cross 'x' animation
              createNode(
                'animated-headline',
                'Regular Price Animated Cross',
                {
                  beforeText: 'রেগুলার মূল্য',
                  highlightedText: `${regularPrice} ৳`,
                  afterText: '',
                  marker: 'x',
                  markerColor: '#dc2626',
                  tag: 'h3'
                },
                {
                  'font-size': '26px',
                  'font-weight': '700',
                  'color': '#475569',
                  'margin-bottom': '12px'
                }
              ),

              // Animated Headline 2: Offer Price with animated zigzag / circle highlight
              createNode(
                'animated-headline',
                'Offer Price Animated Zigzag',
                {
                  beforeText: 'অফার মূল্য মাত্র',
                  highlightedText: `${salePrice} ৳`,
                  afterText: '',
                  marker: 'underline_zigzag',
                  markerColor: '#059669',
                  tag: 'h3'
                },
                {
                  'font-size': '34px',
                  'font-weight': '900',
                  'color': '#065f46',
                  'margin-bottom': '24px'
                },
                [],
                {
                  'mobile': { 'font-size': '26px' }
                }
              ),

              // Offer Oval Glow Card for maximum impact
              createNode(
                'offer-price',
                'Animated Oval Offer Box',
                {
                  regularLabel: 'রেগুলার মূল্য',
                  regularPrice: `৳${regularPrice.toLocaleString('en-US')}`,
                  offerLabel: 'আজকের স্পেশাল অফার মূল্য',
                  offerPrice: `৳${salePrice.toLocaleString('en-US')}`,
                  discount: `${discountPercent}% ছাড়`,
                  highlight: 'সীমিত সময়ের ধামাকা অফার'
                },
                { 'margin-bottom': '24px' }
              ),

              createNode(
                'button',
                'Price Section CTA Button',
                {
                  text: 'অফারে অর্ডার করতে চাই',
                  href: '#order-form',
                  type: 'danger',
                  size: 'large',
                  icon: 'shopping-cart'
                },
                {
                  'background': 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  'color': '#ffffff',
                  'padding': '16px 40px',
                  'font-size': '19px',
                  'font-weight': '800',
                  'border-radius': '999px',
                  'box-shadow': '0 12px 28px rgba(225, 29, 72, 0.35)',
                  'text-decoration': 'none',
                  'display': 'inline-block'
                }
              )
            ]
          )
        ]
      ),

      // 5. AUTHENTIC DUBAI CHERRY BORKA IMAGE CAROUSEL (Replica of arabic.net.bd)
      createNode(
        'section',
        'Gallery Section',
        { tag: 'section' },
        {
          'padding-top': '60px',
          'padding-bottom': '60px',
          'background-color': '#ffffff'
        },
        [
          createNode(
            'container',
            'Gallery Container',
            { tag: 'div' },
            {
              'max-width': '760px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px',
              'text-align': 'center'
            },
            [
              createNode(
                'heading',
                'Gallery Heading',
                {
                  text: 'আমাদের অরিজিনাল দুবাই চেরি বোরখার রিয়েল ছবি',
                  level: 'h2',
                  size: 'large',
                  align: 'center'
                },
                {
                  'color': '#0f172a',
                  'font-size': '28px',
                  'font-weight': '800',
                  'margin-bottom': '28px',
                  'text-align': 'center'
                }
              ),
              createNode(
                'image-carousel',
                'Model Showcase Carousel',
                {
                  images: JSON.stringify([
                    '/uploads/media/borka-model-1.jpg',
                    '/uploads/media/borka-model-2.jpg',
                    '/uploads/media/borka-model-3.jpg',
                    '/uploads/media/borka-model-4.jpg'
                  ]),
                  autoplay: true,
                  interval: 3500,
                  arrows: true,
                  dots: true,
                  ratio: '4:5'
                },
                {
                  'max-width': '620px',
                  'margin-left': 'auto',
                  'margin-right': 'auto',
                  'border-radius': '20px',
                  'box-shadow': '0 18px 45px rgba(0, 0, 0, 0.12)',
                  'margin-bottom': '20px'
                }
              )
            ]
          )
        ]
      ),

      // 6. BENEFITS & FEATURES LIST (Replica from arabic.net.bd)
      createNode(
        'section',
        'Benefits Section',
        { tag: 'section' },
        {
          'padding-top': '60px',
          'padding-bottom': '60px',
          'background-color': '#f8fafc',
          'border-top': '1px solid #e2e8f0',
          'border-bottom': '1px solid #e2e8f0'
        },
        [
          createNode(
            'container',
            'Benefits Container',
            { tag: 'div' },
            {
              'max-width': '820px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'heading',
                'Benefits Title',
                {
                  text: 'আমাদের বোরখাটি ক্রয় করলে যে সুবিধা পাচ্ছেন',
                  level: 'h2',
                  size: 'large',
                  align: 'center'
                },
                {
                  'color': '#0f172a',
                  'font-size': '28px',
                  'font-weight': '800',
                  'margin-bottom': '30px',
                  'text-align': 'center'
                }
              ),
              createNode(
                'icon-list',
                'Benefits Checklist',
                {
                  items: [
                    '✓ ৩ দিনের রিপ্লেসমেন্ট সুবিধা।',
                    '✓ অরজিনিয়াল ডুবাই চেরি ফেব্রিক্স।',
                    '✓ উন্নত সেলাই এবং শতভাগ কালার গ্যারান্টি।',
                    '✓ ১০০% কোয়ালিটিফুল প্রডাক্ট এর নিশ্চয়তা।',
                    '✓ ভিডিও যা দেখতেছেন ঠিক তেমনি পেয়ে যাবেন। ইনশাআল্লাহ।',
                    '✓ কথার সাথে কাজের মিল না পেলে পণ্য রিটার্ন করবেন।',
                    '✓ প্রডাক্ট হাতে পেয়ে টাকা পরিশোধ করতে পারবেন।'
                  ].join('\n'),
                  layout: 'vertical',
                  iconColor: '#059669'
                },
                {
                  'background': '#ffffff',
                  'padding': '36px 44px',
                  'border-radius': '20px',
                  'border': '1.5px solid #e2e8f0',
                  'box-shadow': '0 10px 30px rgba(0, 0, 0, 0.05)',
                  'font-size': '17px',
                  'font-weight': '600',
                  'color': '#1e293b',
                  'line-height': '1.8'
                },
                [],
                {
                  'mobile': { 'padding': '24px 20px', 'font-size': '15px' }
                }
              )
            ]
          )
        ]
      ),

      // 7. SIZE MEASUREMENT SECTION (Replica from arabic.net.bd)
      createNode(
        'section',
        'Size Measurement Section',
        { tag: 'section' },
        {
          'padding-top': '60px',
          'padding-bottom': '60px',
          'background-color': '#ffffff'
        },
        [
          createNode(
            'container',
            'Size Container',
            { tag: 'div' },
            {
              'max-width': '820px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'heading',
                'Size Section Title',
                {
                  text: 'সাইজ মেজারমেন্ট',
                  level: 'h2',
                  size: 'large',
                  align: 'center'
                },
                {
                  'color': '#0f172a',
                  'font-size': '28px',
                  'font-weight': '800',
                  'margin-bottom': '30px',
                  'text-align': 'center'
                }
              ),
              createNode(
                'icon-list',
                'Size List Details',
                {
                  items: [
                    '[icon:ruler] 50: Chest-48” Length- 50”',
                    '[icon:ruler] 52: Chest-48” Length- 52”',
                    '[icon:ruler] 54: Chest-48” Length- 54”',
                    '[icon:ruler] 56: Chest-48” Length- 56″'
                  ].join('\n'),
                  layout: 'vertical',
                  iconColor: '#0f766e'
                },
                {
                  'background': '#f8fafc',
                  'padding': '32px 40px',
                  'border-radius': '20px',
                  'border': '1.5px solid #cbd5e1',
                  'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.04)',
                  'font-size': '17px',
                  'font-weight': '700',
                  'color': '#0f172a',
                  'line-height': '1.8'
                },
                [],
                {
                  'mobile': { 'padding': '22px 18px', 'font-size': '15px' }
                }
              )
            ]
          )
        ]
      ),

      // 8. HELPLINE & WHATSAPP SECTION
      createNode(
        'section',
        'Helpline Section',
        { tag: 'section' },
        {
          'padding-top': '40px',
          'padding-bottom': '40px',
          'background': 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
          'text-align': 'center',
          'color': '#ffffff'
        },
        [
          createNode(
            'container',
            'Helpline Container',
            { tag: 'div' },
            {
              'max-width': '650px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'heading',
                'Helpline Title',
                {
                  text: 'প্রয়োজনে সরাসরি কল অথবা হোয়াটসঅ্যাপ করুন',
                  level: 'h2',
                  size: 'medium',
                  align: 'center'
                },
                {
                  'color': '#ffffff',
                  'font-size': '22px',
                  'font-weight': '700',
                  'margin-bottom': '20px',
                  'text-align': 'center'
                }
              ),
              createNode(
                'flex',
                'Helpline Buttons Row',
                { direction: 'row', justify: 'center', align: 'center', wrap: 'wrap', gap: '16px' },
                { 'gap': '16px', 'display': 'flex', 'justify-content': 'center' },
                [
                  createNode(
                    'button',
                    'Phone Call CTA',
                    {
                      text: '{{site.phone}}',
                      href: 'tel:{{site.phone}}',
                      type: 'success',
                      icon: 'phone-alt'
                    },
                    {
                      'background': '#ffffff',
                      'color': '#065f46',
                      'padding': '14px 28px',
                      'font-size': '18px',
                      'font-weight': '800',
                      'border-radius': '999px',
                      'text-decoration': 'none'
                    }
                  ),
                  createNode(
                    'button',
                    'WhatsApp CTA',
                    {
                      text: 'WhatsApp',
                      href: 'https://wa.me/{{site.whatsapp}}',
                      type: 'success',
                      icon: 'fab fa-whatsapp'
                    },
                    {
                      'background': '#25d366',
                      'color': '#ffffff',
                      'padding': '14px 28px',
                      'font-size': '18px',
                      'font-weight': '800',
                      'border-radius': '999px',
                      'text-decoration': 'none'
                    }
                  )
                ]
              )
            ]
          )
        ]
      ),

      // 9. CASH ON DELIVERY CHECKOUT FORM SECTION
      createNode(
        'section',
        'Order Form Section',
        { tag: 'section' },
        {
          'padding-top': '60px',
          'padding-bottom': '80px',
          'background': 'linear-gradient(180deg, #f0fdf4 0%, #e6f9f0 100%)'
        },
        [
          createNode(
            'container',
            'Order Form Wrapper',
            { tag: 'div' },
            {
              'max-width': '650px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'container',
                'Order Card Box',
                { tag: 'div' },
                {
                  'background-color': '#ffffff',
                  'padding': '36px',
                  'border-radius': '16px',
                  'box-shadow': '0 20px 30px rgba(0, 0, 0, 0.08)',
                  'border': '2px solid #059669'
                },
                [
                  createNode(
                    'badge',
                    'Form Badge',
                    { text: 'ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে টাকা দিন)' },
                    {
                      'background-color': '#d1fae5',
                      'color': '#065f46',
                      'padding': '6px 14px',
                      'border-radius': '20px',
                      'font-size': '13px',
                      'font-weight': '700',
                      'display': 'inline-block',
                      'margin-bottom': '16px'
                    }
                  ),
                  createNode(
                    'heading',
                    'Form Title',
                    { text: 'অর্ডার করতে নিচের ফর্মটি সঠিক ভাবে পুরন করুন', level: 'h3', size: 'medium', align: 'left' },
                    {
                      'color': '#064e3b',
                      'font-size': '22px',
                      'font-weight': '800',
                      'margin': '0 0 8px 0'
                    }
                  ),
                  createNode(
                    'paragraph',
                    'Form Instruction',
                    { text: 'নিচের ফর্মটি পূরণ করে কনফার্ম করুন, আমাদের প্রতিনিধি আপনাকে কল করে সাইজ ও ঠিকানা কনফার্ম করবেন।' },
                    {
                      'color': '#64748b',
                      'font-size': '14px',
                      'margin': '0 0 20px 0'
                    }
                  ),

                  // Order Summary Breakdown Card
                  createNode(
                    'container',
                    'Order Summary Box',
                    { tag: 'div' },
                    {
                      'background-color': '#f8fafc',
                      'border': '1px solid #e2e8f0',
                      'border-radius': '12px',
                      'padding': '16px',
                      'margin-bottom': '20px'
                    },
                    [
                      createNode(
                        'container',
                        'Product Row',
                        { tag: 'div' },
                        {
                          'display': 'flex',
                          'align-items': 'center',
                          'gap': '14px',
                          'padding-bottom': '12px',
                          'border-bottom': '1px solid #e2e8f0',
                          'margin-bottom': '12px'
                        },
                        [
                          createNode(
                            'image',
                            'Checkout Product Thumbnail',
                            { src: product.image, alt: product.name },
                            {
                              'width': '56px',
                              'height': '56px',
                              'border-radius': '8px',
                              'object-fit': 'cover',
                              'border': '1px solid #cbd5e1'
                            }
                          ),
                          createNode(
                            'container',
                            'Product Text Box',
                            { tag: 'div' },
                            { 'flex': '1' },
                            [
                              createNode('heading', 'Product Title', { text: product.name, level: 'h4', size: 'small' }, { 'font-size': '14px', 'font-weight': '700', 'color': '#0f172a', 'margin': '0 0 4px 0' }),
                              createNode('text', 'Product Pricing', { text: `৳${salePrice} (পরিমাণ: ১)` }, { 'font-size': '13px', 'font-weight': '700', 'color': '#059669' })
                            ]
                          )
                        ]
                      ),

                      // Delivery Shipping Method Selection
                      createNode('heading', 'Shipping Method Heading', { text: 'ডেলিভারি এলাকা নির্বাচন করুন:', level: 'h5' }, { 'font-size': '13px', 'font-weight': '700', 'color': '#334155', 'margin': '0 0 8px 0' }),
                      createNode(
                        'container',
                        'Shipping Options Grid',
                        { tag: 'div' },
                        { 'display': 'flex', 'flex-direction': 'column', 'gap': '8px', 'margin-bottom': '14px' },
                        [
                          createNode(
                            'container',
                            'Shipping Option 1',
                            { tag: 'div' },
                            {
                              'display': 'flex',
                              'align-items': 'center',
                              'justify-content': 'space-between',
                              'padding': '10px 14px',
                              'border': '1px solid #059669',
                              'background-color': '#ecfdf5',
                              'border-radius': '8px',
                              'cursor': 'pointer',
                              'font-size': '13px'
                            },
                            [
                              createNode('text', 'Inside Dhaka Label', { text: 'ঢাকার ভিতরে' }, { 'font-weight': '600' }),
                              createNode('text', 'Inside Dhaka Price', { text: `৳${insideDhaka}` }, { 'font-weight': '700', 'color': '#059669' })
                            ],
                            {},
                            { 'data-charge': String(insideDhaka) },
                            []
                          ),
                          createNode(
                            'container',
                            'Shipping Option 2',
                            { tag: 'div' },
                            {
                              'display': 'flex',
                              'align-items': 'center',
                              'justify-content': 'space-between',
                              'padding': '10px 14px',
                              'border': '1px solid #cbd5e1',
                              'background-color': '#ffffff',
                              'border-radius': '8px',
                              'cursor': 'pointer',
                              'font-size': '13px'
                            },
                            [
                              createNode('text', 'Outside Dhaka Label', { text: 'ঢাকার বাইরে' }, { 'font-weight': '600' }),
                              createNode('text', 'Outside Dhaka Price', { text: `৳${outsideDhaka}` }, { 'font-weight': '700', 'color': '#059669' })
                            ],
                            {},
                            { 'data-charge': String(outsideDhaka) },
                            []
                          )
                        ]
                      ),

                      // Price Breakdown Summary
                      createNode(
                        'container',
                        'Price Breakdown Row Subtotal',
                        { tag: 'div' },
                        { 'display': 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'font-size': '13px', 'color': '#64748b', 'margin-bottom': '6px' },
                        [
                          createNode('text', 'Subtotal Label', { text: 'সাবটোটাল:' }),
                          createNode('text', 'Subtotal Value', { text: `৳${salePrice}` }, { 'font-weight': '600', 'color': '#0f172a' })
                        ]
                      ),
                      createNode(
                        'container',
                        'Price Breakdown Row Shipping',
                        { tag: 'div' },
                        { 'display': 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'font-size': '13px', 'color': '#64748b', 'margin-bottom': '8px' },
                        [
                          createNode('text', 'Shipping Label', { text: 'ডেলিভারি চার্জ:' }),
                          createNode('text', 'Shipping Value', { text: `৳${insideDhaka}` }, { 'font-weight': '600', 'color': '#059669' }, [], {}, { id: 'checkout-shipping-charge' })
                        ]
                      ),
                      createNode(
                        'container',
                        'Price Breakdown Row Total',
                        { tag: 'div' },
                        { 'display': 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'font-size': '16px', 'font-weight': '700', 'color': '#0f172a', 'padding-top': '10px', 'border-top': '1px dashed #cbd5e1' },
                        [
                          createNode('text', 'Total Label', { text: 'সর্বমোট প্রদেয় বিল:' }),
                          createNode('text', 'Total Value', { text: `৳${initialTotal}` }, { 'color': '#059669', 'font-size': '18px' }, [], {}, { id: 'checkout-grand-total', 'data-base-price': String(salePrice) })
                        ]
                      )
                    ]
                  ),

                  // The Lead Capture Form
                  createNode(
                    'form',
                    'Lead Capture Form',
                    {
                      formName: 'Borka Direct Order Form',
                      successMessage: 'ধন্যবাদ! আপনার বোরকা অর্ডারটি গ্রহণ করা হয়েছে। শীঘ্রই আমাদের প্রতিনিধি আপনাকে কল করবেন।'
                    },
                    {
                      'display': 'flex',
                      'flex-direction': 'column',
                      'gap': '16px'
                    },
                    [
                      createNode(
                        'form-field',
                        'Customer Name',
                        {
                          fieldName: 'customer_name',
                          label: 'আপনার নাম *',
                          inputType: 'text',
                          placeholder: 'আপনার সম্পূর্ণ নাম লিখুন',
                          required: true
                        },
                        { 'font-size': '14px' }
                      ),
                      createNode(
                        'form-field',
                        'Customer Phone',
                        {
                          fieldName: 'customer_phone',
                          label: 'মোবাইল নাম্বার *',
                          inputType: 'tel',
                          placeholder: '১১ ডিজিটের সচল মোবাইল নাম্বার (যেমন: 017XXXXXXXX)',
                          required: true
                        },
                        { 'font-size': '14px' }
                      ),
                      createNode(
                        'form-field',
                        'Customer Size',
                        {
                          fieldName: 'customer_size',
                          label: 'বোরকার সাইজ নির্বাচন করুন *',
                          inputType: 'select',
                          options: ['সাইজ ৫০ (Chest-48 Length-50)', 'সাইজ ৫২ (Chest-48 Length-52)', 'সাইজ ৫৪ (Chest-48 Length-54)', 'সাইজ ৫৬ (Chest-48 Length-56)'],
                          required: true
                        },
                        { 'font-size': '14px' }
                      ),
                      createNode(
                        'form-field',
                        'Customer Address',
                        {
                          fieldName: 'customer_address',
                          label: 'সম্পূর্ণ ডেলিভারি ঠিকানা *',
                          inputType: 'textarea',
                          placeholder: 'বাসা/রোড নং, এলাকা, থানা ও জেলা উল্লেখ করুন',
                          required: true
                        },
                        { 'font-size': '14px' }
                      ),
                      createNode(
                        'form-field',
                        'Customer Note',
                        {
                          fieldName: 'customer_note',
                          label: 'বিশেষ কোনো নির্দেশনা (ঐচ্ছিক)',
                          inputType: 'text',
                          placeholder: 'পছন্দের রং বা ডেলিভারির বিশেষ কোনো বার্তা থাকলে লিখুন',
                          required: false
                        },
                        { 'font-size': '14px' }
                      ),
                      createNode(
                        'form-submit',
                        'Submit Order Button',
                        { text: `অর্ডার কনফার্ম করুন - ৳${initialTotal}` },
                        {
                          'background': 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                          'color': '#ffffff',
                          'font-size': '18px',
                          'font-weight': '700',
                          'padding': '16px',
                          'border-radius': '8px',
                          'border': 'none',
                          'cursor': 'pointer',
                          'width': '100%',
                          'margin-top': '10px'
                        }
                      )
                    ]
                  )
                ]
              )
            ]
          )
        ],
        {},
        { id: 'order-form' }
      ),

      // 10. FOOTER SECTION
      createNode(
        'section',
        'Footer Section',
        { tag: 'footer' },
        {
          'background-color': '#0f172a',
          'padding-top': '30px',
          'padding-bottom': '30px',
          'color': '#94a3b8',
          'text-align': 'center',
          'font-size': '13px'
        },
        [
          createNode(
            'text',
            'Copyright Text',
            { text: `© ${new Date().getFullYear()} ${settings?.storeName || 'NIX Fashion'}. সর্বস্বত্ব সংরক্ষিত।` },
            { 'color': '#94a3b8' }
          )
        ]
      )
    ]
  };

  const validated = parseDocument(doc);
  console.log('Document schema validated successfully!');

  const rendered = renderHtml(validated);
  console.log(`Rendered HTML length: ${rendered.length} characters`);

  // 4. Save into BuilderPage
  const existingUser = await prisma.user.findFirst({ select: { id: true, name: true } });
  const userId = existingUser?.id || 'system';
  const userName = existingUser?.name || 'Administrator';

  const existingPage = await prisma.builderPage.findUnique({ where: { slug: validated.slug } });
  let savedPage;

  if (existingPage) {
    savedPage = await prisma.builderPage.update({
      where: { id: existingPage.id },
      data: {
        title: validated.title,
        draft: JSON.stringify(validated),
        published: JSON.stringify(validated),
        publishedSlug: validated.slug,
        version: existingPage.version + 1,
        publishedVersion: existingPage.version + 1,
        updatedBy: userId
      }
    });
    console.log(`Updated existing BuilderPage ID: ${savedPage.id}`);
  } else {
    savedPage = await prisma.builderPage.create({
      data: {
        title: validated.title,
        slug: validated.slug,
        publishedSlug: validated.slug,
        draft: JSON.stringify(validated),
        published: JSON.stringify(validated),
        version: 1,
        publishedVersion: 1,
        createdBy: userId,
        updatedBy: userId,
        revisions: {
          create: {
            version: 1,
            document: JSON.stringify(validated),
            action: 'publish',
            authorId: userId,
            authorName: userName
          }
        }
      }
    });
    console.log(`Created new BuilderPage ID: ${savedPage.id}`);
  }

  // 5. Save StorePage record for /flow-borka-dubai-cherry & direct checkout integration
  const flowSlug = `flow-${validated.slug}`;
  const storePageRecord = {
    title: validated.title,
    slug: flowSlug,
    metaTitle: validated.seo.title,
    metaDescription: validated.seo.description,
    status: 'PUBLISHED',
    isActive: true,
    blocks: JSON.stringify([
      {
        id: randomUUID(),
        type: 'HERO',
        eyebrow: 'দুবাই চেরি কালেকশন',
        heading: validated.title,
        text: 'অরিজিনাল দুবাই চেরি জর্জেট ফেব্রিক্সে তৈরি নিখুঁত হাতের কাজ ও প্রিমিয়াম এমব্রয়ডারি। অত্যন্ত আরামদায়ক ও গর্জিয়াস লুক।',
        image: product.image,
        buttonText: 'এখনই অর্ডার করুন'
      },
      {
        id: randomUUID(),
        type: 'CHECKOUT',
        heading: 'অর্ডার করতে নিচের ফর্মটি পূরণ করুন',
        productIds: [product.id],
        selection: 'SINGLE',
        couponEnabled: false,
        buttonText: 'অর্ডার সম্পূর্ণ করুন'
      }
    ])
  };

  const existingStorePage = await prisma.storePage.findUnique({ where: { slug: flowSlug } });
  let savedStorePage;
  if (existingStorePage) {
    savedStorePage = await prisma.storePage.update({
      where: { id: existingStorePage.id },
      data: storePageRecord
    });
    console.log(`Updated StorePage: ${flowSlug}`);
  } else {
    savedStorePage = await prisma.storePage.create({
      data: storePageRecord
    });
    console.log(`Created StorePage: ${flowSlug}`);
  }

  // 6. Link StorePage & BuilderPage with BuilderLanding
  const existingLandingLink = await prisma.builderLanding.findFirst({
    where: {
      OR: [
        { storePageId: savedStorePage.id },
        { builderPageId: savedPage.id }
      ]
    }
  });

  if (existingLandingLink) {
    await prisma.builderLanding.update({
      where: { id: existingLandingLink.id },
      data: {
        storePageId: savedStorePage.id,
        builderPageId: savedPage.id
      }
    });
    console.log(`Updated BuilderLanding Link: StorePage(${savedStorePage.id}) <-> BuilderPage(${savedPage.id})`);
  } else {
    await prisma.builderLanding.create({
      data: {
        storePageId: savedStorePage.id,
        builderPageId: savedPage.id,
        createdBy: userId
      }
    });
    console.log(`Created BuilderLanding Link: StorePage(${savedStorePage.id}) <-> BuilderPage(${savedPage.id})`);
  }

  await ensureLandingThankYou(savedPage.id, { id: userId, name: 'Borka template' });

  // 7. Save in BuilderTemplate
  const templateName = 'Arabic Dubai Cherry Borka Landing Template';
  const existingTemplate = await prisma.builderTemplate.findFirst({ where: { name: templateName } });
  if (!existingTemplate) {
    await prisma.builderTemplate.create({
      data: {
        name: templateName,
        document: JSON.stringify(validated),
        createdBy: userId
      }
    });
    console.log(`Created Template in Library: "${templateName}"`);
  }

  console.log('\n=============================================');
  console.log('🎉 Borka Landing Page Successfully Built & Linked!');
  console.log(`📌 Product Name: ${product.name} (৳${product.salePrice})`);
  console.log(`📌 Page Title: ${savedPage.title}`);
  console.log(`📌 Page Slug: ${savedPage.slug}`);
  console.log(`📌 Direct Storefront URL: /borka-dubai-cherry`);
  console.log(`📌 Studio Preview URL: /b/${savedPage.slug}`);
  console.log(`📌 Thank You URL: /borka-dubai-cherry/thank-you`);
  console.log('=============================================\n');
}

main()
  .catch(err => {
    console.error('Error creating Borka landing page:', err);
  })
  .finally(() => prisma.$disconnect());
