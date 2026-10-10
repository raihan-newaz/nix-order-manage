import { ensureLandingThankYou } from '../modules/builder/landingService';
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

// Crisp inline SVGs (Strictly NO emojis anywhere)
const SVG_ICONS = {
  cart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  star: `<svg width="15" height="15" viewBox="0 0 20 20" fill="#f59e0b"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`,
  shield: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  truck: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="13" x="1" y="6" rx="2"/><path d="M17 9h4l2 4v6h-6"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>`,
  exchange: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`,
  sparkles: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
  check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  badgeCheck: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  packageCheck: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>`
};

interface BorkaConcept {
  name: string;
  slug: string;
  sku: string;
  regularPrice: number;
  salePrice: number;
  buyPrice: number;
  category: string;
  description: string;
  tagline: string;
  styleAesthetic: string;
  image: string;
  colors: Array<{ name: string; hex: string; image: string }>;
  sizes: string[];
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    bgGradient: string;
    cardBg: string;
    textColor: string;
    noticeBg: string;
    noticeText: string;
  };
  features: Array<{ title: string; desc: string }>;
  reviews: Array<{ name: string; city: string; text: string; date: string }>;
}

const borkaCatalog: BorkaConcept[] = [
  // 1. DUBAI CHERRY SILK (Minimalist Luxury Noir & Emerald Gold)
  {
    name: 'দুবাই চেরি সিল্ক ডিজাইনার বোরখা',
    slug: 'borka-dubai-cherry',
    sku: 'BORKA-DUBAI-001',
    regularPrice: 1650,
    salePrice: 1190,
    buyPrice: 750,
    category: 'Borka Collection',
    tagline: 'অরিজিনাল দুবাই চেরি জর্জেট ফেব্রিকে নিখুঁত হাতের কাজ ও প্রিমিয়াম এমব্রয়ডারি।',
    styleAesthetic: 'Noir & Emerald Gold Luxury',
    image: '/uploads/media/borka-dubai-cherry.jpg',
    description: 'অরিজিনাল দুবাই চেরি জর্জেট ফেব্রিক্সে তৈরি নিখুঁত হাতের কাজ ও প্রিমিয়াম এমব্রয়ডারি। অত্যন্ত আরামদায়ক ও গর্জিয়াস লুক যা আপনাকে দেবে মার্জিত শালীনতা।',
    colors: [
      { name: 'Emerald Green', hex: '#064e3b', image: '/uploads/media/borka-dubai-cherry.jpg' },
      { name: 'Jet Black', hex: '#18181b', image: '/uploads/media/borka-dubai-cherry.jpg' },
      { name: 'Maroon', hex: '#800000', image: '/uploads/media/borka-dubai-cherry.jpg' },
      { name: 'Navy Blue', hex: '#000080', image: '/uploads/media/borka-dubai-cherry.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#065f46',
      secondary: '#0f172a',
      accent: '#ecfdf5',
      bgGradient: 'linear-gradient(180deg, #fafaf9 0%, #f0fdf4 100%)',
      cardBg: '#ffffff',
      textColor: '#064e3b',
      noticeBg: 'linear-gradient(90deg, #064e3b 0%, #047857 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: '১০০% অরিজিনাল দুবাই চেরি জর্জেট', desc: 'অত্যন্ত সফট, লাইটওয়েট এবং বাতাস চলাচলকারী ফেব্রিক যা গরমেও সম্পূর্ণ আরামদায়ক।' },
      { title: 'প্রিমিয়াম এমব্রয়ডারি ফিনিশিং', desc: 'প্রতিটি সুতার কাজ অত্যন্ত যত্নসহকারে করা, দীর্ঘদিন ব্যবহারে সুতা ওঠার কোনো ঝুঁকি নেই।' },
      { title: 'মার্জিত শালীন কাটিং ও ফল', desc: 'বডি শেপ পুরোপুরি মার্জিত রাখে এবং অসাধারণ ফল ও আধুনিক লুক ফুটিয়ে তোলে।' },
      { title: 'সহজ ওয়াশ ও কালার গ্যারান্টি', desc: 'সহজে রিঙ্কেল পড়ে না এবং বারবার ধোয়ার পরেও রঙের উজ্জ্বলতা অপরিবর্তিত থাকে।' }
    ],
    reviews: [
      { name: 'ফারজানা হক', city: 'ধানমন্ডি, ঢাকা', text: 'দুবাই চেরি ফেব্রিকটা অসম্ভব নরম ও আরামদায়ক। ছবির চেয়েও বাস্তবে অনেক বেশি সুন্দর!', date: '২ দিন আগে' },
      { name: 'নুসরাত জাহান', city: 'পাঁচলাইশ, চট্টগ্রাম', text: 'ডেলিভারি ম্যানের সামনে খুলে চেক করে নিয়েছি। সেলাই ও সাইজ একদম পারফেক্ট হয়েছে।', date: '৩ দিন আগে' }
    ]
  },

  // 2. ROYAL DUBAI KAFTAN (Imperial Sapphire Palace & Silver Zardozi)
  {
    name: 'রয়্যাল দুবাই কাফতান স্টাইল আবায়া',
    slug: 'borka-dubai-kaftan',
    sku: 'BORKA-KAFTAN-002',
    regularPrice: 2150,
    salePrice: 1550,
    buyPrice: 950,
    category: 'Borka Collection',
    tagline: 'রাজকীয় চওড়া কাফতান কাটিংয়ে সিলভার সুতার নিখুঁত জারদৌসি নকশা।',
    styleAesthetic: 'Imperial Sapphire & Silver Palace',
    image: '/uploads/media/borka-dubai-kaftan.jpg',
    description: 'দুবাই কাফতানের বিশাল রাজকীয় ঘের ও বুকজুড়ে রূপালি কারুকাজ। অনন্য গর্জিয়াস ফিটিং যা যেকোনো দাওয়াতে আপনার ব্যক্তিত্বকে করবে সবার চেয়ে আলাদা ও আকর্ষণীয়।',
    colors: [
      { name: 'Royal Navy', hex: '#1e3a8a', image: '/uploads/media/borka-dubai-kaftan.jpg' },
      { name: 'Teal Peacock', hex: '#0f766e', image: '/uploads/media/borka-dubai-kaftan.jpg' },
      { name: 'Midnight Black', hex: '#020617', image: '/uploads/media/borka-dubai-kaftan.jpg' },
      { name: 'Wine Red', hex: '#881337', image: '/uploads/media/borka-dubai-kaftan.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#1e3a8a',
      secondary: '#020617',
      accent: '#eff6ff',
      bgGradient: 'linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%)',
      cardBg: '#ffffff',
      textColor: '#1e3a8a',
      noticeBg: 'linear-gradient(90deg, #020617 0%, #1e3a8a 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: 'বিশাল ফ্লোয়িং কাফতান কাট', desc: 'অসাধারণ রাজকীয় ঘের যা হাঁটার সময় বাতাসের মতো ঢেউ তুলে দোলে।' },
      { title: 'সিলভার জারদৌসি নেকলাইন', desc: 'বুকের ওপর চকচকে রূপালি সুতার হাতে তৈরি কারুকাজ যা আভিজাত্যের প্রতীক।' },
      { title: 'অভ্যন্তরীণ অ্যাডজাস্টেবল বেল্ট', desc: 'ভেতরের বেল্ট দিয়ে নিজের শরীরের সাথে মানানসই টাইট বা লুজ করে নেওয়া যায়।' },
      { title: 'উচ্চমানের ব্রিদেবল ক্রেপ', desc: 'শরীর ঘেমে চটচটে হয় না, শীত-গ্রীষ্ম সবসময় স্বাচ্ছন্দ্যে পরার উপযোগী।' }
    ],
    reviews: [
      { name: 'আমিনা বেগম', city: 'গুলশান, ঢাকা', text: 'কাফতানের ঘেরটা এত চমৎকার যে পরলেই একটা রাজকীয় অনুভূতি হয়। কোয়ালিটি ১০০/১০০।', date: 'গতকাল' },
      { name: 'তাসলিমা নাসরিন', city: 'খুলনা সদর', text: 'কাপড়টা যেমন সফট, সেলাইয়ের ফিনিশিংও তেমন উন্নত। NIX-কে অসংখ্য ধন্যবাদ!', date: '৪ দিন আগে' }
    ]
  },

  // 3. TURKISH BUTTERFLY FLARE (Istanbul Rose Boutique)
  {
    name: 'টার্কিশ বাটারফ্লাই ফ্লেয়ার আবায়া',
    slug: 'borka-turkish-butterfly',
    sku: 'BORKA-TURK-003',
    regularPrice: 1950,
    salePrice: 1380,
    buyPrice: 850,
    category: 'Borka Collection',
    tagline: 'তুরস্কের আধুনিক বাটারফ্লাই ফ্লেয়ার কাট যা দেয় সম্পূর্ণ শালীন ও নজরকাড়া রূপ।',
    styleAesthetic: 'Istanbul Rose Boutique',
    image: '/uploads/media/borka-turkish-butterfly.jpg',
    description: 'পাখির ডানার মতো ফ্লোয়িং বাটারফ্লাই হাতার ডিজাইন। তুরস্কের ফ্যাশন ট্রেন্ড অনুযায়ী তৈরি অত্যন্ত মিষ্টি ও এলিগ্যান্ট আবায়া যা তরুণীদের প্রথম পছন্দ।',
    colors: [
      { name: 'Dusty Rose', hex: '#be185d', image: '/uploads/media/borka-turkish-butterfly.jpg' },
      { name: 'Pastel Lilac', hex: '#7c3aed', image: '/uploads/media/borka-turkish-butterfly.jpg' },
      { name: 'Soft Mocca', hex: '#92400e', image: '/uploads/media/borka-turkish-butterfly.jpg' },
      { name: 'Pure Black', hex: '#0f172a', image: '/uploads/media/borka-turkish-butterfly.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#be185d',
      secondary: '#831843',
      accent: '#fdf2f8',
      bgGradient: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)',
      cardBg: '#ffffff',
      textColor: '#831843',
      noticeBg: 'linear-gradient(90deg, #831843 0%, #be185d 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: 'আধুনিক বাটারফ্লাই স্লিভ', desc: 'হাত তুললে চমৎকার ফ্লেয়ার ডানা তৈরি হয়, যা অত্যন্ত শালীন ও রুচিশীল।' },
      { title: 'সফট প্রিমিয়াম জর্জেট শিফন', desc: 'ডাবল লেয়ার ফেব্রিক ব্যবহারের কারণে একদম অপেক এবং অস্বচ্ছ।' },
      { title: 'ইলাস্টিক কুঁচি রিস্ট কাফ', desc: 'হাতে পারফেক্ট গ্রিপ থাকে, হাত নাড়াচাড়ায় হাতা নেমে যাওয়ার ঝামেলা নেই।' },
      { title: 'হালকা ও সহজে বহনযোগ্য', desc: 'ঘণ্টার পর ঘণ্টা পরে থাকলেও কোনো ক্লান্তি বা ভারী ভাব অনুভূত হয় না।' }
    ],
    reviews: [
      { name: 'মুমতাহিনা তাবাসসুম', city: 'উত্তরা, ঢাকা', text: 'বাটারফ্লাই ডানাটা দারুণ! কালারটা একদম মিষ্টি গোলাপি আর কাপড়টাও ভীষণ আরামদায়ক।', date: '৩ দিন আগে' }
    ]
  },

  // 4. KASHMIRI PARTY WEAR (Artisan Heritage Gold)
  {
    name: 'কাশ্মীরি পার্টি ওয়্যার এমব্রয়ডারি বোরখা',
    slug: 'borka-kashmiri-party',
    sku: 'BORKA-KASH-004',
    regularPrice: 2450,
    salePrice: 1750,
    buyPrice: 1050,
    category: 'Borka Collection',
    tagline: 'কাশ্মীরি রেশম সুতার নিখুঁত ট্র্যাডিশনাল ফুলের নকশায় জমকালো উৎসবের সাজ।',
    styleAesthetic: 'Artisan Heritage Burgundy & Gold',
    image: '/uploads/media/borka-kashmiri-party.jpg',
    description: 'বুক, হাতা এবং নিচের ঘেরজুড়ে ঘন কাশ্মীরি রেশমি সুতার নিখুঁত ট্র্যাডিশনাল কাজ। বিয়ে, রিসিপশন কিংবা বিশেষ পারিবারিক অনুষ্ঠানের জন্য এটি অতুলনীয় সেরা নির্বাচন।',
    colors: [
      { name: 'Burgundy Maroon', hex: '#831843', image: '/uploads/media/borka-kashmiri-party.jpg' },
      { name: 'Deep Emerald', hex: '#064e3b', image: '/uploads/media/borka-kashmiri-party.jpg' },
      { name: 'Royal Coffee', hex: '#451a03', image: '/uploads/media/borka-kashmiri-party.jpg' },
      { name: 'Classic Black', hex: '#18181b', image: '/uploads/media/borka-kashmiri-party.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#991b1b',
      secondary: '#450a0a',
      accent: '#fef2f2',
      bgGradient: 'linear-gradient(180deg, #fef2f2 0%, #fffbeb 100%)',
      cardBg: '#ffffff',
      textColor: '#7f1d1d',
      noticeBg: 'linear-gradient(90deg, #450a0a 0%, #991b1b 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: 'আসল কাশ্মীরি রেশম সুতা', desc: 'বহুরঙা উজ্জ্বল রেশম সুতায় সূক্ষ্ম ফুলের নকশা যা ধোয়ার পরেও নষ্ট হয় না।' },
      { title: 'উচ্চমানের ভারী চেরি সিল্ক', desc: 'কাপড়ের ওজন ও ঘনত্ব চমৎকার, কোনোভাবেই শরীর প্রদর্শনের সুযোগ নেই।' },
      { title: 'নেকলাইন ও ব্যাক সাইড ওয়ার্ক', desc: 'সামনের গলার পাশাপাশি পেছনের পিঠেও নান্দনিক বুটি কাজের কাজ রয়েছে।' },
      { title: 'লাইফটাইম এমব্রয়ডারি সিকিউরিটি', desc: 'লক-স্টিচ প্রযুক্তিতে এমব্রয়ডারি করা তাই সুতা উঠে যাওয়ার ভয় নেই।' }
    ],
    reviews: [
      { name: 'মেহেরুন্নেসা', city: 'মতিঝিল, ঢাকা', text: 'আমার বোনের বিয়েতে পরেছিলাম, সবাই বোরখাটির অনেক প্রশংসা করেছে।', date: '২ দিন আগে' }
    ]
  },

  // 5. FRONT OPEN COAT STYLE (Monochrome Haute Minimalist)
  {
    name: 'ফ্রন্ট ওপেন কোটি স্টাইল কোট বোরখা',
    slug: 'borka-front-open-coat',
    sku: 'BORKA-COAT-005',
    regularPrice: 2050,
    salePrice: 1450,
    buyPrice: 880,
    category: 'Borka Collection',
    tagline: 'কোট কাটিং ও ফ্রন্ট বাটন ওপেন সিস্টেমে স্মার্ট ও আধুনিক শালীন আউটফিট।',
    styleAesthetic: 'Urban Corporate Slate Minimalist',
    image: '/uploads/media/borka-front-open-coat.jpg',
    description: 'অফিস, ইউনিভার্সিটি কিংবা প্রফেশনাল নারীদের জন্য ডিজাইন করা স্মার্ট কোট স্টাইল বোরখা। সামনে প্রিমিয়াম বাটন ও বেল্ট সুবিধা থাকায় ইচ্ছামতো স্টাইল করে পরা যায়।',
    colors: [
      { name: 'Slate Charcoal', hex: '#334155', image: '/uploads/media/borka-front-open-coat.jpg' },
      { name: 'Jet Black', hex: '#0f172a', image: '/uploads/media/borka-front-open-coat.jpg' },
      { name: 'Mocha Tan', hex: '#78350f', image: '/uploads/media/borka-front-open-coat.jpg' },
      { name: 'Olive Green', hex: '#3f6212', image: '/uploads/media/borka-front-open-coat.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#334155',
      secondary: '#0f172a',
      accent: '#f1f5f9',
      bgGradient: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
      cardBg: '#ffffff',
      textColor: '#0f172a',
      noticeBg: 'linear-gradient(90deg, #0f172a 0%, #334155 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: '২-ইন-১ মাল্টিপল স্টাইলিং', desc: 'সামনে বাটন বন্ধ করে সাধারণ বোরখা অথবা বাটন খুলে শ্রাগ কোটের মতো পরা যায়।' },
      { title: 'স্মার্ট ল্যাপেল কলার কাটিং', desc: 'ওয়েস্টার্ন ব্লেজারের আদলে তৈরি ল্যাপেল যা কর্পোরেট ও মার্জিত লুক দেয়।' },
      { title: 'ডাবল সাইড ডিপ পকেট', desc: 'মোবাইল, চাবি বা পার্স নিরাপদে রাখার জন্য উভয় পাশে ডিপ সাইড পকেট।' },
      { title: 'অ্যান্টি-রিঙ্কেল হেভি টেক্সচার', desc: 'সহজে কুঁচকে যায় না, সারাদিন টানটান প্রেস করা লুক বজায় থাকে।' }
    ],
    reviews: [
      { name: 'সাবরিনা মোস্তফা', city: 'বনানী, ঢাকা', text: 'অফিসে পরার জন্য এটি একদম আদর্শ। পকেট থাকাটা অনেক বড় সুবিধা।', date: '৩ দিন আগে' }
    ]
  },

  // 6. DOUBLE LAYER MERMAID (Boho Sand & Caramel Mocha)
  {
    name: 'ডাবল লেয়ার্ড মারমেইড বোরখা উইথ কোটি',
    slug: 'borka-double-layer-koti',
    sku: 'BORKA-KOTI-006',
    regularPrice: 2250,
    salePrice: 1590,
    buyPrice: 980,
    category: 'Borka Collection',
    tagline: 'আলাদা কোটি ও মারমেইড ফ্লেয়ার বোরখার ২-পিস প্রিমিয়াম কম্বিনেশন।',
    styleAesthetic: 'Boho Earthy Mocha & Sand',
    image: '/uploads/media/borka-double-layer-koti.jpg',
    description: 'নিচের ইনার মারমেইড বোরখা এবং ওপরের আকর্ষণীয় কোটি সম্পূর্ণ আলাদা। আলাদাভাবে পরে ভিন্ন ভিন্ন লুক তৈরি করার অসাধারণ সুযোগ।',
    colors: [
      { name: 'Mocha Caramel', hex: '#78350f', image: '/uploads/media/borka-double-layer-koti.jpg' },
      { name: 'Coffee Brown', hex: '#451a03', image: '/uploads/media/borka-double-layer-koti.jpg' },
      { name: 'Dusty Rose', hex: '#9d174d', image: '/uploads/media/borka-double-layer-koti.jpg' },
      { name: 'Jet Black', hex: '#18181b', image: '/uploads/media/borka-double-layer-koti.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#92400e',
      secondary: '#451a03',
      accent: '#fef3c7',
      bgGradient: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
      cardBg: '#ffffff',
      textColor: '#78350f',
      noticeBg: 'linear-gradient(90deg, #451a03 0%, #92400e 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: 'আলাদা ডিটাচেবল কোটি', desc: 'কোটিটি খুলে আপনি অন্য যেকোনো ড্রেসের সাথেও চমৎকারভাবে ম্যাচ করে পরতে পারবেন।' },
      { title: 'মারমেইড ফ্লেয়ারড হেমলাইন', desc: 'নিচের অংশে মারমেইড স্টাইলের স্তর যা হাঁটার সময় অসম্ভব মোহনীয় দেখায়।' },
      { title: 'ভারী রেশম সুতার কাজ', desc: 'কোটির সামনের অংশে নিখুঁত জারদৌসি ও বুটিক এমব্রয়ডারি কাজের স্পর্শ।' },
      { title: 'ডাবল লেয়ার আরামদায়ক ফল', desc: 'কাপড়ের দুটি লেয়ার হওয়া সত্ত্বেও অত্যন্ত নিঃশ্বাসযোগ্য ও আরামদায়ক।' }
    ],
    reviews: [
      { name: 'রোকসানা পারভীন', city: 'রাজশাহী সদর', text: 'কোটিটা আলাদা থাকায় এটা অন্য জামার সাথেও পরা যায়। কাপড়টাও খুব ভালো।', date: '৪ দিন আগে' }
    ]
  },

  // 7. DIAMOND STONE WORK KIMONO (Midnight Runway Jet Black)
  {
    name: 'ডায়মন্ড স্টোন ওয়ার্ক কিমোনো বোরখা',
    slug: 'borka-diamond-kimono',
    sku: 'BORKA-KIM-007',
    regularPrice: 2100,
    salePrice: 1480,
    buyPrice: 900,
    category: 'Borka Collection',
    tagline: 'জাপানিজ কিমোনো কাটিং ও উজ্জ্বল ডায়মন্ড স্টোন ওয়ার্কের দীপ্তি।',
    styleAesthetic: 'Midnight Jet Black & Silver Sparkle',
    image: '/uploads/media/borka-diamond-kimono.jpg',
    description: 'জাপানিজ কিমোনো স্লীভ প্যাটার্নে মধ্যপ্রাচ্যের ডায়মন্ড স্টোন ওয়ার্কের অপূর্ব সংমিশ্রণ। চওড়া হাতার স্টাইলিশ কাট ও গর্জিয়াস স্টোনের দ্যুতি যেকোনো সন্ধ্যাকালীন অনুষ্ঠানে অনন্য উজ্জ্বলতা ছড়াবে।',
    colors: [
      { name: 'Midnight Jet Black', hex: '#09090b', image: '/uploads/media/borka-diamond-kimono.jpg' },
      { name: 'Silver Gray', hex: '#64748b', image: '/uploads/media/borka-diamond-kimono.jpg' },
      { name: 'Burgundy', hex: '#831843', image: '/uploads/media/borka-diamond-kimono.jpg' },
      { name: 'Emerald', hex: '#065f46', image: '/uploads/media/borka-diamond-kimono.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#0e7490',
      secondary: '#09090b',
      accent: '#ecfeff',
      bgGradient: 'linear-gradient(180deg, #09090b 0%, #1e293b 100%)',
      cardBg: '#18181b',
      textColor: '#ffffff',
      noticeBg: 'linear-gradient(90deg, #09090b 0%, #155e75 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: 'ওয়াইড কিমোনো কাটিং স্লীভ', desc: 'চওড়া কিমোনো হাতা যা পরলে অত্যন্ত স্টাইলিশ ও গর্জিয়াস দেখায়।' },
      { title: 'উজ্জ্বল কোরিয়ান ক্রিস্টাল স্টোন', desc: 'আলোতে হিরের মতো চকচক করে এবং স্পেশাল হিট-প্রেসে বসানো হওয়ায় দীর্ঘস্থায়ী।' },
      { title: 'সফট প্রিমিয়াম চেরি ফেব্রিক', desc: 'শরীর জড়িয়ে থাকে না, অত্যন্ত ফ্লোয়িং এবং মার্জিত শালীনতা বজায় রাখে।' },
      { title: 'উন্নত সাইড নচ ও বেল্ট স্টাইলিং', desc: 'সাথে থাকা ডিজাইনার বেল্ট দিয়ে ইচ্ছেমতো কোমর অ্যাডজাস্ট করে পরা যায়।' }
    ],
    reviews: [
      { name: 'নিগার সুলতানা', city: 'লালমাটিয়া, ঢাকা', text: 'কিমোনো হাতাটা পরলে অসম্ভব সুন্দর লাগে। স্টোনের কোয়ালিটি অনেক ব্রাইট।', date: 'গতকাল' }
    ]
  },

  // 8. PURE ARABIC LINEN DAILY (Pure Nature Organic Lifestyle)
  {
    name: 'পিওর এরাবিক লিনেন ডেইলি ব্রিদেবল বোরখা',
    slug: 'borka-arabic-linen',
    sku: 'BORKA-LINEN-008',
    regularPrice: 1550,
    salePrice: 1050,
    buyPrice: 650,
    category: 'Borka Collection',
    tagline: '১০০% প্রাকৃতিক ব্রিদেবল লিনেনে সারাদিন পরার সেরা আরামদায়ক সমাধান।',
    styleAesthetic: 'Earthy Organic Warm Sand & Olive',
    image: '/uploads/media/borka-arabic-linen.jpg',
    description: 'বিশুদ্ধ এরাবিক লিনেন সুতায় তৈরি অত্যন্ত নিঃশ্বাসযোগ্য ও আরামদায়ক ক্যাজুয়াল বোরখা। তীব্র গরমেও ঘাম শোষণ করে এবং শরীরকে রাখে শীতল ও প্রাণবন্ত।',
    colors: [
      { name: 'Sage Olive', hex: '#3f6212', image: '/uploads/media/borka-arabic-linen.jpg' },
      { name: 'Desert Brown', hex: '#78350f', image: '/uploads/media/borka-arabic-linen.jpg' },
      { name: 'Cream Beige', hex: '#a16207', image: '/uploads/media/borka-arabic-linen.jpg' },
      { name: 'Pure White', hex: '#f8fafc', image: '/uploads/media/borka-arabic-linen.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#4d7c0f',
      secondary: '#365314',
      accent: '#f7fee7',
      bgGradient: 'linear-gradient(180deg, #fefce8 0%, #ffffff 100%)',
      cardBg: '#ffffff',
      textColor: '#365314',
      noticeBg: 'linear-gradient(90deg, #365314 0%, #4d7c0f 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: '১০০% পিওর এরাবিক লিনেন ফেব্রিক', desc: 'প্রাকৃতিক তুলোর মিশ্রণে তৈরি, যাতে বাতাস চলাচলের সর্বোচ্চ সুযোগ থাকে।' },
      { title: 'ঘাম শোষণ ও গন্ধ প্রতিরোধী', desc: 'সারাদিন রোদে চলাফেরা করলেও শরীর শুকনো ও সতেজ রাখতে অতুলনীয়।' },
      { title: 'মিনিমালিস্ট ক্লাসিক ফিনিশ', desc: 'কোনো কৃত্রিম চাকচিক্য নেই, রুচিশীল ও মার্জিত ন্যাচারাল লাইফস্টাইল লুক।' },
      { title: 'প্রতি ওয়াশে আরও সফট হয়', desc: 'প্রাকৃতিক লিনেনের বিশেষ বৈশিষ্ট্য—ধোয়ার সাথে সাথে কাপড়টি আরও নমনীয় ও আরামদায়ক হয়।' }
    ],
    reviews: [
      { name: 'উম্মে হাবিবা', city: 'মিরপুর ডিওএইচএস, ঢাকা', text: 'গরমে প্রতিদিন পরার জন্য এর চেয়ে ভালো কোনো বোরখা হতে পারে না!', date: '২ দিন আগে' }
    ]
  },

  // 9. ROYAL VELVET WINTER SPECIAL (Aristocrat Velvet Lounge)
  {
    name: 'রয়্যাল ভেলভেট উইন্টার স্পেশাল বোরখা',
    slug: 'borka-royal-velvet',
    sku: 'BORKA-VELV-009',
    regularPrice: 3200,
    salePrice: 2250,
    buyPrice: 1400,
    category: 'Borka Collection',
    tagline: 'শীতের রাজকীয় উষ্ণতা ও ভেলভেটের জমকালো আভিজাত্যে শীতের সেরা সাজ।',
    styleAesthetic: 'Winter Aristocrat Sapphire Velvet',
    image: '/uploads/media/borka-royal-velvet.jpg',
    description: 'উচ্চমানের ইম্পোর্টেড মাইক্রো ভেলভেট ফ্যাব্রিকে তৈরি শীতকালীন স্পেশাল বোরখা। গাঢ় রঙের ভেলভেটে সোনালি জরির বর্ডার কাজ শীতের আবহাওয়ায় দেয় উষ্ণতা ও রাজকীয় আভিজাত্য।',
    colors: [
      { name: 'Sapphire Velvet', hex: '#172554', image: '/uploads/media/borka-royal-velvet.jpg' },
      { name: 'Emerald Velvet', hex: '#064e3b', image: '/uploads/media/borka-royal-velvet.jpg' },
      { name: 'Ruby Maroon', hex: '#4c0519', image: '/uploads/media/borka-royal-velvet.jpg' },
      { name: 'Pitch Black', hex: '#020617', image: '/uploads/media/borka-royal-velvet.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#1e3a8a',
      secondary: '#0f172a',
      accent: '#eff6ff',
      bgGradient: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
      cardBg: '#1e293b',
      textColor: '#ffffff',
      noticeBg: 'linear-gradient(90deg, #ca8a04 0%, #a16207 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: 'হেভি ইম্পোর্টেড মাইক্রো ভেলভেট', desc: 'মখমলের মতো অতি নরম ও উজ্জ্বল যা গায়ে জড়ালেই শীত দূর হয়ে যায়।' },
      { title: 'সোনালি জরি লেস এমব্রয়ডারি', desc: 'কফ ও ফ্রন্ট বর্ডারে নিখুঁত অ্যান্টিক গোল্ডেন জরির জমকালো কাজ।' },
      { title: 'উষ্ণ কিন্তু পরিধানে হালকা', desc: 'ভারী কম্বলের মতো বোঝা লাগে না, পরিধানে অত্যন্ত আরামদায়ক ও স্টাইলিশ।' },
      { title: 'লং-লাস্টিং ভেলভেট শাইন', desc: 'উচ্চমানের ফিনিশিং তাই ভেলভেটের রোঁয়া উঠে না এবং রঙ ফ্যাকাশে হয় না।' }
    ],
    reviews: [
      { name: 'ফারজানা ইয়াসমিন', city: 'গুলশান, ঢাকা', text: 'ভেলভেটের কাপড়টা অসম্ভব প্রিমিয়াম! শীতে যে কোনো অনুষ্ঠানে পরার জন্য এর চেয়ে গর্জিয়াস আর কিছু হতে পারে না।', date: 'গতকাল' }
    ]
  },

  // 10. NAWAB 3-PIECE PREMIUM HIJAB SET (Imperial Mughal Elegance)
  {
    name: 'নবাব প্রিমিয়াম ৩-পিস হিজাব সেট বোরখা',
    slug: 'borka-nawab-hijab-set',
    sku: 'BORKA-NAWAB-010',
    regularPrice: 2150,
    salePrice: 1350,
    buyPrice: 850,
    category: 'Borka Collection',
    tagline: 'বোরখা + ম্যাচিং সাইজ হিজাব + প্রিমিয়াম নিকাব/বেল্ট এর সম্পূর্ণ ৩-পিস সেট।',
    styleAesthetic: 'Imperial Mughal Plum & Gold',
    image: '/uploads/media/borka-nawab-hijab-set.jpg',
    description: 'আলাদা করে হিজাব বা বেল্ট কেনার বাড়তি ঝামেলা ছাড়াই পাচ্ছেন কালার ম্যাচিং বড় সাইজ হিজাব ও প্রিমিয়াম ডিজাইনার বেল্টসহ রাজকীয় ৩-পিস কমপ্লিট সেট।',
    colors: [
      { name: 'Imperial Plum', hex: '#581c87', image: '/uploads/media/borka-nawab-hijab-set.jpg' },
      { name: 'Midnight Navy', hex: '#1e1b4b', image: '/uploads/media/borka-nawab-hijab-set.jpg' },
      { name: 'Olive Green', hex: '#14532d', image: '/uploads/media/borka-nawab-hijab-set.jpg' },
      { name: 'Deep Black', hex: '#0f172a', image: '/uploads/media/borka-nawab-hijab-set.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    theme: {
      primary: '#6b21a8',
      secondary: '#3b0764',
      accent: '#faf5ff',
      bgGradient: 'linear-gradient(180deg, #faf5ff 0%, #f3e8ff 100%)',
      cardBg: '#ffffff',
      textColor: '#581c87',
      noticeBg: 'linear-gradient(90deg, #3b0764 0%, #6b21a8 100%)',
      noticeText: '#ffffff'
    },
    features: [
      { title: 'সম্পূর্ণ ৩-পিস কমপ্লিট সেট', desc: 'আলাদাভাবে ম্যাচিং কাপড় খোঁজার দরকার নেই—বোরখা, হিজাব ও বেল্ট একসাথে প্রস্তুত।' },
      { title: 'বড় সাইজের ম্যাচিং হিজাব', desc: 'শালীনতা নিশ্চিত করতে পর্যাপ্ত চওড়া ও লম্বা প্রিমিয়াম জর্জেট হিজাব।' },
      { title: 'গোল্ডেন ফিলিগ্রি ডিজাইনার বেল্ট', desc: 'কোমরে সুন্দর ফিটিংয়ের জন্য আকর্ষণীয় এমব্রয়ডার্ড কারুকাজ করা বেল্ট।' },
      { title: '১০০% কালার ও ফেব্রিক ম্যাচিং', desc: 'একই ডাইং লটের নিখুঁত ফেব্রিক তাই কোনো কালার শেড অমিল হওয়ার সুযোগ নেই।' }
    ],
    reviews: [
      { name: 'সুমাইয়া তাসনিম', city: 'উত্তরা, ঢাকা', text: '৩-পিস সেটটা সত্যি দারুণ! আলাদা করে হিজাব কিনতে হয়নি আর বেল্টটা পরলে খুব স্মার্ট লাগে।', date: '৩ দিন আগে' }
    ]
  }
];

// Helper: Generates the Standard NIX Header (NO Arabic website logo!)
function createNixHeader(primaryColor: string) {
  return createNode(
    'container',
    'NIX Header Bar',
    { tag: 'header' },
    {
      background: '#ffffff',
      'border-bottom': '1px solid #e2e8f0',
      padding: '12px 16px',
      position: 'sticky',
      top: '0',
      'z-index': '99',
      'box-shadow': '0 2px 8px rgba(0,0,0,0.03)'
    },
    [
      createNode(
        'container',
        'Header Inner',
        { tag: 'div' },
        {
          'max-width': '960px',
          margin: '0 auto',
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          gap: '12px'
        },
        [
          // Clean NIX Luxury Brand Logo
          createNode(
            'container',
            'NIX Brand Link',
            { tag: 'div' },
            {
              'text-decoration': 'none',
              display: 'inline-flex',
              'align-items': 'center',
              gap: '8px'
            },
            [
              createNode(
                'text',
                'NIX Logo',
                { text: 'NIX' },
                {
                  'font-family': "'Playfair Display', serif",
                  'font-size': '24px',
                  'font-weight': '900',
                  'letter-spacing': '3px',
                  color: primaryColor
                }
              ),
              createNode(
                'text',
                'NIX Sub',
                { text: 'HAUTE MODESTY' },
                {
                  'font-size': '9px',
                  'font-weight': '700',
                  'letter-spacing': '2px',
                  color: '#64748b',
                  'padding-left': '6px',
                  'border-left': '1px solid #cbd5e1'
                }
              )
            ]
          ),

          // Helpline Direct Pill
          createNode(
            'button',
            'Helpline Badge',
            { text: `${SVG_ICONS.phone} হেল্পলাইন: {{site.phone}}`, url: 'tel:{{site.phone}}' },
            {
              display: 'inline-flex',
              'align-items': 'center',
              gap: '6px',
              padding: '6px 14px',
              'border-radius': '999px',
              background: '#f8fafc',
              color: primaryColor,
              'font-size': '12px',
              'font-weight': '600',
              'text-decoration': 'none',
              border: `1px solid ${primaryColor}20`
            }
          )
        ]
      )
    ]
  );
}

// Helper: Generates Top Announcement
function createAnnouncement(noticeBg: string, noticeText: string) {
  return createNode(
    'container',
    'Top Announcement',
    { tag: 'div' },
    {
      background: noticeBg,
      color: noticeText,
      padding: '10px 16px',
      'font-size': '13px',
      'font-weight': '600',
      'text-align': 'center',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      gap: '8px'
    },
    [
      createNode('text', 'Icon', { text: SVG_ICONS.sparkles }),
      createNode('text', 'Offer Text', { text: 'বিশেষ সীমিত সময়ের অফার: ২ পিস অর্ডারে সারা দেশে ডেলিভারি সম্পূর্ণ ফ্রি!' })
    ]
  );
}

// Helper: Generates Size Table
function createSizeTable(borka: BorkaConcept) {
  return createNode(
    'container',
    'Size Section',
    { tag: 'section' },
    { padding: '36px 16px', background: '#ffffff' },
    [
      createNode(
        'container',
        'Size Inner',
        { tag: 'div' },
        { 'max-width': '780px', margin: '0 auto', 'text-align': 'center' },
        [
          createNode('heading', 'Size Title', { text: 'বোরখার সাইজ চার্ট (ইঞ্চি)', level: 'h2' }, { 'font-size': '22px', 'font-weight': '700', color: '#1e293b', 'margin-bottom': '8px' }),
          createNode('paragraph', 'Size Sub', { text: 'আপনার উচ্চতা ও বডি মেজারমেন্ট অনুযায়ী সঠিক সাইজ বেছে নিন' }, { 'font-size': '13px', color: '#64748b', 'margin-bottom': '20px' }),
          createNode(
            'html',
            'Size HTML Table',
            {
              html: `
                <table style="width:100%;border-collapse:collapse;text-align:center;font-size:14px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                  <thead>
                    <tr style="background:${borka.theme.primary};color:#ffffff;font-weight:600;">
                      <th style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">সাইজ</th>
                      <th style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">লং / উচ্চতা</th>
                      <th style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">বডি মেজারমেন্ট</th>
                      <th style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">হাতা / স্লীভ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom:1px solid #f1f5f9;background:#fafafa;"><td style="padding:10px;font-weight:700;">50</td><td style="padding:10px;">৫০ ইঞ্চি (উচ্চতা ৫'০"-৫'১")</td><td style="padding:10px;">৩৬ - ৩৮ ইঞ্চি</td><td style="padding:10px;">২২ ইঞ্চি</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px;font-weight:700;">52</td><td style="padding:10px;">৫২ ইঞ্চি (উচ্চতা ৫'২"-৫'৩")</td><td style="padding:10px;">৩৮ - ৪০ ইঞ্চি</td><td style="padding:10px;">২২.৫ ইঞ্চি</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;background:#fafafa;"><td style="padding:10px;font-weight:700;">54</td><td style="padding:10px;">৫৪ ইঞ্চি (উচ্চতা ৫'৪"-৫'৫")</td><td style="padding:10px;">৪০ - ৪২ ইঞ্চি</td><td style="padding:10px;">২৩ ইঞ্চি</td></tr>
                    <tr><td style="padding:10px;font-weight:700;">56</td><td style="padding:10px;">৫৬ ইঞ্চি (উচ্চতা ৫'৬"+)</td><td style="padding:10px;">৪২ - ৪৪+ ইঞ্চি</td><td style="padding:10px;">২৩.৫ ইঞ্চি</td></tr>
                  </tbody>
                </table>
              `
            }
          )
        ]
      )
    ]
  );
}

// Helper: Generates Trust Badges & Checkout Anchor
function createTrustAndCheckoutAnchor(borka: BorkaConcept) {
  return [
    createNode(
      'container',
      'Trust Badges Section',
      { tag: 'section' },
      { padding: '24px 16px', background: '#ffffff', 'border-top': '1px solid #f1f5f9', 'border-bottom': '1px solid #f1f5f9' },
      [
        createNode(
          'container',
          'Trust Badges Grid',
          { tag: 'div' },
          {
            'max-width': '780px',
            margin: '0 auto',
            display: 'grid',
            'grid-template-columns': 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            'text-align': 'center'
          },
          [
            createNode(
              'container',
              'Trust 1',
              { tag: 'div' },
              { padding: '12px', background: borka.theme.accent, 'border-radius': '12px' },
              [
                createNode('text', 'Icon', { text: SVG_ICONS.truck }, { color: borka.theme.primary, display: 'block', 'margin-bottom': '6px' }),
                createNode('heading', 'Title', { text: 'সারা দেশে হোম ডেলিভারি', level: 'h4' }, { 'font-size': '13px', 'font-weight': '700', color: '#1e293b', 'margin-bottom': '2px' }),
                createNode('text', 'Sub', { text: '২-৩ দিনের মধ্যে দ্রুত পৌঁছে যাবে' }, { 'font-size': '11px', color: '#64748b', display: 'block' })
              ]
            ),
            createNode(
              'container',
              'Trust 2',
              { tag: 'div' },
              { padding: '12px', background: borka.theme.accent, 'border-radius': '12px' },
              [
                createNode('text', 'Icon', { text: SVG_ICONS.packageCheck }, { color: borka.theme.primary, display: 'block', 'margin-bottom': '6px' }),
                createNode('heading', 'Title', { text: 'দেখে নেওয়ার সুবিধা', level: 'h4' }, { 'font-size': '13px', 'font-weight': '700', color: '#1e293b', 'margin-bottom': '2px' }),
                createNode('text', 'Sub', { text: 'কুরিয়ারের সামনে দেখে বিল পরিশোধ' }, { 'font-size': '11px', color: '#64748b', display: 'block' })
              ]
            ),
            createNode(
              'container',
              'Trust 3',
              { tag: 'div' },
              { padding: '12px', background: borka.theme.accent, 'border-radius': '12px' },
              [
                createNode('text', 'Icon', { text: SVG_ICONS.shield }, { color: borka.theme.primary, display: 'block', 'margin-bottom': '6px' }),
                createNode('heading', 'Title', { text: '১০০% আসল ফেব্রিক', level: 'h4' }, { 'font-size': '13px', 'font-weight': '700', color: '#1e293b', 'margin-bottom': '2px' }),
                createNode('text', 'Sub', { text: 'কোয়ালিটি শতভাগ নিশ্চিত' }, { 'font-size': '11px', color: '#64748b', display: 'block' })
              ]
            ),
            createNode(
              'container',
              'Trust 4',
              { tag: 'div' },
              { padding: '12px', background: borka.theme.accent, 'border-radius': '12px' },
              [
                createNode('text', 'Icon', { text: SVG_ICONS.exchange }, { color: borka.theme.primary, display: 'block', 'margin-bottom': '6px' }),
                createNode('heading', 'Title', { text: '৩ দিনের সহজ এক্সচেঞ্জ', level: 'h4' }, { 'font-size': '13px', 'font-weight': '700', color: '#1e293b', 'margin-bottom': '2px' }),
                createNode('text', 'Sub', { text: 'সাইজ না মিললে দ্রুত পরিবর্তন' }, { 'font-size': '11px', color: '#64748b', display: 'block' })
              ]
            )
          ]
        )
      ]
    ),
    // Target Anchor Container (#order)
    createNode(
      'container',
      'Checkout Anchor Container',
      { tag: 'section' },
      { padding: '36px 16px 60px', background: borka.theme.bgGradient },
      [
        createNode(
          'container',
          'Checkout Frame',
          { tag: 'div' },
          { 'max-width': '680px', margin: '0 auto', 'text-align': 'center' },
          [
            createNode('heading', 'Order Form Header', { text: 'অর্ডার করতে নিচের তথ্যগুলো পূরণ করুন', level: 'h2' }, { 'font-size': '22px', 'font-weight': '700', color: borka.theme.textColor, 'margin-bottom': '8px' }),
            createNode('paragraph', 'Order Form Sub', { text: 'সরাসরি ক্যাশ অন ডেলিভারিতে কোনো অগ্রিম টাকা ছাড়াই অর্ডার করুন' }, { 'font-size': '14px', color: '#64748b', 'margin-bottom': '24px' }),
            createNode('container', 'Checkout Anchor Target', { tag: 'div' }, {}, [], {}, { id: 'order' })
          ]
        )
      ]
    ),
    // Floating Mobile Bar
    createNode(
      'container',
      'Floating Mobile Bar',
      { tag: 'div' },
      {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        background: 'rgba(255, 255, 255, 0.95)',
        'backdrop-filter': 'blur(10px)',
        'border-top': '1px solid rgba(0,0,0,0.08)',
        padding: '12px 16px',
        display: 'flex',
        'justify-content': 'center',
        'align-items': 'center',
        gap: '12px',
        'z-index': '999',
        'box-shadow': '0 -4px 16px rgba(0,0,0,0.06)'
      },
      [
        createNode(
          'button',
          'Floating CTA',
          { text: `এখনই অর্ডার করুন · মাত্র ৳${borka.salePrice.toLocaleString('en-BD')}`, url: '#order' },
          {
            background: borka.theme.primary,
            color: '#ffffff',
            padding: '14px 28px',
            'border-radius': '999px',
            'font-size': '15px',
            'font-weight': '700',
            'text-decoration': 'none',
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'center',
            width: '100%',
            'max-width': '480px',
            'box-shadow': `0 4px 14px ${borka.theme.primary}50`
          }
        )
      ]
    )
  ];
}

function createPageDocument(b: BorkaConcept, rootNodes: BuilderNode[]): PageDocument {
  return {
    schemaVersion: 1,
    title: b.name,
    slug: b.slug,
    seo: {
      title: `${b.name} | NIX Haute Modesty`,
      description: b.description,
      noindex: false
    },
    settings: { lang: 'bn', direction: 'ltr' },
    breakpoints: [
      { id: 'tablet', label: 'Tablet', maxWidth: 1024 },
      { id: 'mobile', label: 'Mobile', maxWidth: 640 }
    ],
    tokens: {
      'brand-primary': b.theme.primary,
      'brand-accent': b.theme.accent
    },
    classes: {},
    components: {},
    rootNodes
  };
}

// 1. DESIGN 1: THE ROYAL EDITORIAL (Split Hero Layout)
function buildEditorialDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    // Hero: 2-Column Split
    createNode('container', 'Editorial Hero', { tag: 'section' }, { padding: '40px 16px', background: b.theme.bgGradient }, [
      createNode('container', 'Hero Grid', { tag: 'div' }, { 'max-width': '960px', margin: '0 auto', display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', 'align-items': 'center' }, [
        // Left Column: Editorial Photo
        createNode('container', 'Photo Wrap', { tag: 'div' }, { position: 'relative' }, [
          createNode('image', 'Hero Image', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'border-radius': '20px', 'box-shadow': '0 12px 32px rgba(0,0,0,0.1)' }),
          createNode('badge', 'Quality Pill', { text: '১০০% অরিজিনাল দুবাই চেরি' }, { position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(255,255,255,0.95)', color: b.theme.primary, padding: '8px 16px', 'border-radius': '999px', 'font-size': '12px', 'font-weight': '700', 'box-shadow': '0 4px 12px rgba(0,0,0,0.08)' })
        ]),
        // Right Column: Details & Pricing
        createNode('container', 'Hero Copy', { tag: 'div' }, {}, [
          createNode('badge', 'Tag', { text: `${b.styleAesthetic} · NIX Exclusive` }, { background: b.theme.accent, color: b.theme.primary, padding: '6px 14px', 'border-radius': '999px', 'font-size': '12px', 'font-weight': '700', 'margin-bottom': '16px', display: 'inline-block' }),
          createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '32px', 'font-weight': '800', color: b.theme.textColor, 'line-height': '1.3', 'margin-bottom': '14px' }),
          createNode('paragraph', 'Tagline', { text: b.tagline }, { 'font-size': '16px', color: '#4b5563', 'line-height': '1.6', 'margin-bottom': '24px' }),
          createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '২৮% ছাড়', highlight: 'আজকের স্পেশাল ধামাকা অফার' }),
          createNode('container', 'CTA Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
            createNode('button', 'Order CTA', { text: 'এখনই অর্ডার করুন (ক্যাশ অন ডেলিভারি)', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 32px', 'border-radius': '12px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none', width: '100%', 'text-align': 'center' })
          ])
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 2. DESIGN 2: IMPERIAL SAPPHIRE PALACE (Cinema Hero with Floating Glassmorphic Ticket)
function buildSapphirePalaceDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    // Center Cinema Hero
    createNode('container', 'Palace Hero', { tag: 'section' }, { padding: '48px 16px 36px', background: b.theme.bgGradient, 'text-align': 'center' }, [
      createNode('container', 'Hero Inner', { tag: 'div' }, { 'max-width': '800px', margin: '0 auto' }, [
        createNode('badge', 'Royal Badge', { text: 'IMPERIAL SAPPHIRE COLLECTION' }, { background: b.theme.primary, color: '#ffffff', padding: '6px 16px', 'border-radius': '999px', 'font-size': '11px', 'font-weight': '800', 'letter-spacing': '2px', 'margin-bottom': '16px', display: 'inline-block' }),
        createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '34px', 'font-weight': '900', color: b.theme.textColor, 'margin-bottom': '12px' }),
        createNode('paragraph', 'Sub', { text: b.tagline }, { 'font-size': '16px', color: '#334155', 'max-width': '600px', margin: '0 auto 28px' }),
        createNode('image', 'Featured Photo', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'max-width': '420px', margin: '0 auto 24px', 'border-radius': '24px', 'box-shadow': '0 20px 40px rgba(30, 58, 138, 0.2)' }),
        createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '২৮% ছাড়', highlight: 'সীমিত সময়ের রাজকীয় অফার' }),
        createNode('container', 'Action Button Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
          createNode('button', 'Palace CTA', { text: 'অর্ডার কনফার্ম করুন (অগ্রিম টাকা ছাড়া)', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 36px', 'border-radius': '999px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none' })
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 3. DESIGN 3: ISTANBUL ROSE BOUTIQUE (Soft Pastel Romantic Aesthetic)
function buildRoseBoutiqueDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    createNode('container', 'Boutique Hero', { tag: 'section' }, { padding: '40px 16px', background: b.theme.bgGradient }, [
      createNode('container', 'Boutique Layout', { tag: 'div' }, { 'max-width': '960px', margin: '0 auto', display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', 'align-items': 'center' }, [
        createNode('container', 'Image Frame', { tag: 'div' }, { 'text-align': 'center' }, [
          createNode('image', 'Rose Photo', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'border-radius': '32px 32px 12px 12px', 'box-shadow': '0 16px 36px rgba(190, 24, 93, 0.12)' })
        ]),
        createNode('container', 'Content Column', { tag: 'div' }, {}, [
          createNode('badge', 'Boutique Tag', { text: 'ISTANBUL BUTTERFLY EDITION' }, { background: b.theme.accent, color: b.theme.primary, padding: '6px 14px', 'border-radius': '999px', 'font-size': '11px', 'font-weight': '700', 'letter-spacing': '1.5px', 'margin-bottom': '14px', display: 'inline-block' }),
          createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '30px', 'font-weight': '800', color: b.theme.textColor, 'margin-bottom': '12px' }),
          createNode('paragraph', 'Desc', { text: b.description }, { 'font-size': '15px', color: '#4b5563', 'line-height': '1.6', 'margin-bottom': '20px' }),
          createNode('offer-price', 'Price', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '২৯% ছাড়', highlight: 'বিশেষ বাটারফ্লাই অফার' }),
          createNode('container', 'CTA Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
            createNode('button', 'Boutique CTA', { text: 'এখনই সংগ্রহ করুন · ক্যাশ অন ডেলিভারি', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 32px', 'border-radius': '16px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none', width: '100%', 'text-align': 'center' })
          ])
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 4. DESIGN 4: ARTISAN HERITAGE (Kashmiri Warm Amber & Burgundy Gold)
function buildKashmiriArtisanDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    createNode('container', 'Heritage Hero', { tag: 'section' }, { padding: '44px 16px', background: b.theme.bgGradient, 'text-align': 'center' }, [
      createNode('container', 'Heritage Inner', { tag: 'div' }, { 'max-width': '840px', margin: '0 auto' }, [
        createNode('badge', 'Badge', { text: 'KASHMIRI RESHAM EMBROIDERY' }, { background: b.theme.primary, color: '#ffffff', padding: '6px 16px', 'border-radius': '6px', 'font-size': '11px', 'font-weight': '800', 'letter-spacing': '2px', 'margin-bottom': '16px', display: 'inline-block' }),
        createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '32px', 'font-weight': '900', color: b.theme.textColor, 'margin-bottom': '12px' }),
        createNode('paragraph', 'Sub', { text: b.tagline }, { 'font-size': '15px', color: '#78350f', 'margin-bottom': '24px' }),
        createNode('image', 'Heritage Image', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'max-width': '420px', margin: '0 auto 24px', 'border-radius': '16px', border: '3px solid #b45309', 'box-shadow': '0 16px 32px rgba(153, 27, 27, 0.15)' }),
        createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '২৯% ছাড়', highlight: 'উৎসবের স্পেশাল ডিসকাউন্ট' }),
        createNode('container', 'CTA Button Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
          createNode('button', 'Heritage CTA', { text: 'অর্ডার কনফার্ম করুন (হোম ডেলিভারি)', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 36px', 'border-radius': '8px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none' })
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 5. DESIGN 5: MODERN CHIC MINIMALIST (Front Open Coat Style)
function buildMinimalistModernDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    createNode('container', 'Minimalist Hero', { tag: 'section' }, { padding: '44px 16px', background: b.theme.bgGradient }, [
      createNode('container', 'Minimalist Grid', { tag: 'div' }, { 'max-width': '960px', margin: '0 auto', display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', 'align-items': 'center' }, [
        createNode('container', 'Image Column', { tag: 'div' }, {}, [
          createNode('image', 'Coat Image', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'border-radius': '16px', 'box-shadow': '0 12px 28px rgba(0,0,0,0.08)' })
        ]),
        createNode('container', 'Info Column', { tag: 'div' }, {}, [
          createNode('badge', 'Corporate Badge', { text: '2-IN-1 MODULAR COAT STYLE' }, { background: b.theme.primary, color: '#ffffff', padding: '6px 14px', 'border-radius': '4px', 'font-size': '11px', 'font-weight': '700', 'letter-spacing': '1px', 'margin-bottom': '16px', display: 'inline-block' }),
          createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '30px', 'font-weight': '800', color: b.theme.textColor, 'margin-bottom': '12px' }),
          createNode('paragraph', 'Sub', { text: b.description }, { 'font-size': '15px', color: '#475569', 'line-height': '1.6', 'margin-bottom': '20px' }),
          createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '৩০% ছাড়', highlight: 'স্মার্ট কর্পোরেট অফার' }),
          createNode('container', 'CTA Button Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
            createNode('button', 'Coat CTA', { text: 'এখনই অর্ডার করুন (ক্যাশ অন ডেলিভারি)', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 32px', 'border-radius': '8px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none', width: '100%', 'text-align': 'center' })
          ])
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 6. DESIGN 6: BOHO EARTH MOCHA (Double Layer Koti)
function buildBohoMochaDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    createNode('container', 'Boho Hero', { tag: 'section' }, { padding: '44px 16px', background: b.theme.bgGradient, 'text-align': 'center' }, [
      createNode('container', 'Boho Inner', { tag: 'div' }, { 'max-width': '800px', margin: '0 auto' }, [
        createNode('badge', 'Badge', { text: 'LAYERED MERMAID & KOTI SUITE' }, { background: b.theme.accent, color: b.theme.primary, padding: '6px 16px', 'border-radius': '999px', 'font-size': '11px', 'font-weight': '800', 'margin-bottom': '14px', display: 'inline-block' }),
        createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '32px', 'font-weight': '900', color: b.theme.textColor, 'margin-bottom': '12px' }),
        createNode('paragraph', 'Sub', { text: b.tagline }, { 'font-size': '15px', color: '#92400e', 'margin-bottom': '24px' }),
        createNode('image', 'Boho Image', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'max-width': '420px', margin: '0 auto 24px', 'border-radius': '20px', 'box-shadow': '0 16px 36px rgba(120, 53, 15, 0.15)' }),
        createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '২৯% ছাড়', highlight: 'কোটি সহ সম্পূর্ণ সেট অফার' }),
        createNode('container', 'CTA Button Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
          createNode('button', 'Boho CTA', { text: 'অর্ডার করতে এখানে ক্লিক করুন', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 36px', 'border-radius': '999px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none' })
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 7. DESIGN 7: MIDNIGHT RUNWAY GLAMOUR (Diamond Stone Kimono - Dark Mode Luxury)
function buildRunwayMidnightDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    createNode('container', 'Dark Runway Hero', { tag: 'section' }, { padding: '48px 16px', background: b.theme.bgGradient, 'text-align': 'center' }, [
      createNode('container', 'Dark Runway Inner', { tag: 'div' }, { 'max-width': '800px', margin: '0 auto' }, [
        createNode('badge', 'Crystal Badge', { text: 'KOREAN CRYSTAL STONE EDITION' }, { background: b.theme.primary, color: '#ffffff', padding: '6px 16px', 'border-radius': '999px', 'font-size': '11px', 'font-weight': '800', 'letter-spacing': '2px', 'margin-bottom': '16px', display: 'inline-block' }),
        createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '34px', 'font-weight': '900', color: '#ffffff', 'margin-bottom': '12px' }),
        createNode('paragraph', 'Sub', { text: b.tagline }, { 'font-size': '15px', color: '#94a3b8', 'margin-bottom': '24px' }),
        createNode('image', 'Kimono Image', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'max-width': '420px', margin: '0 auto 24px', 'border-radius': '20px', border: '1px solid rgba(255,255,255,0.2)', 'box-shadow': '0 20px 40px rgba(0,0,0,0.5)' }),
        createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '৩০% ছাড়', highlight: 'প্রিমিয়াম স্টোন ওয়ার্ক স্পেশাল' }),
        createNode('container', 'CTA Button Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
          createNode('button', 'Runway CTA', { text: 'এখনই অর্ডার করুন · সম্পূর্ণ ক্যাশ অন ডেলিভারি', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 36px', 'border-radius': '999px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none' })
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 8. DESIGN 8: PURE NATURE LINEN (Organic Lifestyle)
function buildOrganicLinenDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    createNode('container', 'Linen Hero', { tag: 'section' }, { padding: '44px 16px', background: b.theme.bgGradient }, [
      createNode('container', 'Linen Grid', { tag: 'div' }, { 'max-width': '960px', margin: '0 auto', display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', 'align-items': 'center' }, [
        createNode('container', 'Photo Wrap', { tag: 'div' }, {}, [
          createNode('image', 'Linen Image', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'border-radius': '24px', 'box-shadow': '0 12px 30px rgba(77, 124, 15, 0.12)' })
        ]),
        createNode('container', 'Copy Column', { tag: 'div' }, {}, [
          createNode('badge', 'Linen Badge', { text: '100% PURE ARABIC BREATHABLE LINEN' }, { background: b.theme.accent, color: b.theme.primary, padding: '6px 14px', 'border-radius': '999px', 'font-size': '11px', 'font-weight': '700', 'margin-bottom': '16px', display: 'inline-block' }),
          createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '30px', 'font-weight': '800', color: b.theme.textColor, 'margin-bottom': '12px' }),
          createNode('paragraph', 'Sub', { text: b.description }, { 'font-size': '15px', color: '#4b5563', 'line-height': '1.6', 'margin-bottom': '20px' }),
          createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '৩২% ছাড়', highlight: 'ন্যাচারাল ডেইলি কমফোর্ট অফার' }),
          createNode('container', 'CTA Button Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
            createNode('button', 'Linen CTA', { text: 'অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 32px', 'border-radius': '12px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none', width: '100%', 'text-align': 'center' })
          ])
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 9. DESIGN 9: WINTER ARISTOCRAT (Velvet Lounge Suite)
function buildRoyalVelvetDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    createNode('container', 'Velvet Hero', { tag: 'section' }, { padding: '48px 16px', background: b.theme.bgGradient, 'text-align': 'center' }, [
      createNode('container', 'Velvet Inner', { tag: 'div' }, { 'max-width': '800px', margin: '0 auto' }, [
        createNode('badge', 'Winter Badge', { text: 'WINTER ARISTOCRAT VELVET EDITION' }, { background: '#ca8a04', color: '#000000', padding: '6px 16px', 'border-radius': '999px', 'font-size': '11px', 'font-weight': '800', 'letter-spacing': '2px', 'margin-bottom': '16px', display: 'inline-block' }),
        createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '34px', 'font-weight': '900', color: '#ffffff', 'margin-bottom': '12px' }),
        createNode('paragraph', 'Sub', { text: b.tagline }, { 'font-size': '15px', color: '#e2e8f0', 'margin-bottom': '24px' }),
        createNode('image', 'Velvet Image', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'max-width': '420px', margin: '0 auto 24px', 'border-radius': '20px', border: '2px solid #ca8a04', 'box-shadow': '0 20px 40px rgba(0,0,0,0.6)' }),
        createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '৩০% ছাড়', highlight: 'শীতের স্পেশাল ধামাকা অফার' }),
        createNode('container', 'CTA Button Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
          createNode('button', 'Velvet CTA', { text: 'এখনই বুকিং করুন · অগ্রিম টাকা ছাড়াই', url: '#order' }, { background: '#ca8a04', color: '#000000', padding: '16px 36px', 'border-radius': '999px', 'font-size': '16px', 'font-weight': '800', display: 'inline-block', 'text-decoration': 'none' })
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

// 10. DESIGN 10: THE NAWAB 3-PIECE COMPLETE SUITE
function buildNawabSuiteDesign(b: BorkaConcept): PageDocument {
  const rootNodes: BuilderNode[] = [
    createAnnouncement(b.theme.noticeBg, b.theme.noticeText),
    createNixHeader(b.theme.primary),
    createNode('container', 'Nawab Hero', { tag: 'section' }, { padding: '44px 16px', background: b.theme.bgGradient, 'text-align': 'center' }, [
      createNode('container', 'Nawab Inner', { tag: 'div' }, { 'max-width': '800px', margin: '0 auto' }, [
        createNode('badge', 'Nawab Badge', { text: 'COMPLETE 3-PIECE BRIDAL & PARTY SUITE' }, { background: b.theme.primary, color: '#ffffff', padding: '6px 16px', 'border-radius': '999px', 'font-size': '11px', 'font-weight': '800', 'letter-spacing': '2px', 'margin-bottom': '16px', display: 'inline-block' }),
        createNode('heading', 'Title', { text: b.name, level: 'h1' }, { 'font-size': '32px', 'font-weight': '900', color: b.theme.textColor, 'margin-bottom': '12px' }),
        createNode('paragraph', 'Sub', { text: b.tagline }, { 'font-size': '15px', color: '#581c87', 'margin-bottom': '24px' }),
        createNode('image', 'Nawab Image', { src: b.image, alt: b.name, aspectRatio: '3/4', objectFit: 'cover' }, { 'max-width': '420px', margin: '0 auto 24px', 'border-radius': '20px', 'box-shadow': '0 16px 36px rgba(107, 33, 168, 0.2)' }),
        createNode('offer-price', 'Price Box', { regularPrice: `৳${b.regularPrice.toLocaleString('en-BD')}`, offerPrice: `৳${b.salePrice.toLocaleString('en-BD')}`, discount: '৩৭% ছাড়', highlight: 'সম্পূর্ণ ৩-পিস প্যাকেজ ধামাকা' }),
        createNode('container', 'CTA Button Wrap', { tag: 'div' }, { 'margin-top': '24px' }, [
          createNode('button', 'Nawab CTA', { text: 'সম্পূর্ণ ৩-পিস সেট অর্ডার করুন · মাত্র ৳১,৩৫০', url: '#order' }, { background: b.theme.primary, color: '#ffffff', padding: '16px 36px', 'border-radius': '999px', 'font-size': '16px', 'font-weight': '700', display: 'inline-block', 'text-decoration': 'none' })
        ])
      ])
    ]),
    createSizeTable(b),
    ...createTrustAndCheckoutAnchor(b)
  ];

  return createPageDocument(b, rootNodes);
}

const builders = [
  buildEditorialDesign,
  buildSapphirePalaceDesign,
  buildRoseBoutiqueDesign,
  buildKashmiriArtisanDesign,
  buildMinimalistModernDesign,
  buildBohoMochaDesign,
  buildRunwayMidnightDesign,
  buildOrganicLinenDesign,
  buildRoyalVelvetDesign,
  buildNawabSuiteDesign
];

async function main() {
  console.log('🚀 Starting 10 100% Unique NIX Luxury Borka Sales Funnel Seeding...');

  // 1. Ensure Category "Borka Collection" exists
  console.log('📂 Verifying Category...');
  const category = await prisma.category.upsert({
    where: { slug: 'borka-collection' },
    create: {
      id: randomUUID(),
      name: 'Borka Collection',
      slug: 'borka-collection',
      description: 'Exclusive modest abayas, borkas and kaftans collection by NIX'
    },
    update: {
      name: 'Borka Collection',
      description: 'Exclusive modest abayas, borkas and kaftans collection by NIX'
    }
  });
  console.log(`✅ Category "Borka Collection" ready (ID: ${category.id})`);

  // 2. Setup Global Product Attributes (Color & Size)
  console.log('🎨 Updating Global Product Attributes (Color & Size)...');
  const allColorTerms = [
    'Emerald Green', 'Royal Navy', 'Classic Black', 'Midnight Black',
    'Dusty Rose', 'Blush Mauve', 'Burgundy Maroon', 'Deep Crimson',
    'Charcoal Grey', 'Slate Steel', 'Mocha Caramel', 'Warm Toffee',
    'Crystal Jet Black', 'Onyx Silver', 'Sage Olive', 'Desert Khaki',
    'Sapphire Velvet', 'Imperial Gold Navy', 'Imperial Plum', 'Royal Aubergine'
  ];
  const allColorMap: Record<string, string> = {
    'Emerald Green': '#0d5c3a',
    'Royal Navy': '#1a2c42',
    'Classic Black': '#111111',
    'Midnight Black': '#0a0a0a',
    'Dusty Rose': '#c08081',
    'Blush Mauve': '#9f6b7c',
    'Burgundy Maroon': '#5b1525',
    'Deep Crimson': '#4a0e17',
    'Charcoal Grey': '#2f3542',
    'Slate Steel': '#475569',
    'Mocha Caramel': '#7a5230',
    'Warm Toffee': '#8c5836',
    'Crystal Jet Black': '#050505',
    'Onyx Silver': '#1c1c1c',
    'Sage Olive': '#556b2f',
    'Desert Khaki': '#8a795d',
    'Sapphire Velvet': '#0f2042',
    'Imperial Gold Navy': '#141e30',
    'Imperial Plum': '#4a154b',
    'Royal Aubergine': '#2e0854'
  };

  let colorAttr = await prisma.productAttribute.findFirst({ where: { name: 'Color' } });
  if (!colorAttr) {
    colorAttr = await prisma.productAttribute.create({
      data: {
        id: randomUUID(),
        name: 'Color',
        slug: 'color',
        type: 'COLOR',
        displayStyle: 'SQUARE',
        options: JSON.stringify(allColorTerms),
        optionColors: JSON.stringify(allColorMap),
        orderBy: 'MENU_ORDER'
      }
    });
  } else {
    colorAttr = await prisma.productAttribute.update({
      where: { id: colorAttr.id },
      data: {
        displayStyle: 'SQUARE',
        type: 'COLOR',
        options: JSON.stringify(allColorTerms),
        optionColors: JSON.stringify(allColorMap)
      }
    });
  }

  const allSizeTerms = ['50', '52', '54', '56'];
  let sizeAttr = await prisma.productAttribute.findFirst({ where: { name: 'Size' } });
  if (!sizeAttr) {
    sizeAttr = await prisma.productAttribute.create({
      data: {
        id: randomUUID(),
        name: 'Size',
        slug: 'size',
        type: 'SIZE_NUMBER',
        displayStyle: 'SQUARE',
        options: JSON.stringify(allSizeTerms),
        orderBy: 'MENU_ORDER'
      }
    });
  } else {
    sizeAttr = await prisma.productAttribute.update({
      where: { id: sizeAttr.id },
      data: {
        displayStyle: 'SQUARE',
        type: 'SIZE_NUMBER',
        options: JSON.stringify(allSizeTerms)
      }
    });
  }

  // 3. Process Each Product & Its Unique Landing Page
  for (let i = 0; i < borkaCatalog.length; i++) {
    const b = borkaCatalog[i];
    console.log(`\n------------------------------------------------------------`);
    console.log(`📦 [${i + 1}/10] Processing: ${b.name} (${b.slug})`);

    const colorOptionNames = b.colors.map(c => c.name);
    const colorHexMap = Object.fromEntries(b.colors.map(c => [c.name, c.hex]));

    const productAttrs = [
      {
        attributeId: colorAttr.id,
        name: 'Color',
        type: 'COLOR',
        displayStyle: 'SQUARE',
        optionColors: colorHexMap,
        options: colorOptionNames,
        values: colorOptionNames,
        visible: true,
        variation: true
      },
      {
        attributeId: sizeAttr.id,
        name: 'Size',
        type: 'SIZE_NUMBER',
        displayStyle: 'SQUARE',
        options: b.sizes,
        values: b.sizes,
        visible: true,
        variation: true
      }
    ];

    let product = await prisma.product.findFirst({
      where: {
        OR: [
          { slug: b.slug },
          { sku: b.sku }
        ]
      }
    });

    const productPayload = {
      name: b.name,
      slug: b.slug,
      sku: b.sku,
      description: b.description,
      regularPrice: b.regularPrice,
      salePrice: b.salePrice,
      buyPrice: b.buyPrice,
      stockQuantity: 100,
      status: 'ACTIVE',
      productType: 'VARIABLE',
      image: b.image,
      gallery: JSON.stringify([b.image]),
      category: b.category,
      attributes: JSON.stringify(productAttrs)
    };

    if (product) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: productPayload
      });
    } else {
      product = await prisma.product.create({
        data: {
          id: randomUUID(),
          ...productPayload
        }
      });
    }
    console.log(`  🔄 Product saved with genuine luxury image: ${b.image}`);

    // Seed Variants with color and size properly populated
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    for (const color of b.colors) {
      for (const size of b.sizes) {
        await prisma.productVariant.create({
          data: {
            id: randomUUID(),
            productId: product.id,
            sku: `${b.sku}-${color.name.slice(0, 3).toUpperCase()}-${size}`,
            name: `${b.name} - ${color.name} - ${size}`,
            color: color.name,
            size: size,
            attributes: JSON.stringify({ Color: color.name, Size: size }),
            regularPrice: b.regularPrice,
            salePrice: b.salePrice,
            buyPrice: b.buyPrice,
            stockQuantity: 25,
            status: 'ACTIVE',
            image: b.image
          }
        });
      }
    }
    console.log(`  ✅ Seeded 16 variants with color and size`);

    // Build the UNIQUE Page Document
    const builderFn = builders[i];
    const doc = builderFn(b);
    const parsedDoc = parseDocument(doc);
    const serializedDoc = JSON.stringify(parsedDoc);

    // Save BuilderPage
    let builderPage = await prisma.builderPage.findUnique({ where: { slug: b.slug } });
    if (builderPage) {
      builderPage = await prisma.builderPage.update({
        where: { id: builderPage.id },
        data: {
          title: b.name,
          draft: serializedDoc,
          published: serializedDoc,
          publishedVersion: 1,
          publishedSlug: b.slug,
          version: 1,
          updatedBy: 'system'
        }
      });
    } else {
      builderPage = await prisma.builderPage.create({
        data: {
          title: b.name,
          slug: b.slug,
          draft: serializedDoc,
          published: serializedDoc,
          publishedVersion: 1,
          publishedSlug: b.slug,
          version: 1,
          createdBy: 'system',
          updatedBy: 'system'
        }
      });
    }

    // Save as Studio Template
    const templateName = `[NIX Haute Modesty] ${b.name}`;
    const existingTemplate = await prisma.builderTemplate.findFirst({ where: { name: templateName } });
    if (existingTemplate) {
      await prisma.builderTemplate.update({
        where: { id: existingTemplate.id },
        data: { document: serializedDoc }
      });
    } else {
      await prisma.builderTemplate.create({
        data: {
          name: templateName,
          document: serializedDoc,
          createdBy: 'system'
        }
      });
    }

    // StorePage Checkout Block
    const storePageSlug = `flow-${b.slug}`;
    const checkoutBlocks = [
      {
        id: randomUUID(),
        type: 'CHECKOUT',
        heading: 'অর্ডার করতে নিচের তথ্যগুলো পূরণ করুন',
        productIds: [product.id],
        selection: 'SINGLE',
        couponEnabled: false,
        paymentMethods: ['COD'],
        buttonText: `অর্ডার কনফার্ম করুন · ৳${b.salePrice.toLocaleString('en-BD')}`,
        billingHeading: 'কাস্টমার ও ডেলিভারি তথ্য',
        productsHeading: 'আপনার নির্বাচিত প্রোডাক্ট',
        nameLabel: 'আপনার সম্পূর্ণ নাম',
        namePlaceholder: 'নাম লিখুন',
        phoneLabel: 'সচল মোবাইল নাম্বার',
        phonePlaceholder: '১১ ডিজিটের মোবাইল নাম্বার লিখুন',
        addressLabel: 'সম্পূর্ণ ডেলিভারি ঠিকানা',
        addressPlaceholder: 'বাসা/রোড নং, এলাকা, থানা ও জেলার নাম লিখুন',
        footerTitle: b.name,
        footerDeliveryText: 'সমগ্র বাংলাদেশে হোম ডেলিভারি',
        footerPrivacyText: 'গোপনীয়তা ও নিরাপত্তা নীতি'
      }
    ];

    let storePage = await prisma.storePage.findUnique({ where: { slug: storePageSlug } });
    if (storePage) {
      storePage = await prisma.storePage.update({
        where: { id: storePage.id },
        data: {
          title: b.name,
          coverImage: b.image,
          status: 'PUBLISHED',
          isActive: true,
          blocks: JSON.stringify(checkoutBlocks)
        }
      });
    } else {
      storePage = await prisma.storePage.create({
        data: {
          title: b.name,
          slug: storePageSlug,
          coverImage: b.image,
          status: 'PUBLISHED',
          isActive: true,
          blocks: JSON.stringify(checkoutBlocks)
        }
      });
    }

    // Link StorePage to BuilderPage
    const existingLandingLink = await prisma.builderLanding.findFirst({
      where: {
        OR: [
          { storePageId: storePage.id },
          { builderPageId: builderPage.id }
        ]
      }
    });

    if (existingLandingLink) {
      await prisma.builderLanding.update({
        where: { id: existingLandingLink.id },
        data: {
          storePageId: storePage.id,
          builderPageId: builderPage.id
        }
      });
    } else {
      await prisma.builderLanding.create({
        data: {
          storePageId: storePage.id,
          builderPageId: builderPage.id,
          createdBy: 'system'
        }
      });
    }

    await ensureLandingThankYou(builderPage.id, { id: 'system', name: 'System Architect' });
    console.log(`  🎉 Completed Unique Landing: http://localhost:3001/${b.slug}`);
  }

  console.log('\n============================================================');
  console.log('✅ ALL 10 UNIQUE NIX LUXURY BORKA PAGES SEEDED SUCCESSFULLY!');
  console.log('============================================================');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
