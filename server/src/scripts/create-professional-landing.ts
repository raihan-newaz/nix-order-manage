import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { emptyDocument, parseDocument, type BuilderNode, type PageDocument } from '../modules/builder/core/schema';
import { renderHtml } from '../modules/builder/core/renderer';

const prisma = new PrismaClient();

function createNode(
  type: string,
  name: string,
  props: Record<string, any> = {},
  styles: Record<string, string> = {},
  children: BuilderNode[] = [],
  responsiveStyles: Record<string, Record<string, string>> = {},
  attributes: Record<string, string> = {}
): BuilderNode {
  return {
    id: randomUUID(),
    type,
    version: 1,
    name,
    props,
    attributes,
    classes: [],
    bindings: {},
    children,
    locked: false,
    hidden: false,
    styles,
    responsiveStyles,
    states: {}
  };
}

async function main() {
  console.log('Finding product from website database...');
  let product = await prisma.product.findFirst({
    where: {
      name: { contains: 'Earbuds' }
    }
  });

  if (!product) {
    product = await prisma.product.findFirst({
      where: { status: 'ACTIVE' }
    });
  }

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: 'Active Noise Cancelling Wireless Earbuds TWS',
        sku: 'ANC-TWS-001',
        regularPrice: 1850,
        salePrice: 1390,
        buyPrice: 950,
        stockQuantity: 100,
        category: 'Electronics',
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
        description: 'প্রিমিয়াম ওয়্যারলেস এয়ারবাডস - অ্যাক্টিভ নয়েজ ক্যান্সেলেশন, ডিপ বাস এবং ৩৬ ঘণ্টার ব্যাকআপ সহ।'
      }
    });
  }

  console.log(`Using product: "${product.name}" (Price: ৳${product.salePrice}, Regular: ৳${product.regularPrice})`);

  const settings = (await prisma.storefrontSettings.findFirst()) || (await prisma.storefrontSettings.findUnique({ where: { id: 'default' } }));
  const insideDhaka = settings?.insideDhakaCharge ?? 70;
  const subArea = settings?.subAreaCharge ?? 130;
  const outsideDhaka = settings?.outsideDhakaCharge ?? 150;
  console.log(`Using Store Shipping Settings: Inside Dhaka: ৳${insideDhaka}, Sub-Area: ৳${subArea}, Outside Dhaka: ৳${outsideDhaka}`);

  const productImage = product.image || '/uploads/media/product-earbuds-hero.jpg';
  const regularPrice = product.regularPrice > 0 ? product.regularPrice : 1850;
  const salePrice = product.salePrice > 0 ? product.salePrice : 1390;
  const discountPercent = Math.round(((regularPrice - salePrice) / regularPrice) * 100);
  const initialTotal = salePrice + insideDhaka;

  // Build the complete, professional Landing Page Document
  const doc: PageDocument = {
    schemaVersion: 1,
    title: `${product.name} - প্রিমিয়াম অফার`,
    slug: 'earbuds-pro-offer',
    seo: {
      title: `${product.name} | বিশেষ মূল্যছাড় ও ফ্রি ডেলিভারি`,
      description: `অরিজিনাল ${product.name} এখন পাচ্ছেন মাত্র ৳${salePrice} টাকায়! সাথে ফ্রি হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি।`,
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
      'brand-primary': '#0f766e',
      'brand-secondary': '#f59e0b',
      'text-primary': '#0f172a',
      'spacing-md': '24px'
    },
    classes: {},
    components: {},
    rootNodes: [
      // 1. TOP ANNOUNCEMENT BAR
      createNode(
        'section',
        'Top Announcement Bar',
        { tag: 'section' },
        {
          'background-color': '#0f172a',
          'padding-top': '10px',
          'padding-bottom': '10px',
          'text-align': 'center'
        },
        [
          createNode(
            'text',
            'Announcement Text',
            { text: `🔥 বিশেষ অফার! সারাদেশে ফ্রি ক্যাশ অন ডেলিভারি ও ${discountPercent > 0 ? discountPercent : 25}% ফ্ল্যাট ছাড়!` },
            {
              'color': '#f8fafc',
              'font-size': '14px',
              'font-weight': '600',
              'letter-spacing': '0.5px'
            }
          )
        ]
      ),

      // 2. HERO SECTION
      createNode(
        'section',
        'Hero Section',
        { tag: 'section' },
        {
          'background': 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          'padding-top': '60px',
          'padding-bottom': '60px',
          'color': '#ffffff'
        },
        [
          createNode(
            'container',
            'Hero Container',
            { tag: 'div' },
            {
              'max-width': '1140px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px',
              'display': 'flex',
              'flex-wrap': 'wrap',
              'align-items': 'center',
              'gap': '40px'
            },
            [
              // Left Column: Text & CTA
              createNode(
                'container',
                'Hero Left Content',
                { tag: 'div' },
                {
                  'flex': '1 1 500px',
                  'display': 'flex',
                  'flex-direction': 'column',
                  'gap': '16px'
                },
                [
                  createNode(
                    'badge',
                    'Offer Badge',
                    { text: '★ বেস্ট সেলিং গ্যাজেট ২০২৬ | রেটিং ৪.৯/৫' },
                    {
                      'background-color': 'rgba(245, 158, 11, 0.2)',
                      'color': '#fbbf24',
                      'border': '1px solid #f59e0b',
                      'border-radius': '20px',
                      'padding-top': '4px',
                      'padding-bottom': '4px',
                      'padding-left': '12px',
                      'padding-right': '12px',
                      'font-size': '12px',
                      'font-weight': '600',
                      'width': 'fit-content'
                    }
                  ),
                  createNode(
                    'heading',
                    'Hero Heading',
                    { text: product.name, level: 'h1', size: 'xxl', align: 'left' },
                    {
                      'color': '#ffffff',
                      'font-size': '36px',
                      'font-weight': '700',
                      'line-height': '1.3',
                      'margin': '0'
                    },
                    [],
                    {
                      mobile: { 'font-size': '28px' }
                    }
                  ),
                  createNode(
                    'paragraph',
                    'Hero Subtitle',
                    { text: product.description || 'ক্রিস্টাল ক্লিয়ার সাউন্ড, পাওয়ারফুল ডিপ বাস এবং ৩৬ ঘণ্টার ব্যাকআপ সহ উপভোগ করুন প্রিমিয়াম অডিও এক্সপেরিয়েন্স।' },
                    {
                      'color': '#94a3b8',
                      'font-size': '16px',
                      'line-height': '1.6',
                      'margin': '0'
                    }
                  ),

                  // Pricing Container
                  createNode(
                    'container',
                    'Price Card',
                    { tag: 'div' },
                    {
                      'display': 'flex',
                      'align-items': 'center',
                      'gap': '16px',
                      'background-color': 'rgba(255, 255, 255, 0.05)',
                      'padding': '16px 20px',
                      'border-radius': '10px',
                      'border': '1px solid rgba(255, 255, 255, 0.1)',
                      'width': 'fit-content'
                    },
                    [
                      createNode(
                        'text',
                        'Regular Price',
                        { text: `রেগুলার মূল্য: ৳${regularPrice}` },
                        {
                          'color': '#94a3b8',
                          'text-decoration': 'line-through',
                          'font-size': '16px'
                        }
                      ),
                      createNode(
                        'text',
                        'Offer Price',
                        { text: `অফার মূল্য: ৳${salePrice}` },
                        {
                          'color': '#10b981',
                          'font-size': '24px',
                          'font-weight': '700'
                        }
                      ),
                      createNode(
                        'badge',
                        'Discount Pill',
                        { text: `${discountPercent}% ছাড়` },
                        {
                          'background-color': '#ef4444',
                          'color': '#ffffff',
                          'padding': '4px 10px',
                          'border-radius': '6px',
                          'font-size': '12px',
                          'font-weight': '700'
                        }
                      )
                    ]
                  ),

                  // Hero Action Buttons
                  createNode(
                    'container',
                    'Hero Buttons',
                    { tag: 'div' },
                    {
                      'display': 'flex',
                      'flex-wrap': 'wrap',
                      'gap': '14px',
                      'margin-top': '8px'
                    },
                    [
                      createNode(
                        'button',
                        'Order Now CTA',
                        { text: 'এখনই অর্ডার করুন', href: '#order-form', type: 'success', icon: 'fas fa-shopping-cart' },
                        {
                          'background-color': '#10b981',
                          'color': '#ffffff',
                          'font-size': '16px',
                          'font-weight': '700',
                          'padding': '14px 28px',
                          'border-radius': '8px',
                          'border': 'none',
                          'cursor': 'pointer',
                          'text-decoration': 'none'
                        }
                      ),
                      createNode(
                        'button',
                        'Call Helpline CTA',
                        { text: 'সরাসরি কল করুন', href: 'tel:{{site.phone}}', type: 'default', icon: 'fas fa-phone' },
                        {
                          'background-color': 'rgba(255, 255, 255, 0.1)',
                          'color': '#ffffff',
                          'font-size': '16px',
                          'font-weight': '600',
                          'padding': '14px 24px',
                          'border-radius': '8px',
                          'border': '1px solid rgba(255, 255, 255, 0.2)',
                          'text-decoration': 'none'
                        }
                      )
                    ]
                  )
                ]
              ),

              // Right Column: Hero Image
              createNode(
                'container',
                'Hero Right Image',
                { tag: 'div' },
                {
                  'flex': '1 1 400px',
                  'display': 'flex',
                  'justify-content': 'center'
                },
                [
                  createNode(
                    'image',
                    'Product Hero Image',
                    { src: productImage, alt: product.name },
                    {
                      'width': '100%',
                      'max-width': '460px',
                      'border-radius': '16px',
                      'box-shadow': '0 20px 40px rgba(0, 0, 0, 0.5)',
                      'border': '2px solid rgba(255, 255, 255, 0.1)'
                    }
                  )
                ]
              )
            ]
          )
        ]
      ),

      // 3. KEY FEATURES SECTION
      createNode(
        'section',
        'Features Section',
        { tag: 'section' },
        {
          'padding-top': '60px',
          'padding-bottom': '60px',
          'background-color': '#f8fafc'
        },
        [
          createNode(
            'container',
            'Features Container',
            { tag: 'div' },
            {
              'max-width': '1140px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'heading',
                'Features Section Heading',
                { text: 'কেন এই প্রোডাক্টটি আপনার জন্য সেরা?', level: 'h2', size: 'large', align: 'center' },
                {
                  'color': '#0f172a',
                  'font-size': '28px',
                  'font-weight': '700',
                  'text-align': 'center',
                  'margin-bottom': '40px'
                }
              ),
              createNode(
                'grid',
                'Features Grid',
                { tag: 'div' },
                {
                  'display': 'grid',
                  'grid-template-columns': 'repeat(auto-fit, minmax(280px, 1fr))',
                  'gap': '24px'
                },
                [
                  createNode(
                    'icon-box',
                    'Feature 1',
                    {
                      title: 'Active Noise Cancellation',
                      description: 'বাইরের কোলাহল ও অপ্রয়োজনীয় শব্দ সম্পূর্ণ ব্লক করে একদম নিখুঁত সাউন্ড প্রদান করে।',
                      icon: 'fas fa-volume-xmark',
                      position: 'top'
                    },
                    {
                      'background-color': '#ffffff',
                      'padding': '30px 24px',
                      'border-radius': '12px',
                      'border': '1px solid #e2e8f0',
                      'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      'text-align': 'center'
                    }
                  ),
                  createNode(
                    'icon-box',
                    'Feature 2',
                    {
                      title: '৩৬ ঘণ্টার দীর্ঘ ব্যাকআপ',
                      description: 'একবার ফুল চার্জ দিলে টানা কয়েকদিন ব্যবহার করতে পারবেন নিদ্বির্ধায়।',
                      icon: 'fas fa-battery-full',
                      position: 'top'
                    },
                    {
                      'background-color': '#ffffff',
                      'padding': '30px 24px',
                      'border-radius': '12px',
                      'border': '1px solid #e2e8f0',
                      'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      'text-align': 'center'
                    }
                  ),
                  createNode(
                    'icon-box',
                    'Feature 3',
                    {
                      title: 'ওয়াটারপ্রুফ ও সোয়েটপ্রুফ',
                      description: 'IPX5 রেটেড হওয়ায় জিম, দৌড়াদৌড়ি বা হালকা বৃষ্টিতেও কোনো ক্ষতি হবে না।',
                      icon: 'fas fa-droplet',
                      position: 'top'
                    },
                    {
                      'background-color': '#ffffff',
                      'padding': '30px 24px',
                      'border-radius': '12px',
                      'border': '1px solid #e2e8f0',
                      'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      'text-align': 'center'
                    }
                  )
                ]
              )
            ]
          )
        ]
      ),

      // 3.5 PRODUCT IMAGE GALLERY SHOWCASE
      createNode(
        'section',
        'Gallery Showcase Section',
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
              'max-width': '1140px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'heading',
                'Gallery Heading',
                { text: 'প্রোডাক্টের বিশেষ ফিচার ও গ্যালারি', level: 'h2', size: 'large', align: 'center' },
                {
                  'color': '#0f172a',
                  'font-size': '28px',
                  'font-weight': '700',
                  'text-align': 'center',
                  'margin-bottom': '40px'
                }
              ),
              createNode(
                'grid',
                'Gallery Grid',
                { tag: 'div' },
                {
                  'display': 'grid',
                  'grid-template-columns': 'repeat(auto-fit, minmax(300px, 1fr))',
                  'gap': '24px'
                },
                [
                  createNode(
                    'image-box',
                    'Gallery Item 1',
                    {
                      src: '/uploads/media/product-earbuds-lifestyle.jpg',
                      title: 'হালকা ও আরামদায়ক ডিজাইন',
                      description: 'কানে পারফেক্টলি ফিট হয়, দীর্ঘক্ষণ পরলেও কানে কোনো অস্বস্তি লাগে না।',
                      position: 'top'
                    },
                    {
                      'background-color': '#f8fafc',
                      'padding': '16px',
                      'border-radius': '12px',
                      'border': '1px solid #e2e8f0',
                      'box-shadow': '0 2px 4px rgba(0,0,0,0.04)'
                    }
                  ),
                  createNode(
                    'image-box',
                    'Gallery Item 2',
                    {
                      src: '/uploads/media/product-earbuds-sound.jpg',
                      title: 'ডিপ বাস ও HD অডিও ড্রাইভার',
                      description: 'প্রতিটি বিট ও মিউজিকের রিদম একদম স্পষ্ট ও লাউড সাউন্ডে শুনুন।',
                      position: 'top'
                    },
                    {
                      'background-color': '#f8fafc',
                      'padding': '16px',
                      'border-radius': '12px',
                      'border': '1px solid #e2e8f0',
                      'box-shadow': '0 2px 4px rgba(0,0,0,0.04)'
                    }
                  ),
                  createNode(
                    'image-box',
                    'Gallery Item 3',
                    {
                      src: '/uploads/media/product-earbuds-case.jpg',
                      title: 'স্মার্ট ফাস্ট চার্জিং কেস',
                      description: 'ডিজিটাল পাওয়ার লেভেল ও টাইপ-সি ফাস্ট চার্জিং সাপোর্ট।',
                      position: 'top'
                    },
                    {
                      'background-color': '#f8fafc',
                      'padding': '16px',
                      'border-radius': '12px',
                      'border': '1px solid #e2e8f0',
                      'box-shadow': '0 2px 4px rgba(0,0,0,0.04)'
                    }
                  )
                ]
              )
            ]
          )
        ]
      ),

      // 4. TRUST & GUARANTEE BADGES
      createNode(
        'section',
        'Trust Section',
        { tag: 'section' },
        {
          'padding-top': '40px',
          'padding-bottom': '40px',
          'background-color': '#f8fafc',
          'border': '1px solid #f1f5f9'
        },
        [
          createNode(
            'container',
            'Trust Container',
            { tag: 'div' },
            {
              'max-width': '1140px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'trust-badges',
                'Badges Widget',
                { items: ['100% Original Product', 'Cash On Delivery', '7 Days Free Replacement', 'Fast Delivery'] },
                {
                  'display': 'flex',
                  'justify-content': 'space-around',
                  'flex-wrap': 'wrap',
                  'gap': '20px',
                  'font-weight': '600',
                  'color': '#0f172a'
                }
              )
            ]
          )
        ]
      ),

      // 5. CUSTOMER REVIEWS / TESTIMONIALS
      createNode(
        'section',
        'Reviews Section',
        { tag: 'section' },
        {
          'padding-top': '60px',
          'padding-bottom': '60px',
          'background-color': '#f8fafc'
        },
        [
          createNode(
            'container',
            'Reviews Container',
            { tag: 'div' },
            {
              'max-width': '1140px',
              'margin-left': 'auto',
              'margin-right': 'auto',
              'padding-left': '20px',
              'padding-right': '20px'
            },
            [
              createNode(
                'heading',
                'Reviews Heading',
                { text: 'সন্তুষ্ট গ্রাহকদের কিছু মতামত', level: 'h2', size: 'large', align: 'center' },
                {
                  'color': '#0f172a',
                  'font-size': '28px',
                  'font-weight': '700',
                  'text-align': 'center',
                  'margin-bottom': '40px'
                }
              ),
              createNode(
                'grid',
                'Testimonials Grid',
                { tag: 'div' },
                {
                  'display': 'grid',
                  'grid-template-columns': 'repeat(auto-fit, minmax(320px, 1fr))',
                  'gap': '24px'
                },
                [
                  createNode(
                    'testimonial',
                    'Review 1',
                    {
                      content: 'খুবই চমৎকার সাউন্ড কোয়ালিটি এবং ব্যাটারি ব্যাকআপ। ঢাকার মধ্যে মাত্র ১ দিনেই ডেলিভারি পেয়েছি। ধন্যবাদ!',
                      author: 'তানভীর হাসান',
                      designation: 'উত্তরা, ঢাকা',
                      rating: 5
                    },
                    {
                      'background-color': '#ffffff',
                      'padding': '24px',
                      'border-radius': '12px',
                      'border': '1px solid #e2e8f0',
                      'box-shadow': '0 2px 4px rgba(0,0,0,0.04)'
                    }
                  ),
                  createNode(
                    'testimonial',
                    'Review 2',
                    {
                      content: 'ANC ফিচারটা সত্যিই অসাধারণ। বাসে বা রাস্তায় বাইরের কোনো আওয়াজ আসে না। প্রাইজ অনুযায়ী বেস্ট প্রোডাক্ট।',
                      author: 'সাদিয়া ইসলাম',
                      designation: 'চট্টগ্রাম',
                      rating: 5
                    },
                    {
                      'background-color': '#ffffff',
                      'padding': '24px',
                      'border-radius': '12px',
                      'border': '1px solid #e2e8f0',
                      'box-shadow': '0 2px 4px rgba(0,0,0,0.04)'
                    }
                  )
                ]
              )
            ]
          )
        ]
      ),

      // 6. CASH ON DELIVERY ORDER FORM SECTION
      createNode(
        'section',
        'Order Form Section',
        { tag: 'section' },
        {
          'padding-top': '60px',
          'padding-bottom': '80px',
          'background': 'linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)'
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
                  'padding': '40px',
                  'border-radius': '16px',
                  'box-shadow': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  'border': '2px solid #10b981'
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
                    { text: 'অর্ডার করতে আপনার সঠিক তথ্য দিন', level: 'h3', size: 'medium', align: 'left' },
                    {
                      'color': '#0f172a',
                      'font-size': '22px',
                      'font-weight': '700',
                      'margin': '0 0 8px 0'
                    }
                  ),
                  createNode(
                    'paragraph',
                    'Form Instruction',
                    { text: 'নিচের ফর্মটি পূরণ করে সাবমিট করুন, আমাদের প্রতিনিধি আপনার সাথে কল করে অর্ডার কনফার্ম করবেন।' },
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
                        'flex',
                        'Summary Product Row',
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
                            'Product Thumbnail',
                            { src: productImage, alt: product.name },
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
                            'Product Info Col',
                            { tag: 'div' },
                            { 'flex': '1' },
                            [
                              createNode(
                                'heading',
                                'Product Mini Title',
                                { text: product.name, level: 'h4', size: 'small', align: 'left' },
                                { 'margin': '0 0 4px 0', 'font-size': '15px', 'font-weight': '600', 'color': '#0f172a' }
                              ),
                              createNode(
                                'text',
                                'Product Mini Price',
                                { text: `পরিমাণ: ১টি | অফার মূল্য: ৳${salePrice} (${discountPercent}% ছাড়)` },
                                { 'font-size': '13px', 'color': '#0f766e', 'font-weight': '600' }
                              )
                            ]
                          )
                        ]
                      ),
                      createNode(
                        'flex',
                        'Price Breakdown Row 1',
                        { tag: 'div' },
                        { 'display': 'flex', 'justify-content': 'space-between', 'font-size': '14px', 'color': '#475569', 'margin-bottom': '6px' },
                        [
                          createNode('text', 'Subtotal Label', { text: 'পণ্যের মূল্য:' }),
                          createNode('text', 'Subtotal Value', { text: `৳${salePrice}` }, { 'font-weight': '600' })
                        ]
                      ),
                      createNode(
                        'flex',
                        'Price Breakdown Row 2',
                        { tag: 'div' },
                        { 'display': 'flex', 'justify-content': 'space-between', 'font-size': '14px', 'color': '#475569', 'margin-bottom': '8px' },
                        [
                          createNode('text', 'Shipping Label', { text: 'ডেলিভারি চার্জ:' }),
                          createNode('text', 'Shipping Value', { text: `৳${insideDhaka}` }, { 'font-weight': '600', 'color': '#0f766e' }, [], {}, { id: 'checkout-shipping-charge' })
                        ]
                      ),
                      createNode(
                        'flex',
                        'Price Breakdown Row Total',
                        { tag: 'div' },
                        { 'display': 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'font-size': '16px', 'font-weight': '700', 'color': '#0f172a', 'padding-top': '10px', 'border-top': '1px dashed #cbd5e1' },
                        [
                          createNode('text', 'Total Label', { text: 'সর্বমোট প্রদেয় বিল:' }),
                          createNode('text', 'Total Value', { text: `৳${initialTotal}` }, { 'color': '#0f766e', 'font-size': '18px' }, [], {}, { id: 'checkout-grand-total', 'data-base-price': String(salePrice) })
                        ]
                      )
                    ]
                  ),

                  // The Elementor Native Form
                  createNode(
                    'form',
                    'Lead Capture Form',
                    {
                      formName: 'Direct Product Order Form',
                      successMessage: 'ধন্যবাদ! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। শীঘ্রই আমাদের প্রতিনিধি যোগাযোগ করবেন।'
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
                          required: true,
                          placeholder: 'উদাঃ তানভীর হাসান'
                        },
                        {
                          'font-size': '14px',
                          'color': '#334155'
                        }
                      ),
                      createNode(
                        'form-field',
                        'Phone Number',
                        {
                          fieldName: 'customer_phone',
                          label: 'আপনার মোবাইল নম্বর *',
                          inputType: 'tel',
                          required: true,
                          placeholder: 'উদাঃ 01XXXXXXXXX'
                        },
                        {
                          'font-size': '14px',
                          'color': '#334155'
                        }
                      ),
                      createNode(
                        'form-field',
                        'Delivery Address',
                        {
                          fieldName: 'customer_address',
                          label: 'সম্পূর্ণ ডেলিভারি ঠিকানা (বাসা/রোড/থানা/জেলা) *',
                          inputType: 'textarea',
                          required: true,
                          placeholder: 'আপনার বিস্তারিত ঠিকানা লিখুন...'
                        },
                        {
                          'font-size': '14px',
                          'color': '#334155'
                        }
                      ),
                      createNode(
                        'form-field',
                        'Delivery Area Radio',
                        {
                          fieldName: 'shipping_area',
                          label: 'ডেলিভারি চার্জ ও এরিয়া নির্বাচন করুন *',
                          inputType: 'radio',
                          defaultValue: `ঢাকার ভিতরে (ডেলিভারি চার্জ ৳${insideDhaka})`,
                          options: [
                            `ঢাকার ভিতরে (ডেলিভারি চার্জ ৳${insideDhaka})`,
                            `ঢাকার সাব-এরিয়া (ডেলিভারি চার্জ ৳${subArea})`,
                            `ঢাকার বাইরে সমগ্র বাংলাদেশ (ডেলিভারি চার্জ ৳${outsideDhaka})`
                          ].join('\n'),
                          required: true
                        },
                        {
                          'font-size': '14px',
                          'color': '#334155'
                        }
                      ),
                      createNode(
                        'form-field',
                        'Product ID Hidden',
                        {
                          fieldName: 'product_id',
                          label: 'Product ID',
                          inputType: 'hidden',
                          defaultValue: product.id
                        }
                      ),
                      createNode(
                        'form-submit',
                        'Submit Order Button',
                        { text: `অর্ডার কনফার্ম করুন - ৳${initialTotal}` },
                        {
                          'background-color': '#10b981',
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

      // 7. FOOTER SECTION
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
            { text: `© ${new Date().getFullYear()} NIX Commerce Store. সর্বস্বত্ব সংরক্ষিত।` },
            { 'color': '#94a3b8' }
          )
        ]
      )
    ]
  };

  // Validate the page document against strict schema
  console.log('Validating PageDocument schema...');
  const validated = parseDocument(doc);
  console.log('Document schema validated successfully!');

  // Render HTML preview test
  const rendered = renderHtml(validated, { siteName: 'NIX Store' });
  console.log(`Rendered HTML length: ${rendered.length} characters`);

  // Upsert the BuilderPage into database
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

  // Also save as template in BuilderTemplate library
  const existingTemplate = await prisma.builderTemplate.findFirst({ where: { name: 'High-Converting Product Landing Template' } });
  if (!existingTemplate) {
    await prisma.builderTemplate.create({
      data: {
        name: 'High-Converting Product Landing Template',
        document: JSON.stringify(validated),
        createdBy: userId
      }
    });
    console.log('Created Template in Library: "High-Converting Product Landing Template"');
  }

  console.log('\n=============================================');
  console.log('🎉 Landing Page Successfully Created & Published!');
  console.log(`📌 Page Title: ${savedPage.title}`);
  console.log(`📌 Page ID: ${savedPage.id}`);
  console.log(`📌 Studio Editor URL: /builder/pages/${savedPage.id}`);
  console.log(`📌 Public Landing URL: /b/${savedPage.slug}`);
  console.log('=============================================\n');
}

main()
  .catch(err => {
    console.error('Error creating landing page:', err);
  })
  .finally(() => prisma.$disconnect());
