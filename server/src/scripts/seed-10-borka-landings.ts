import { ensureLandingThankYou } from '../modules/builder/landingService';
import fs from 'fs';
import path from 'path';
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

interface BorkaDefinition {
  name: string;
  slug: string;
  sku: string;
  regularPrice: number;
  salePrice: number;
  buyPrice: number;
  category: string;
  description: string;
  colors: Array<{ name: string; hex: string; image: string }>;
  sizes: string[];
  images: string[];
  videoUrl: string;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    bgGradient: string;
    bannerNotice: string;
    headline: string;
    subheadline: string;
  };
  features: string[];
  sizeChart: Array<{ size: string; chest: string; length: string; sleeve: string; hip: string }>;
  reviews: Array<{ name: string; city: string; rating: number; text: string; date: string }>;
}

const borkaCatalog: BorkaDefinition[] = [
  // 1. DUBAI CHERRY SILK
  {
    name: 'দুবাই চেরি সিল্ক ডিজাইনার বোরখা',
    slug: 'borka-dubai-cherry',
    sku: 'BORKA-DUBAI-001',
    regularPrice: 1650,
    salePrice: 1190,
    buyPrice: 750,
    category: 'বোরকা কালেকশন',
    description: 'অরিজিনাল দুবাই চেরি জর্জেট ফেব্রিক্সে তৈরি নিখুঁত হাতের কাজ ও প্রিমিয়াম এমব্রয়ডারি। অত্যন্ত আরামদায়ক ও গর্জিয়াস লুক যা আপনাকে দেবে মার্জিত শালীনতা।',
    colors: [
      { name: 'Black', hex: '#18181b', image: '/uploads/media/borka-model-1.jpg' },
      { name: 'Maroon', hex: '#800000', image: '/uploads/media/borka-model-2.jpg' },
      { name: 'Navy Blue', hex: '#000080', image: '/uploads/media/borka-model-3.jpg' },
      { name: 'Bottle Green', hex: '#004225', image: '/uploads/media/borka-model-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-model-1.jpg',
      '/uploads/media/borka-model-2.jpg',
      '/uploads/media/borka-model-3.jpg',
      '/uploads/media/borka-model-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#e11d48',
      secondary: '#059669',
      accent: '#ffe4e6',
      bgGradient: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)',
      bannerNotice: '🔥 আজকের বিশেষ ধামাকা অফার! ২ পিস অর্ডারে সারা দেশে ডেলিভারি সম্পূর্ণ ফ্রি! 🔥',
      headline: 'স্পেশাল ডিসকাউন্ট অফার দুবাই চেরি সিল্ক ডিজাইনার বোরখা মাত্র ১১৯০ টাকা!',
      subheadline: 'অরিজিনাল দুবাই চেরি কাপড়ের আকর্ষণীয় ফল ও প্রিমিয়াম সেলাইয়ে তৈরি।'
    },
    features: [
      '১০০% অরিজিনাল দুবাই চেরি সিল্ক সফট ফেব্রিক্স।',
      'প্রিমিয়াম কোয়ালিটি ডাবল স্টিচ ফিনিশিং ও নিখুঁত স্টোন ওয়ার্ক।',
      'কালার ও ফেব্রিক্সের ১০০% টেকসই গ্যারান্টি, ওয়াশে সহজে নষ্ট হবে না।',
      'সম্পূর্ণ নন-ট্রান্সপারেন্ট, অত্যন্ত আরামদায়ক ও মার্জিত শালীন আউটলুক।',
      '৩ দিনের সহজ রিপ্লেসমেন্ট ও পণ্য দেখে মূল্য পরিশোধের সুবিধা।'
    ],
    sizeChart: [
      { size: '50', chest: '44-48"', length: '50"', sleeve: '22"', hip: '52"' },
      { size: '52', chest: '44-48"', length: '52"', sleeve: '23"', hip: '54"' },
      { size: '54', chest: '46-50"', length: '54"', sleeve: '23.5"', hip: '56"' },
      { size: '56', chest: '48-52"', length: '56"', sleeve: '24"', hip: '58"' }
    ],
    reviews: [
      { name: 'সাদিয়া ইসলাম তানহা', city: 'মিরপুর, ঢাকা', rating: 5, text: 'বোরখাটির কাপড় অনেক সফট ও প্রিমিয়াম! ছবিতে যেমন দেখেছি বাস্তবে আরও সুন্দর। সেলাই অসাধারণ।', date: '২ দিন আগে' },
      { name: 'উম্মে কুলসুম', city: 'চট্টগ্রাম সদর', rating: 5, text: 'ডেলিভারি ম্যানের সামনে প্যাকেট খুলে চেক করে নিয়েছি। কালার ও ফল খুবই মার্জিত। ধন্যবাদ NIX!', date: '৪ দিন আগে' },
      { name: 'ফারজানা আক্তার', city: 'সিলেট', rating: 5, text: 'একসাথে দুইটা অর্ডার করেছিলাম, ডেলিভারি ফ্রি দিয়েছে। ফ্যাব্রিক ও ডিজাইন মাশাআল্লাহ সেরা!', date: '১ সপ্তাহ আগে' },
      { name: 'রোকেয়া সুলতানা', city: 'রাজশাহী', rating: 5, text: 'অনেক আরামদায়ক প্রতিদিন ব্যবহারের জন্য। গরমেও ঘাম হবে না। সাইজ ৫০ একদম পারফেক্ট হয়েছে।', date: '২ সপ্তাহ আগে' }
    ]
  },

  // 2. DUBAI KAFTAN ABAYA
  {
    name: 'প্রিমিয়াম দুবাই কাফতান আবায়া বোরখা',
    slug: 'borka-dubai-kaftan',
    sku: 'BORKA-KAFTAN-002',
    regularPrice: 2250,
    salePrice: 1550,
    buyPrice: 950,
    category: 'বোরকা কালেকশন',
    description: 'রয়েল অ্যারাবিয়ান কাটিং দুবাই কাফতান আবায়া। আকর্ষণীয় বেল স্লিভ ও টাসেল বেল্ট সমৃদ্ধ যা আপনার ব্যক্তিত্বে যুক্ত করবে অভিজাত আভিজাত্য।',
    colors: [
      { name: 'Emerald Green', hex: '#047857', image: '/uploads/media/borka-kaftan-1.jpg' },
      { name: 'Deep Navy', hex: '#1e3a8a', image: '/uploads/media/borka-kaftan-2.jpg' },
      { name: 'Dusty Mauve', hex: '#701a75', image: '/uploads/media/borka-kaftan-3.jpg' },
      { name: 'Royal Black', hex: '#0f172a', image: '/uploads/media/borka-kaftan-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-kaftan-1.jpg',
      '/uploads/media/borka-kaftan-2.jpg',
      '/uploads/media/borka-kaftan-3.jpg',
      '/uploads/media/borka-kaftan-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#047857',
      secondary: '#b45309',
      accent: '#d1fae5',
      bgGradient: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)',
      bannerNotice: '✨ লাক্সারি কালেকশন! সীমিত সময়ের জন্য বিশেষ ছাড় অফার! ✨',
      headline: 'রয়েল অ্যারাবিয়ান দুবাই কাফতান আবায়া মাত্র ১৫৫০ টাকা!',
      subheadline: 'উচ্চমানের কোরিয়ান শিফন জর্জেট ফেব্রিক্স ও গোল্ডেন টাসেল বেল্ট সহ আকর্ষণীয় ফল।'
    },
    features: [
      'অরিজিনাল কোরিয়ান প্রিমিয়াম শিফন জর্জেট কাপড়।',
      'লুজ-ফিট রয়্যাল গালফ কাট ও ট্রেন্ডি বেল স্লিভ ডিজাইন।',
      'গোল্ডেন মেটাল টাসেল এডজাস্টেবল বেল্ট অন্তর্ভুক্ত।',
      'যেকোনো উৎসব, পার্টি বা সামাজিক অনুষ্ঠানে অনন্য লুক।',
      'সারা দেশে ক্যাশ অন ডেলিভারি এবং দ্রুততম শিপিং।'
    ],
    sizeChart: [
      { size: '50', chest: 'ফ্রি সাইজ (Chest 48-52")', length: '50"', sleeve: '22"', hip: '60"' },
      { size: '52', chest: 'ফ্রি সাইজ (Chest 48-52")', length: '52"', sleeve: '23"', hip: '62"' },
      { size: '54', chest: 'ফ্রি সাইজ (Chest 50-54")', length: '54"', sleeve: '24"', hip: '64"' },
      { size: '56', chest: 'ফ্রি সাইজ (Chest 50-56")', length: '56"', sleeve: '24.5"', hip: '66"' }
    ],
    reviews: [
      { name: 'নুসরাত জাহান মিম', city: 'ধানমন্ডি, ঢাকা', rating: 5, text: 'কাফতানের ঘের অনেক বেশি এবং ফল দেখতে অসম্ভব গর্জিয়াস! সবাই প্রশংসা করেছে।', date: '৩ দিন আগে' },
      { name: 'তাসলিমা নাসরিন', city: 'খুলনা', rating: 5, text: 'এমেরাল্ড গ্রিন কালারটা জাস্ট ওয়াও! ছবিতে যেমন কালার শাইনিং ছিল হুবহু তেমনই পেয়েছি।', date: '৫ দিন আগে' },
      { name: 'মেহজাবিন আহমেদ', city: 'কুমিল্লা', rating: 5, text: 'টাসেল বেল্টটা খুব সুন্দর। লুজ-ফিট হওয়ায় অনেক কমফোর্টেবল।', date: '১ সপ্তাহ আগে' },
      { name: 'শামীমা আক্তার', city: 'গাজীপুর', rating: 5, text: 'কুরিয়ার সার্ভিস খুব ফাস্ট ছিল। কোয়ালিটি ও প্রাইস মিলিয়ে বেস্ট কাফতান আবায়া।', date: '২ সপ্তাহ আগে' }
    ]
  },

  // 3. TURKISH BUTTERFLY ABAYA
  {
    name: 'তুর্কি বাটারফ্লাই ফ্লোয়িং আবায়া',
    slug: 'borka-turkish-butterfly',
    sku: 'BORKA-BUTTERFLY-003',
    regularPrice: 1950,
    salePrice: 1380,
    buyPrice: 850,
    category: 'বোরকা কালেকশন',
    description: 'তুর্কি স্টাইল বাটারফ্লাই উইং ড্র্যাপ কাট আবায়া। উচ্চ ঘের ও সফট সৌদী নিদা ফেব্রিক্সে তৈরি যা আপনাকে দেবে রাজকীয় স্নিগ্ধতা।',
    colors: [
      { name: 'Royal Blue', hex: '#1e3a8a', image: '/uploads/media/borka-butterfly-1.jpg' },
      { name: 'Jet Black', hex: '#0f172a', image: '/uploads/media/borka-butterfly-2.jpg' },
      { name: 'Deep Maroon', hex: '#881337', image: '/uploads/media/borka-butterfly-3.jpg' },
      { name: 'Coffee Brown', hex: '#451a03', image: '/uploads/media/borka-butterfly-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-butterfly-1.jpg',
      '/uploads/media/borka-butterfly-2.jpg',
      '/uploads/media/borka-butterfly-3.jpg',
      '/uploads/media/borka-butterfly-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#1e3a8a',
      secondary: '#0284c7',
      accent: '#dbeafe',
      bgGradient: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
      bannerNotice: '🦋 আধুনিক তুর্কি বাটারফ্লাই আবায়া — সেরা শালীনতা ও আধুনিকতার মেলবন্ধন! 🦋',
      headline: 'তুর্কি বাটারফ্লাই ফ্লোয়িং আবায়া স্পেশাল ডিসকাউন্টে মাত্র ১৩৮০ টাকা!',
      subheadline: 'ফুল কভারেজ ব্যাটউইং কাট ও সুপার সফট সৌদি নিদা কাপড়ে অপূর্ব স্নিগ্ধতা।'
    },
    features: [
      'আমদানিকৃত সৌদি সফট নিদা ফেব্রিক্স, কোনো ভাঁজ পড়ে না।',
      'প্রচুর ঘের সহ তুর্কি ব্যাটউইং স্টাইল ফল যা ফুল বডি শালীনতা নিশ্চিত করে।',
      'হাতের কবজিতে সফট স্মোকিং ইলাস্টিক গ্রিপ যা নামাজ বা ওজুর সময় সহজে ওপরে তোলা যায়।',
      'গায়ে দিলে একদম হালকা ও বাতাস চলাচল উপযোগী মনোরম ফ্যাব্রিক।',
      'পছন্দ না হলে পার্সেল ফেরত দেওয়ার ১০০% সুযোগ।'
    ],
    sizeChart: [
      { size: '50', chest: 'ফ্রি সাইজ (ব্যাটউইং ঘের)', length: '50"', sleeve: '22"', hip: '70"+' },
      { size: '52', chest: 'ফ্রি সাইজ (ব্যাটউইং ঘের)', length: '52"', sleeve: '23"', hip: '72"+' },
      { size: '54', chest: 'ফ্রি সাইজ (ব্যাটউইং ঘের)', length: '54"', sleeve: '24"', hip: '74"+' },
      { size: '56', chest: 'ফ্রি সাইজ (ব্যাটউইং ঘের)', length: '56"', sleeve: '24.5"', hip: '76"+' }
    ],
    reviews: [
      { name: 'সুমাইয়া বিনতে নূর', city: 'উত্তরা, ঢাকা', rating: 5, text: 'বাটারফ্লাই কাটটা মাশাআল্লাহ এত সুন্দর ফল দেয়! হাত তোলার সময় কোনো টান লাগে না।', date: 'গতকাল' },
      { name: 'মারিয়া সুলতানা', city: 'বগুড়া', rating: 5, text: 'কাপড়টা গায়ে লাগলেই বোঝা যায় কতটা আরামদায়ক। নামাজ পড়ার জন্যও অসাধারণ।', date: '৩ দিন আগে' },
      { name: 'নাজমুন নাহার', city: 'ময়মনসিংহ', rating: 5, text: 'রয়েল ব্লু কালারটা চোখে পড়ার মতো সুন্দর। সেলাই নিখুঁত ছিল।', date: '৬ দিন আগে' },
      { name: 'জাকিয়া সুলতানা', city: 'ফেনী', rating: 5, text: 'আমার আম্মুর জন্য নিয়েছি, উনি অনেক খুশি হয়েছেন। হাইলি রিকমেন্ডেড!', date: '২ সপ্তাহ আগে' }
    ]
  },

  // 4. KASHMIRI RESHAM EMBROIDERED PARTY BORKA
  {
    name: 'কাশ্মীরি রেশম সুতার গর্জিয়াস পার্টি বোরখা',
    slug: 'borka-kashmiri-party',
    sku: 'BORKA-KASHMIRI-004',
    regularPrice: 2450,
    salePrice: 1750,
    buyPrice: 1050,
    category: 'বোরকা কালেকশন',
    description: 'বুকে, গলায় ও হাতায় নিখুঁত কাশ্মীরি রেশম সুতার গর্জিয়াস ফ্লোরাল এমব্রয়ডারি ওয়ার্ক। বিশেষ কোনো বিবাহ বা দাওয়াতে আপনার মধ্যমণি হয়ে ওঠার নিশ্চায়ক।',
    colors: [
      { name: 'Royal Plum', hex: '#581c87', image: '/uploads/media/borka-kashmiri-1.jpg' },
      { name: 'Wine Red', hex: '#831843', image: '/uploads/media/borka-kashmiri-2.jpg' },
      { name: 'Midnight Black', hex: '#0f172a', image: '/uploads/media/borka-kashmiri-3.jpg' },
      { name: 'Teal Green', hex: '#115e59', image: '/uploads/media/borka-kashmiri-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-kashmiri-1.jpg',
      '/uploads/media/borka-kashmiri-2.jpg',
      '/uploads/media/borka-kashmiri-3.jpg',
      '/uploads/media/borka-kashmiri-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#581c87',
      secondary: '#db2777',
      accent: '#f3e8ff',
      bgGradient: 'linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)',
      bannerNotice: '🌸 বিয়ের পার্টি ও ঈদ কালেকশনের গর্জিয়াস কাশ্মীরি এমব্রয়ডারি বোরখা! 🌸',
      headline: 'কাশ্মীরি রেশম সুতার এমব্রয়ডারি পার্টি বোরখা মাত্র ১৭৫০ টাকা!',
      subheadline: 'উন্নত জর্জেট ফ্যাব্রিকে নিখুঁত কাশ্মীরি সুতার হাতের কাজ ও ডায়মন্ড স্টোন।'
    },
    features: [
      'হাতে তৈরি খাঁটি কাশ্মীরি রেশম সুতার কারুকাজ ও স্পার্কলিং স্টোন ফিনিশ।',
      'প্রিমিয়াম কোয়ালিটি ডাবল লেয়ার জর্জেট, একটুও ট্রান্সপারেন্ট নয়।',
      'হাতার কাফ ও নেকলাইনে আকর্ষণীয় ডেকোরেটিভ বর্ডার।',
      'যেকোনো বিয়ে, রিসিপশন বা পারিবারিক অনুষ্ঠানে সেরা আকর্ষণ।',
      '১০০% কালার ও সুতা ফাস্টনেস গ্যারান্টি।'
    ],
    sizeChart: [
      { size: '50', chest: '44-48"', length: '50"', sleeve: '22"', hip: '54"' },
      { size: '52', chest: '44-48"', length: '52"', sleeve: '23"', hip: '56"' },
      { size: '54', chest: '46-50"', length: '54"', sleeve: '24"', hip: '58"' },
      { size: '56', chest: '48-52"', length: '56"', sleeve: '24.5"', hip: '60"' }
    ],
    reviews: [
      { name: 'সাবরিনা জাহান পিয়া', city: 'গুলশান, ঢাকা', rating: 5, text: 'এমব্রয়ডারির কাজটা অসম্ভব নিখুঁত! ছবির চেয়েও বাস্তবে অনেক বেশি ঝলমলে।', date: '২ দিন আগে' },
      { name: 'শাহনাজ পারভীন', city: 'বরিশাল', rating: 5, text: 'আমার ননদের বিয়ের জন্য নিয়েছিলাম। সবাই জিজ্ঞেস করেছে কোথা থেকে কিনেছি। দারুণ!', date: '৪ দিন আগে' },
      { name: 'লায়লা আরজুমান্দ', city: 'যশোর', rating: 5, text: 'প্লাম কালারটা অসাধারণ মানিয়েছে। কাপড় হেভি কিন্তু পরলে বেশ আরাম লাগে।', date: '১ সপ্তাহ আগে' },
      { name: 'রিফাত সুলতানা', city: 'রংপুর', rating: 5, text: 'প্যাকেজিং খুব প্রিমিয়াম ছিল। সাইজ একদম পারফেক্ট হয়েছে।', date: '৩ সপ্তাহ আগে' }
    ]
  },

  // 5. MODERN FRONT-OPEN ZIPPER COAT BORKA
  {
    name: 'মডার্ন ফ্রন্ট ওপেন জিপার কোট বোরখা',
    slug: 'borka-front-open-coat',
    sku: 'BORKA-COAT-005',
    regularPrice: 1850,
    salePrice: 1290,
    buyPrice: 800,
    category: 'বোরকা কালেকশন',
    description: 'আধুনিক স্মার্ট লুকিং কোট স্টাইল বোরখা। ফুল ফ্রন্ট মেটাল জিপার ও ইউটিলিটি সাইড পকেট সমৃদ্ধ যা অফিস, ক্যাম্পাস ও দৈনন্দিন চলাচলে অত্যন্ত আরামদায়ক।',
    colors: [
      { name: 'Slate Grey', hex: '#475569', image: '/uploads/media/borka-coat-1.jpg' },
      { name: 'Midnight Black', hex: '#0f172a', image: '/uploads/media/borka-coat-2.jpg' },
      { name: 'Olive Green', hex: '#3f6212', image: '/uploads/media/borka-coat-3.jpg' },
      { name: 'Navy Blue', hex: '#1e3a8a', image: '/uploads/media/borka-coat-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-coat-1.jpg',
      '/uploads/media/borka-coat-2.jpg',
      '/uploads/media/borka-coat-3.jpg',
      '/uploads/media/borka-coat-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#334155',
      secondary: '#d97706',
      accent: '#e2e8f0',
      bgGradient: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
      bannerNotice: '⚡ ক্যাম্পাস ও অফিসের জন্য সেরা স্মার্ট আউটলুক ফ্রন্ট জিপার কোট বোরখা! ⚡',
      headline: 'মডার্ন ফ্রন্ট ওপেন জিপার কোট বোরখা মাত্র ১২৯০ টাকা!',
      subheadline: 'হেভি টুইল জর্জেট ফেব্রিক্স ও প্রিমিয়াম মেটাল জিপার সহ ডিপ সাইড পকেট।'
    },
    features: [
      'অরিজিনাল হেভি টুইল সফট জর্জেট ফেব্রিক্স, সহজে কুঁচকে যায় না।',
      'হেভি ডিউটি স্মুথ ফ্রন্ট জিপার যা সহজে খোলা ও পরা যায়।',
      'মোবাইল বা টাকা রাখার জন্য দুই পাশে ডিপ সিক্রেট পকেট।',
      'স্মার্ট ফরমাল কলার ও শালীন লং কোট কাটিং।',
      'দৈনন্দিন কর্মজীবী নারী ও শিক্ষার্থীদের জন্য আদর্শ।'
    ],
    sizeChart: [
      { size: '50', chest: '42-46"', length: '50"', sleeve: '22"', hip: '50"' },
      { size: '52', chest: '44-48"', length: '52"', sleeve: '23"', hip: '52"' },
      { size: '54', chest: '46-50"', length: '54"', sleeve: '23.5"', hip: '54"' },
      { size: '56', chest: '48-52"', length: '56"', sleeve: '24"', hip: '56"' }
    ],
    reviews: [
      { name: 'ড. নিশাত তামান্না', city: 'মোহাম্মদপুর, ঢাকা', rating: 5, text: 'হাসপাতালে ডিউটির জন্য জিপার বোরখাটা দারুণ কমফোর্টেবল। পকেট থাকায় ফোন রাখতে খুব সুবিধা।', date: '১ দিন আগে' },
      { name: 'তাসনুভা শারমিন', city: 'ঢাকা বিশ্ববিদ্যালয় এরিয়া', rating: 5, text: 'ক্লাসে যাওয়ার জন্য এটা একদম পারফেক্ট। দেখতে স্মার্ট এবং শালীন।', date: '৩ দিন আগে' },
      { name: 'আয়েশা সিদ্দিকা', city: 'কুষ্টিয়া', rating: 5, text: 'জিপারটা অনেক স্মুথ, কোনো আটকে যাওয়ার ঝামেলা নেই। কাপড় প্রিমিয়াম।', date: '৫ দিন আগে' },
      { name: 'ফাহিমা নাসরিন', city: 'দিনাজপুর', rating: 5, text: 'দ্বিতীয়বার অর্ডার করলাম। কোয়ালিটি সবসময় একরকম বজায় রাখার জন্য ধন্যবাদ!', date: '১ সপ্তাহ আগে' }
    ]
  },

  // 6. DOUBLE LAYERED MERMAID BORKA WITH KOTI
  {
    name: 'ডাবল লেয়ার্ড মারমেইড বোরখা উইথ কোটি',
    slug: 'borka-double-layer-koti',
    sku: 'BORKA-KOTI-006',
    regularPrice: 2650,
    salePrice: 1890,
    buyPrice: 1100,
    category: 'বোরকা কালেকশন',
    description: '২-ইন-১ কম্বো: মারমেইড কাট ইনার গাউন ও আলাদা গর্জিয়াস এমব্রয়ডারি কোটি/শ্রাগ। একইসাথে সিম্পল ও গর্জিয়াস দুটি ভিন্ন স্টাইলে পরার অনন্য সুবিধা।',
    colors: [
      { name: 'Deep Maroon', hex: '#881337', image: '/uploads/media/borka-koti-1.jpg' },
      { name: 'Royal Black', hex: '#0f172a', image: '/uploads/media/borka-koti-2.jpg' },
      { name: 'Pine Green', hex: '#14532d', image: '/uploads/media/borka-koti-3.jpg' },
      { name: 'Chocolate Brown', hex: '#3b1204', image: '/uploads/media/borka-koti-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-koti-1.jpg',
      '/uploads/media/borka-koti-2.jpg',
      '/uploads/media/borka-koti-3.jpg',
      '/uploads/media/borka-koti-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#881337',
      secondary: '#b45309',
      accent: '#ffe4e6',
      bgGradient: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)',
      bannerNotice: '👑 ২-ইন-১ কম্বো অফার! আলাদা কোটি সহ সম্পূর্ণ ডাবল লেয়ার সেট! 👑',
      headline: 'ডাবল লেয়ার্ড মারমেইড বোরখা উইথ কোটি মাত্র ১৮৯০ টাকা!',
      subheadline: 'ইনার গাউন ও আকর্ষণীয় এমব্রয়ডারি কোটি — কোটি ছাড়াও পরা যাবে।'
    },
    features: [
      'আলাদা ডিটাচেবল লং কোটি যা অন্যান্য ড্রেসের সাথেও পরা যাবে।',
      'ইনার গাউনে মারমেইড ফ্লেয়ারড কাট যা সুন্দর ফল দেয়।',
      'প্রিমিয়াম দুবাই চেরি ও জর্জেট ফেব্রিক্সের সমন্বয়।',
      'একটি পোশাকে দুটি সম্পূর্ণ ভিন্ন ফ্যাশনেবল লুক।',
      'প্যাকেট খুলে চেক করে শতভাগ সন্তুষ্ট হয়ে মূল্য পরিশোধের সুযোগ।'
    ],
    sizeChart: [
      { size: '50', chest: '44-48"', length: '50"', sleeve: '22"', hip: '56"' },
      { size: '52', chest: '44-48"', length: '52"', sleeve: '23"', hip: '58"' },
      { size: '54', chest: '46-50"', length: '54"', sleeve: '24"', hip: '60"' },
      { size: '56', chest: '48-52"', length: '56"', sleeve: '24.5"', hip: '62"' }
    ],
    reviews: [
      { name: 'তানজিনা শারমিন রিয়া', city: 'বনশ্রী, ঢাকা', rating: 5, text: 'কোটিটা এত চমৎকার কাজ করা! কোটি ছাড়া নরমালিও পরা যায়। ১ পোশাকে ২ টা স্টাইল পেয়ে লাভবান হলাম।', date: '২ দিন আগে' },
      { name: 'ইসরাত জাহান', city: 'সিলেট', rating: 5, text: 'মেরুন কালারটা জাস্ট লাভলি। সেলাই ও কোটি কাপড়ের কোয়ালিটি এ-ওয়ান!', date: '৪ দিন আগে' },
      { name: 'শামীমা নাসরিন', city: 'কক্সবাজার', rating: 5, text: 'মারমেইড ঘেরের জন্য হাঁটাচলা করতে অনেক আরাম লাগে। থ্যাংক ইউ!', date: '১ সপ্তাহ আগে' },
      { name: 'হুমায়রা আক্তার', city: 'চাঁদপুর', rating: 5, text: 'খুব সুন্দর একটা বোরখা। কাপড়ে কোনো খসখসে ভাব নেই।', date: '৩ সপ্তাহ আগে' }
    ]
  },

  // 7. DIAMOND GEORGETTE KIMONO WRAP ABAYA
  {
    name: 'ডায়মন্ড জর্জেট কিমোনো র্যাপ আবায়া',
    slug: 'borka-diamond-kimono',
    sku: 'BORKA-KIMONO-007',
    regularPrice: 2100,
    salePrice: 1480,
    buyPrice: 900,
    category: 'বোরকা কালেকশন',
    description: 'ট্রেন্ডি কিমোনো র্যাপ স্টাইল আবায়া। কন্ট্রাস্ট সাটিন পাইপিং ও এডজাস্টেবল টাই-আপ র্যাপ ওয়েস্টবেল্ট যা দেয় স্মার্ট ও স্লিম মার্জিত ফিগার লুক।',
    colors: [
      { name: 'Dusty Rose', hex: '#9d174d', image: '/uploads/media/borka-kimono-1.jpg' },
      { name: 'Classic Black', hex: '#0f172a', image: '/uploads/media/borka-kimono-2.jpg' },
      { name: 'Mauve Violet', hex: '#581c87', image: '/uploads/media/borka-kimono-3.jpg' },
      { name: 'Latte Brown', hex: '#78350f', image: '/uploads/media/borka-kimono-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-kimono-1.jpg',
      '/uploads/media/borka-kimono-2.jpg',
      '/uploads/media/borka-kimono-3.jpg',
      '/uploads/media/borka-kimono-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#9d174d',
      secondary: '#b45309',
      accent: '#fce7f3',
      bgGradient: 'linear-gradient(180deg, #fdf2f8 0%, #ffffff 100%)',
      bannerNotice: '🎀 আধুনিক তরুণীদের প্রিয় কিমোনো র্যাপ আবায়া — আকর্ষণীয় পাইপিং ফিনিশ! 🎀',
      headline: 'ডায়মন্ড জর্জেট কিমোনো র্যাপ আবায়া মাত্র ১৪৮০ টাকা!',
      subheadline: 'আমদানিকৃত ডায়মন্ড ক্র্যাপ জর্জেট ও সাটিন পাইপিং সহ ওয়েস্ট বেল্ট।'
    },
    features: [
      'আমদানিকৃত ডায়মন্ড টেক্সচার্ড জর্জেট ফেব্রিক্স যা ওজনে হালকা ও সফট।',
      'স্মার্ট কিমোনো র্যাপ স্টাইল ওভারল্যাপ ফ্রন্ট কাট।',
      'এডজাস্টেবল কোমর বেল্ট যা প্রয়োজন অনুযায়ী লুজ বা ফিট করা যায়।',
      'হাতা ও বর্ডারে লাক্সারি সাটিন পাইপিং ডিটেইলিং।',
      'সহজ হোম ওয়াশ ও দীর্ঘস্থায়ী রঙ।'
    ],
    sizeChart: [
      { size: '50', chest: '44-48"', length: '50"', sleeve: '22"', hip: '54"' },
      { size: '52', chest: '44-48"', length: '52"', sleeve: '23"', hip: '56"' },
      { size: '54', chest: '46-50"', length: '54"', sleeve: '24"', hip: '58"' },
      { size: '56', chest: '48-52"', length: '56"', sleeve: '24.5"', hip: '60"' }
    ],
    reviews: [
      { name: 'আনিসা তাহসিন', city: 'মিরপুর ডিওএইচএস, ঢাকা', rating: 5, text: 'কিমোনো স্টাইলটা ভীষণ ট্রেন্ডি! ডাস্টি রোজ রঙটা ছবিতে যেমন মিষ্টি বাস্তবেও তাই।', date: 'গতকাল' },
      { name: 'তাসফিয়া তাবাসসুম', city: 'নারায়ণগঞ্জ', rating: 5, text: 'ওয়েস্ট বেল্ট দিয়ে সুন্দরভাবে সাইজ অ্যাডজাস্ট করে পরা যায়। দারুণ প্রোডাক্ট।', date: '৪ দিন আগে' },
      { name: 'রাবেয়া বসরী', city: 'টাঙ্গাইল', rating: 5, text: 'কাপড়টা একদম রিঙ্কেল-ফ্রি। ইস্ত্রি করার তেমন দরকার পড়ে না।', date: '১ সপ্তাহ আগে' },
      { name: 'মেহের আফরোজ', city: 'সিলেট', rating: 5, text: 'ডেলিভারি ম্যান ভদ্র ছিল। পণ্য দেখে টাকা দিয়েছি। ১০ এ ১০!', date: '২ সপ্তাহ আগে' }
    ]
  },

  // 8. PURE ARABIC LINEN EVERYDAY BORKA
  {
    name: 'পিওর এরাবিক লিনেন ডেইলি ব্রিদেবল বোরখা',
    slug: 'borka-arabic-linen',
    sku: 'BORKA-LINEN-008',
    regularPrice: 1550,
    salePrice: 1050,
    buyPrice: 650,
    category: 'বোরকা কালেকশন',
    description: 'গ্রীষ্মের গরমে সর্বাধিক আরামদায়ক পিওর অ্যারাবিয়ান লিনেন কটন বোরখা। অত্যন্ত ব্রিদেবল, হালকা ও ঘামরোধী যা দৈনন্দিন ব্যবহারের জন্য সেরা।',
    colors: [
      { name: 'Olive Green', hex: '#3f6212', image: '/uploads/media/borka-linen-1.jpg' },
      { name: 'Desert Brown', hex: '#78350f', image: '/uploads/media/borka-linen-2.jpg' },
      { name: 'Cream Beige', hex: '#d97706', image: '/uploads/media/borka-linen-3.jpg' },
      { name: 'Pure White', hex: '#f8fafc', image: '/uploads/media/borka-linen-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-linen-1.jpg',
      '/uploads/media/borka-linen-2.jpg',
      '/uploads/media/borka-linen-3.jpg',
      '/uploads/media/borka-linen-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#15803d',
      secondary: '#0f766e',
      accent: '#dcfce7',
      bgGradient: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
      bannerNotice: '🌿 গরমে প্রশান্তি! ১০০% পিওর ন্যাচারাল এরাবিক লিনেন ফেব্রিক্স! 🌿',
      headline: 'পিওর এরাবিক লিনেন ডেইলি ব্রিদেবল বোরখা মাত্র ১০৫০ টাকা!',
      subheadline: 'উচ্চ বাতাস চলাচল উপযোগী ন্যাচারাল লিনেন কটন — সারাদিন ক্লান্তিহীন।'
    },
    features: [
      'ন্যাচারাল এরাবিক লিনেন ব্লেন্ড, ঘাম শোষণ করে দ্রুত শুকায়।',
      'প্রচণ্ড রোদেও শরীর রাখে শীতল ও আরামদায়ক।',
      'দৈনন্দিন মাদ্রাসা, কলেজ বা বাজারে যাতায়াতের জন্য আদর্শ।',
      'বারবার ওয়াশ করলেও ফেব্রিক্স বা কালার নষ্ট হয় না।',
      'প্যাকেট দেখে নিশ্চিন্ত হয়ে মূল্য পরিশোধের সুবিধা।'
    ],
    sizeChart: [
      { size: '50', chest: '42-46"', length: '50"', sleeve: '22"', hip: '50"' },
      { size: '52', chest: '44-48"', length: '52"', sleeve: '23"', hip: '52"' },
      { size: '54', chest: '46-50"', length: '54"', sleeve: '23.5"', hip: '54"' },
      { size: '56', chest: '48-52"', length: '56"', sleeve: '24"', hip: '56"' }
    ],
    reviews: [
      { name: 'উম্মে হাবিবা', city: 'যাত্রাবাড়ী, ঢাকা', rating: 5, text: 'এত আরামদায়ক কাপড় আমি আগে পরিনি! সারাদিন পরে থাকলেও একটুও গরম লাগে না।', date: '৩ দিন আগে' },
      { name: 'সালমা খাতুন', city: 'পাবনা', rating: 5, text: 'অলিভ গ্রিন কালারটা অনেক স্নিগ্ধ। কাপড়টা ধোয়ার পরেও আগের মতোই আছে।', date: '৫ দিন আগে' },
      { name: 'ফাতিমা তুজ জোহরা', city: 'ব্রাহ্মণবাড়িয়া', rating: 5, text: 'মূল্য হিসেবে সেরা প্রোডাক্ট। মাদ্রাসা যাওয়ার জন্য নিয়মিত পরছি।', date: '১ সপ্তাহ আগে' },
      { name: 'শিরিন আক্তার', city: 'গোপালগঞ্জ', rating: 5, text: 'অর্ডার করার পরদিনই ডেলিভারি পেয়েছি। সাইজ ৫৪ একদম ঠিকঠাক।', date: '২ সপ্তাহ আগে' }
    ]
  },

  // 9. ROYAL VELVET WINTER FESTIVE BORKA
  {
    name: 'রয়েল ভেলভেট প্রিমিয়াম উইন্টার বোরখা',
    slug: 'borka-royal-velvet',
    sku: 'BORKA-VELVET-009',
    regularPrice: 3200,
    salePrice: 2250,
    buyPrice: 1400,
    category: 'বোরকা কালেকশন',
    description: 'উচ্চমানের কোরিয়ান মাইক্রো-ভেলভেট কাপড়ে তৈরি শীতকালীন লাক্সারি বোরখা। রাজকীয় গোল্ডেন লেস বর্ডার ও সফট উষ্ণতা যা শীতের রাতে আপনাকে রাখবে উষ্ণ ও চোখধাঁধানো।',
    colors: [
      { name: 'Onyx Black', hex: '#0f172a', image: '/uploads/media/borka-velvet-1.jpg' },
      { name: 'Midnight Navy', hex: '#1e3a8a', image: '/uploads/media/borka-velvet-2.jpg' },
      { name: 'Burgundy Velvet', hex: '#881337', image: '/uploads/media/borka-velvet-3.jpg' },
      { name: 'Emerald Velvet', hex: '#064e3b', image: '/uploads/media/borka-velvet-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-velvet-1.jpg',
      '/uploads/media/borka-velvet-2.jpg',
      '/uploads/media/borka-velvet-3.jpg',
      '/uploads/media/borka-velvet-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#0f172a',
      secondary: '#d97706',
      accent: '#fef3c7',
      bgGradient: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
      bannerNotice: '❄️ শীতকালীন স্পেশাল লাক্সারি! কোরিয়ান সফট মাইক্রো-ভেলভেট আবায়া! ❄️',
      headline: 'রয়েল ভেলভেট প্রিমিয়াম উইন্টার বোরখা মাত্র ২২৫০ টাকা!',
      subheadline: 'উষ্ণ সফট মাইক্রো-ভেলভেট ও জারদৌসি গোল্ডেন লেস বর্ডার।'
    },
    features: [
      'হেভি ৯০০০ কোরিয়ান মাইক্রো-ভেলভেট ফেব্রিক্স, চমৎকার শাইনিং ও উষ্ণতা।',
      'হাতায় ও গলায় হেভি জারদৌসি মেটালিক গোল্ড লেস ডিজাইন।',
      'শীতের মৌসুমে দাওয়াতে সোয়েটার বা চাদর ছাড়াই মার্জিত ও রাজকীয় লুক।',
      'ভেলভেটের লোম ওঠে না ও দীর্ঘদিন নতুনের মতো টেকসই থাকে।',
      'প্রিমিয়াম বক্স প্যাকেজিং ও ফ্রি ডেলিভারি অফার।'
    ],
    sizeChart: [
      { size: '50', chest: '44-48"', length: '50"', sleeve: '22"', hip: '54"' },
      { size: '52', chest: '44-48"', length: '52"', sleeve: '23"', hip: '56"' },
      { size: '54', chest: '46-50"', length: '54"', sleeve: '24"', hip: '58"' },
      { size: '56', chest: '48-52"', length: '56"', sleeve: '24.5"', hip: '60"' }
    ],
    reviews: [
      { name: 'ব্যারিস্টার নুসরাত রহমান', city: 'গুলশান, ঢাকা', rating: 5, text: 'ভেলভেটের কোয়ালিটি সত্যিই অবিশ্বাস্য! বাইরে গেলে সবাই তাকায়। শীতের জন্য সেরা চয়েস।', date: '১ দিন আগে' },
      { name: 'ফারহা দিবা', city: 'সিলেট', rating: 5, text: 'অনেক ভারী ও রাজকীয় একটা পোশাক। গায়ে দিলে এক অনন্য ফিলিং দেয়।', date: '৩ দিন আগে' },
      { name: 'মোসাম্মৎ বিলকিস', city: 'খুলনা', rating: 5, text: 'গোল্ডেন লেসটা খুব যত্ন করে বসানো হয়েছে। ফিনিশিং অসাধারণ!', date: '১ সপ্তাহ আগে' },
      { name: 'তাসনুভা শারমিন', city: 'চট্টগ্রাম', rating: 5, text: 'প্রাইস অনুযায়ী এর ভ্যালু অনেক বেশি। বিয়ের গিফট দেওয়ার জন্যও দারুণ।', date: '২ সপ্তাহ আগে' }
    ]
  },

  // 10. CLASSIC NAWAB SAUDI CUT WITH CHIFFON HIJAB SET
  {
    name: 'ক্লাসিক নোয়াব আবায়া উইথ শিফন হিজাব সেট',
    slug: 'borka-nawab-hijab-set',
    sku: 'BORKA-NAWAB-010',
    regularPrice: 1850,
    salePrice: 1350,
    buyPrice: 850,
    category: 'বোরকা কালেকশন',
    description: 'ঐতিহ্যবাহী সৌদি নবাব কাট সোজা স্ট্রেট আবায়া। সাথে পাচ্ছেন ম্যাচিং প্রিমিয়াম ৯০×৩৬ ইঞ্চি শিফন হিজাব একদম ফ্রি! কমপ্লিট শালীন লুকের পারফেক্ট কম্বো।',
    colors: [
      { name: 'Deep Teal', hex: '#115e59', image: '/uploads/media/borka-nawab-1.jpg' },
      { name: 'Navy Blue', hex: '#1e3a8a', image: '/uploads/media/borka-nawab-2.jpg' },
      { name: 'Snow White', hex: '#ffffff', image: '/uploads/media/borka-nawab-3.jpg' },
      { name: 'Classic Black', hex: '#0f172a', image: '/uploads/media/borka-nawab-4.jpg' }
    ],
    sizes: ['50', '52', '54', '56'],
    images: [
      '/uploads/media/borka-nawab-1.jpg',
      '/uploads/media/borka-nawab-2.jpg',
      '/uploads/media/borka-nawab-3.jpg',
      '/uploads/media/borka-nawab-4.jpg'
    ],
    videoUrl: 'https://www.youtube.com/watch?v=EyCq1WOsWq8',
    theme: {
      primary: '#115e59',
      secondary: '#d97706',
      accent: '#ccfbf1',
      bgGradient: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)',
      bannerNotice: '🎁 স্পেশাল কম্বো অফার! আবায়ার সাথে ম্যাচিং বড় সাইজ শিফন হিজাব ফ্রি! 🎁',
      headline: 'ক্লাসিক নোয়াব আবায়া উইথ শিফন হিজাব সেট মাত্র ১৩৫০ টাকা!',
      subheadline: 'সৌদি ট্রেডিশনাল স্ট্রেট কাট আবায়া ও ম্যাচিং ৯০×৩৬ ইঞ্চি শিফন হিজাব।'
    },
    features: [
      'সম্পূর্ণ ফ্রি ৯০×৩৬ ইঞ্চি প্রিমিয়াম ডাবল শিফন ম্যাচিং হিজাব।',
      'ট্রেডিশনাল সৌদি নবাব স্ট্রেট কাট যা পরলে স্লিম ও লম্বা দেখায়।',
      'প্রিমিয়াম দুবাই ক্র্যাপ ফেব্রিক্স যা সবসময় আয়রন ছাড়াই পরা যায়।',
      'হাতা ও গলায় আকর্ষণীয় গোল্ডেন পাইপিং ওয়ার্ক।',
      'হাতে পেয়ে দেখে নিশ্চিত হয়ে ক্যাশ অন ডেলিভারিতে নেওয়ার সুবিধা।'
    ],
    sizeChart: [
      { size: '50', chest: '42-46"', length: '50"', sleeve: '22"', hip: '52"' },
      { size: '52', chest: '44-48"', length: '52"', sleeve: '23"', hip: '54"' },
      { size: '54', chest: '46-50"', length: '54"', sleeve: '23.5"', hip: '56"' },
      { size: '56', chest: '48-52"', length: '56"', sleeve: '24"', hip: '58"' }
    ],
    reviews: [
      { name: 'তাহমিনা আফরোজ', city: 'লালমাটিয়া, ঢাকা', rating: 5, text: 'হিজাবটা অনেক বড় সাইজের এবং কাপড়ের কোয়ালিটি খুবই চমৎকার। আলাদা হিজাব কেনার ঝামেলা নেই।', date: 'গতকাল' },
      { name: 'মমতা হেনা', city: 'সিলেট', rating: 5, text: 'সৌদি কাটিংটা অসাধারণ শালীন। টিল কালারটা খুব সুন্দর ফুটে উঠেছে।', date: '৩ দিন আগে' },
      { name: 'নাজিয়া হাসান', city: 'নরসিংদী', rating: 5, text: '১৩৫০ টাকায় হিজাব সহ বোরখা পাওয়া সত্যিই অসাধারণ অফার! আমি অনেক সন্তুষ্ট।', date: '১ সপ্তাহ আগে' },
      { name: 'সাবেরা বেগম', city: 'নাটোর', rating: 5, text: 'কুরিয়ার ম্যানের সামনে চেক করেছি। পারফেক্ট সাইজ ও কালার। ধন্যবাদ!', date: '২ সপ্তাহ আগে' }
    ]
  }
];

async function main() {
  console.log('================================================================');
  console.log('🚀 SEEDING 10 HIGH-CONVERTING BORKA SALES FUNNEL LANDING PAGES');
  console.log('================================================================\n');

  const settings = (await prisma.storefrontSettings.findFirst()) || (await prisma.storefrontSettings.findUnique({ where: { id: 'default' } }));
  const insideDhaka = settings?.insideDhakaCharge ?? 70;
  const outsideDhaka = settings?.outsideDhakaCharge ?? 150;

  const existingUser = await prisma.user.findFirst({ select: { id: true, name: true } });
  const userId = existingUser?.id || 'system';
  const userName = existingUser?.name || 'Administrator';

  // 1. Ensure all images are registered in MediaAsset
  console.log('--- STEP 1: Registering Media Assets in Database ---');
  for (const borka of borkaCatalog) {
    for (const imgUrl of borka.images) {
      const fileName = path.basename(imgUrl);
      const filePath = path.resolve(__dirname, '../../uploads/media', fileName);
      let size = 150000;
      if (fs.existsSync(filePath)) {
        size = fs.statSync(filePath).size;
      }
      const existingMedia = await prisma.mediaAsset.findUnique({ where: { url: imgUrl } });
      if (!existingMedia) {
        await prisma.mediaAsset.create({
          data: {
            fileName,
            url: imgUrl,
            mimeType: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
            size,
            altText: `${borka.name} - ${fileName}`
          }
        });
      }
    }
  }
  console.log('✅ All media assets registered in database!\n');

  // 2. Iterate and create all 10 Products, Variants, Builder Pages, Store Pages, and Templates
  for (let i = 0; i < borkaCatalog.length; i++) {
    const item = borkaCatalog[i];
    const index = i + 1;
    console.log(`----------------------------------------------------------------`);
    console.log(`📦 [${index}/10] Processing "${item.name}" (Slug: ${item.slug})`);
    console.log(`----------------------------------------------------------------`);

    // A. Upsert Product
    const discountPercent = Math.round(((item.regularPrice - item.salePrice) / item.regularPrice) * 100);
    const productPayload = {
      name: item.name,
      sku: item.sku,
      regularPrice: item.regularPrice,
      salePrice: item.salePrice,
      buyPrice: item.buyPrice,
      stockQuantity: 200,
      category: item.category,
      image: item.images[0],
      gallery: JSON.stringify(item.images),
      description: item.description,
      status: 'ACTIVE',
      productType: 'VARIABLE',
      attributes: JSON.stringify([
        { name: 'Size', values: item.sizes },
        { name: 'Color', values: item.colors.map(c => c.name) }
      ])
    };

    let product = await prisma.product.findUnique({ where: { sku: item.sku } });
    if (product) {
      product = await prisma.product.update({
        where: { id: product.id },
        data: productPayload
      });
      console.log(`   Updated Product: ${product.name} (ID: ${product.id})`);
    } else {
      product = await prisma.product.create({
        data: productPayload
      });
      console.log(`   Created Product: ${product.name} (ID: ${product.id})`);
    }

    // B. Upsert Product Variants (16 variants: 4 colors x 4 sizes)
    for (const color of item.colors) {
      for (const size of item.sizes) {
        const colorSlug = color.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const varSku = `${item.sku}-${colorSlug}-${size}`;
        const existingVar = await prisma.productVariant.findUnique({ where: { sku: varSku } });
        const variantPayload = {
          productId: product.id,
          sku: varSku,
          name: `${color.name} - সাইজ ${size}`,
          regularPrice: item.regularPrice,
          salePrice: item.salePrice,
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
    console.log(`   Created/Updated 16 Product Variants for ${item.name}`);

    // C. Construct PageBuilder AST Document
    const initialTotal = item.salePrice + insideDhaka;

    const doc: PageDocument = {
      schemaVersion: 1,
      title: `${item.theme.headline}`,
      slug: item.slug,
      seo: {
        title: `${item.name} মাত্র ${item.salePrice} টাকা | বিশেষ অফার`,
        description: `${item.description} সারা দেশে ক্যাশ অন ডেলিভারি এবং ৩ দিনের রিপ্লেসমেন্ট গ্যারান্টি।`,
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
        'brand-primary': item.theme.primary,
        'brand-secondary': item.theme.secondary,
        'text-primary': '#1e293b',
        'spacing-md': '24px'
      },
      classes: {},
      components: {},
      rootNodes: [
        // 1. TOP ANNOUNCEMENT NOTICE BAR
        createNode(
          'section',
          'Notice Bar',
          { tag: 'section' },
          {
            'background': `linear-gradient(135deg, ${item.theme.primary} 0%, #0f172a 100%)`,
            'color': '#ffffff',
            'padding-top': '10px',
            'padding-bottom': '10px',
            'text-align': 'center',
            'font-size': '14px',
            'font-weight': '700',
            'letter-spacing': '0.5px'
          },
          [
            createNode(
              'container',
              'Notice Container',
              { tag: 'div' },
              { 'max-width': '900px', 'margin-left': 'auto', 'margin-right': 'auto', 'padding-left': '16px', 'padding-right': '16px' },
              [
                createNode('text', 'Notice Text', { text: item.theme.bannerNotice }, { 'color': '#ffffff', 'font-size': '14px' })
              ]
            )
          ],
          { 'mobile': { 'font-size': '12px', 'padding-top': '8px', 'padding-bottom': '8px' } }
        ),

        // 2. LOGO HEADER BANNER
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
              'container',
              'Logo Wrapper',
              { tag: 'div' },
              {
                'max-width': '140px',
                'margin-left': 'auto',
                'margin-right': 'auto',
                'display': 'block',
                'text-align': 'center'
              },
              [
                createNode(
                  'image',
                  'Top Banner Graphic',
                  {
                    src: '/uploads/media/borka-banner.png',
                    alt: `${item.name} অফার`
                  },
                  {
                    'width': '100%',
                    'max-width': '140px',
                    'height': 'auto',
                    'display': 'block'
                  },
                  [],
                  {
                    'mobile': { 'max-width': '110px' }
                  }
                )
              ],
              {
                'mobile': { 'max-width': '110px' }
              }
            )
          ],
          {
            'mobile': { 'padding-top': '12px', 'padding-bottom': '8px' }
          }
        ),

        // 3. MAIN PROMOTIONAL HEADLINE
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
                    text: item.theme.headline,
                    level: 'h2',
                    size: 'large',
                    align: 'center'
                  },
                  {
                    'color': item.theme.primary,
                    'font-size': '30px',
                    'font-weight': '900',
                    'line-height': '1.35',
                    'margin': '0 0 12px 0',
                    'text-align': 'center'
                  },
                  [],
                  {
                    'mobile': { 'font-size': '22px' }
                  }
                ),
                createNode(
                  'paragraph',
                  'Subheadline Text',
                  {
                    text: item.theme.subheadline
                  },
                  {
                    'color': '#475569',
                    'font-size': '17px',
                    'font-weight': '600',
                    'line-height': '1.6',
                    'max-width': '780px',
                    'margin-left': 'auto',
                    'margin-right': 'auto'
                  },
                  [],
                  {
                    'mobile': { 'font-size': '15px' }
                  }
                )
              ]
            )
          ]
        ),

        // 4. YOUTUBE VIDEO SECTION + FAST ORDER BUTTON
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
                    src: item.videoUrl,
                    autoplay: true,
                    loop: true,
                    controls: true
                  },
                  {
                    'border-radius': '16px',
                    'overflow': 'hidden',
                    'box-shadow': '0 15px 35px rgba(0, 0, 0, 0.12)',
                    'margin-bottom': '24px'
                  }
                ),
                createNode(
                  'button',
                  'Video Order CTA Button',
                  {
                    text: 'অর্ডার করতে চাই',
                    href: '#order',
                    type: 'danger',
                    size: 'large',
                    icon: 'shopping-cart'
                  },
                  {
                    'background': `linear-gradient(135deg, ${item.theme.primary} 0%, #0f172a 100%)`,
                    'color': '#ffffff',
                    'padding': '16px 44px',
                    'font-size': '20px',
                    'font-weight': '800',
                    'border-radius': '999px',
                    'box-shadow': '0 10px 25px rgba(0, 0, 0, 0.2)',
                    'text-decoration': 'none',
                    'display': 'inline-block'
                  }
                )
              ]
            )
          ]
        ),

        // 5. ANIMATED HEADLINE PRICE SECTION
        createNode(
          'section',
          'Animated Price Section',
          { tag: 'section' },
          {
            'padding-top': '40px',
            'padding-bottom': '40px',
            'background': item.theme.bgGradient,
            'text-align': 'center',
            'border-top': '1px solid #e2e8f0',
            'border-bottom': '1px solid #e2e8f0'
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
                    'color': item.theme.primary,
                    'font-size': '28px',
                    'font-weight': '900',
                    'margin-bottom': '20px',
                    'text-align': 'center'
                  }
                ),

                // Animated Regular Price
                createNode(
                  'animated-headline',
                  'Regular Price Animated Cross',
                  {
                    beforeText: 'রেগুলার মূল্য',
                    highlightedText: `${item.regularPrice} ৳`,
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

                // Animated Offer Price
                createNode(
                  'animated-headline',
                  'Offer Price Animated Zigzag',
                  {
                    beforeText: 'অফার মূল্য মাত্র',
                    highlightedText: `${item.salePrice} ৳`,
                    afterText: '',
                    marker: 'underline_zigzag',
                    markerColor: item.theme.secondary,
                    tag: 'h3'
                  },
                  {
                    'font-size': '34px',
                    'font-weight': '900',
                    'color': item.theme.secondary,
                    'margin-bottom': '24px'
                  },
                  [],
                  {
                    'mobile': { 'font-size': '26px' }
                  }
                ),

                // Offer Price Badge
                createNode(
                  'offer-price',
                  'Animated Oval Offer Box',
                  {
                    regularLabel: 'রেগুলার মূল্য',
                    regularPrice: `৳${item.regularPrice.toLocaleString('en-US')}`,
                    offerLabel: 'আজকের স্পেশাল অফার মূল্য',
                    offerPrice: `৳${item.salePrice.toLocaleString('en-US')}`,
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
                    href: '#order',
                    type: 'danger',
                    size: 'large',
                    icon: 'shopping-cart'
                  },
                  {
                    'background': `linear-gradient(135deg, ${item.theme.primary} 0%, #0f172a 100%)`,
                    'color': '#ffffff',
                    'padding': '16px 40px',
                    'font-size': '19px',
                    'font-weight': '800',
                    'border-radius': '999px',
                    'box-shadow': '0 12px 28px rgba(0, 0, 0, 0.25)',
                    'text-decoration': 'none',
                    'display': 'inline-block'
                  }
                )
              ]
            )
          ]
        ),

        // 6. PRODUCT IMAGE CAROUSEL
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
                    text: `আমাদের অরিজিনাল ${item.name}-এর রিয়েল ছবি`,
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
                    images: JSON.stringify(item.images),
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

        // 7. COUNTDOWN URGENCY TIMER
        createNode(
          'section',
          'Countdown Section',
          { tag: 'section' },
          {
            'padding-top': '40px',
            'padding-bottom': '40px',
            'background': '#0f172a',
            'text-align': 'center',
            'color': '#ffffff'
          },
          [
            createNode(
              'container',
              'Countdown Container',
              { tag: 'div' },
              { 'max-width': '700px', 'margin-left': 'auto', 'margin-right': 'auto', 'padding-left': '20px', 'padding-right': '20px' },
              [
                createNode(
                  'heading',
                  'Countdown Title',
                  { text: '⏳ অফারটি শেষ হতে আর মাত্র বাকি ⏳', level: 'h3', size: 'medium', align: 'center' },
                  { 'color': '#f8fafc', 'font-size': '22px', 'font-weight': '800', 'margin-bottom': '20px' }
                ),
                createNode(
                  'countdown',
                  'Urgency Ticker',
                  {
                    endAt: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
                    layout: 'block'
                  },
                  { 'margin-bottom': '24px' }
                ),
                createNode(
                  'button',
                  'Countdown Order Button',
                  {
                    text: 'দেরি না করে এখনই অর্ডার করুন',
                    href: '#order',
                    type: 'danger',
                    size: 'large'
                  },
                  {
                    'background': `linear-gradient(135deg, ${item.theme.primary} 0%, #be123c 100%)`,
                    'color': '#ffffff',
                    'padding': '14px 36px',
                    'font-size': '18px',
                    'font-weight': '700',
                    'border-radius': '999px',
                    'text-decoration': 'none'
                  }
                )
              ]
            )
          ]
        ),

        // 8. BENEFITS & FEATURES LIST
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
                    text: 'আমাদের এই বোরখাটি কেন সবার সেরা?',
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
                    items: item.features.map(f => `✓ ${f}`).join('\n'),
                    layout: 'vertical',
                    iconColor: item.theme.secondary
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

        // 9. SIZE MEASUREMENT TABLE SECTION
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
                    text: 'সাইজ ও মেজারমেন্ট চার্ট (Size Chart)',
                    level: 'h2',
                    size: 'large',
                    align: 'center'
                  },
                  {
                    'color': '#0f172a',
                    'font-size': '28px',
                    'font-weight': '800',
                    'margin-bottom': '20px',
                    'text-align': 'center'
                  }
                ),
                createNode(
                  'icon-list',
                  'Size List Details',
                  {
                    items: item.sizeChart.map(row => `[icon:ruler] সাইজ ${row.size}: বডি ${row.chest} | ঝুল/লম্বা ${row.length} | হাতা ${row.sleeve}`).join('\n'),
                    layout: 'vertical',
                    iconColor: item.theme.primary
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

        // 10. AUTHENTIC CUSTOMER REVIEWS
        createNode(
          'section',
          'Reviews Section',
          { tag: 'section' },
          {
            'padding-top': '60px',
            'padding-bottom': '60px',
            'background': '#f1f5f9'
          },
          [
            createNode(
              'container',
              'Reviews Container',
              { tag: 'div' },
              {
                'max-width': '850px',
                'margin-left': 'auto',
                'margin-right': 'auto',
                'padding-left': '20px',
                'padding-right': '20px'
              },
              [
                createNode(
                  'heading',
                  'Reviews Title',
                  {
                    text: 'সম্মানিত ক্রেতাদের বাস্তব মতামত (Customer Reviews)',
                    level: 'h2',
                    size: 'large',
                    align: 'center'
                  },
                  {
                    'color': '#0f172a',
                    'font-size': '28px',
                    'font-weight': '800',
                    'margin-bottom': '36px',
                    'text-align': 'center'
                  }
                ),
                createNode(
                  'flex',
                  'Reviews Grid',
                  { direction: 'column', gap: '20px' },
                  { 'display': 'flex', 'flex-direction': 'column', 'gap': '20px' },
                  item.reviews.map(rev => (
                    createNode(
                      'container',
                      `Review ${rev.name}`,
                      { tag: 'div' },
                      {
                        'background': '#ffffff',
                        'padding': '24px 28px',
                        'border-radius': '16px',
                        'border': '1px solid #e2e8f0',
                        'box-shadow': '0 4px 12px rgba(0,0,0,0.03)'
                      },
                      [
                        createNode(
                          'flex',
                          'Review Top Row',
                          { direction: 'row', justify: 'space-between', align: 'center' },
                          { 'display': 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '10px' },
                          [
                            createNode('heading', 'Reviewer Name', { text: `⭐ ⭐ ⭐ ⭐ ⭐ ${rev.name}`, level: 'h4' }, { 'font-size': '16px', 'font-weight': '700', 'color': '#0f172a', 'margin': '0' }),
                            createNode('text', 'Review Date', { text: rev.date }, { 'font-size': '13px', 'color': '#64748b' })
                          ]
                        ),
                        createNode('paragraph', 'Review Content', { text: `"${rev.text}"` }, { 'font-size': '15px', 'color': '#334155', 'line-height': '1.6', 'margin': '0 0 8px 0' }),
                        createNode('text', 'Review City', { text: `📍 ${rev.city} (ভেরিফাইড পার্চেজ)`, type: 'muted' }, { 'font-size': '13px', 'color': '#059669', 'font-weight': '600' })
                      ]
                    )
                  ))
                )
              ]
            )
          ]
        ),

        // 11. TRUST & GUARANTEE BADGES
        createNode(
          'section',
          'Guarantees Section',
          { tag: 'section' },
          {
            'padding-top': '40px',
            'padding-bottom': '40px',
            'background': '#ffffff'
          },
          [
            createNode(
              'container',
              'Guarantees Container',
              { tag: 'div' },
              { 'max-width': '850px', 'margin-left': 'auto', 'margin-right': 'auto', 'padding-left': '20px', 'padding-right': '20px' },
              [
                createNode(
                  'icon-list',
                  'Guarantees List',
                  {
                    items: [
                      '📦 সম্পূর্ণ ক্যাশ অন ডেলিভারি (কোনো অগ্রিম টাকা দিতে হবে না)',
                      '🔍 কুরিয়ারের সামনে পার্সেল খুলে চেক করে টাকা পরিশোধের সুযোগ',
                      '🔄 ৩ দিনের ফ্রি সাইজ রিপ্লেসমেন্ট গ্যারান্টি',
                      '🚚 ২৪ থেকে ৪৮ ঘণ্টার মধ্যে সারা দেশে দ্রুততম হোম ডেলিভারি'
                    ].join('\n'),
                    layout: 'vertical',
                    iconColor: '#059669'
                  },
                  {
                    'background': '#f0fdf4',
                    'padding': '28px 36px',
                    'border-radius': '16px',
                    'border': '1.5px solid #86efac',
                    'font-size': '16px',
                    'font-weight': '700',
                    'color': '#065f46',
                    'line-height': '1.8'
                  },
                  [],
                  {
                    'mobile': { 'padding': '20px 16px', 'font-size': '14px' }
                  }
                )
              ]
            )
          ]
        ),

        // 12. HELPLINE & WHATSAPP
        createNode(
          'section',
          'Helpline Section',
          { tag: 'section' },
          {
            'padding-top': '40px',
            'padding-bottom': '40px',
            'background': `linear-gradient(135deg, ${item.theme.primary} 0%, #0f172a 100%)`,
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
                    text: 'যেকোনো প্রয়োজনে সরাসরি কল অথবা হোয়াটসঅ্যাপ করুন',
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
                        'color': item.theme.primary,
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

        // 13. STICKY FLOATING CTA BUTTON (Mobile & Desktop)
        createNode(
          'section',
          'Sticky CTA Bar',
          { tag: 'div' },
          {
            'position': 'fixed',
            'bottom': '20px',
            'left': '50%',
            'transform': 'translateX(-50%)',
            'z-index': '9999',
            'width': 'auto',
            'min-width': '280px',
            'text-align': 'center'
          },
          [
            createNode(
              'button',
              'Floating Order Button',
              {
                text: `🛒 এখনই অর্ডার করুন - মাত্র ৳${item.salePrice}`,
                href: '#order',
                type: 'danger',
                size: 'large'
              },
              {
                'background': `linear-gradient(135deg, ${item.theme.primary} 0%, #0f172a 100%)`,
                'color': '#ffffff',
                'padding': '16px 36px',
                'font-size': '18px',
                'font-weight': '800',
                'border-radius': '999px',
                'box-shadow': '0 12px 35px rgba(0, 0, 0, 0.35)',
                'text-decoration': 'none',
                'display': 'inline-block',
                'border': '2px solid rgba(255, 255, 255, 0.4)'
              }
            )
          ]
        )
      ]
    };

    const validated = parseDocument(doc);
    const rendered = renderHtml(validated);

    // D. Upsert BuilderPage
    const existingPage = await prisma.builderPage.findUnique({ where: { slug: item.slug } });
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
      console.log(`   Updated BuilderPage (ID: ${savedPage.id})`);
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
      console.log(`   Created BuilderPage (ID: ${savedPage.id})`);
    }

    // E. Upsert StorePage with CHECKOUT Block
    const storePageSlug = `flow-${item.slug}`;
    const storePageBlocks = [
      {
        id: randomUUID(),
        type: 'HERO',
        eyebrow: item.category,
        heading: item.theme.headline,
        text: item.description,
        image: product.image,
        buttonText: 'এখনই অর্ডার করুন'
      },
      {
        id: 'checkout',
        type: 'CHECKOUT',
        heading: 'অর্ডার করতে নিচের ফর্মটি সঠিক ভাবে পুরন করুন',
        productIds: [product.id],
        selection: 'SINGLE',
        minProducts: 1,
        maxProducts: 1,
        couponEnabled: false,
        paymentMethods: ['COD'],
        buttonText: 'অর্ডার কনফার্ম করুন',
        billingHeading: 'আপনার নাম ও ঠিকানা দিন',
        productsHeading: 'নির্বাচিত পণ্য ও সাইজ',
        nameLabel: 'আপনার নাম লিখুন',
        namePlaceholder: 'সম্পূর্ণ নাম লিখুন',
        phoneLabel: 'আপনার মোবাইল নাম্বার লিখুন',
        phonePlaceholder: '১১ ডিজিটের মোবাইল নাম্বার লিখুন',
        addressLabel: 'আপনার সম্পূর্ণ ডেলিভারি ঠিকানা',
        addressPlaceholder: 'বাসা/রোড, এলাকা, থানা ও জেলা উল্লেখ করুন'
      }
    ];

    const storePageRecord = {
      title: item.theme.headline,
      slug: storePageSlug,
      metaTitle: `${item.name} মাত্র ${item.salePrice} টাকা | বিশেষ অফার`,
      metaDescription: item.description,
      status: 'PUBLISHED',
      isActive: true,
      blocks: JSON.stringify(storePageBlocks)
    };

    let savedStorePage = await prisma.storePage.findUnique({ where: { slug: storePageSlug } });
    if (savedStorePage) {
      savedStorePage = await prisma.storePage.update({
        where: { id: savedStorePage.id },
        data: storePageRecord
      });
      console.log(`   Updated StorePage: ${storePageSlug} (ID: ${savedStorePage.id})`);
    } else {
      savedStorePage = await prisma.storePage.create({
        data: storePageRecord
      });
      console.log(`   Created StorePage: ${storePageSlug} (ID: ${savedStorePage.id})`);
    }

    // F. Link BuilderLanding
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
      console.log(`   Updated BuilderLanding Link: StorePage(${savedStorePage.id}) <-> BuilderPage(${savedPage.id})`);
    } else {
      await prisma.builderLanding.create({
        data: {
          storePageId: savedStorePage.id,
          builderPageId: savedPage.id,
          createdBy: userId
        }
      });
      console.log(`   Created BuilderLanding Link: StorePage(${savedStorePage.id}) <-> BuilderPage(${savedPage.id})`);
    }

    // G. Ensure Paired Thank You Page
    await ensureLandingThankYou(savedPage.id, { id: userId, name: item.name });
    console.log(`   Ensured paired Thank You Page: /${item.slug}/thank-you`);

    // H. Save into BuilderTemplate
    const templateName = `${item.name} Sales Funnel Template`;
    const existingTemplate = await prisma.builderTemplate.findFirst({ where: { name: templateName } });
    if (!existingTemplate) {
      await prisma.builderTemplate.create({
        data: {
          name: templateName,
          document: JSON.stringify(validated),
          createdBy: userId
        }
      });
      console.log(`   Created Template in Library: "${templateName}"`);
    } else {
      await prisma.builderTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          document: JSON.stringify(validated)
        }
      });
      console.log(`   Updated Template in Library: "${templateName}"`);
    }

    console.log(`   👉 Storefront URL: http://localhost:3001/${item.slug}`);
    console.log(`   👉 Thank You URL: http://localhost:3001/${item.slug}/thank-you\n`);
  }

  console.log('================================================================');
  console.log('🎉 ALL 10 BORKA LANDING PAGES SUCCESSFULLY CREATED & PUBLISHED!');
  console.log('================================================================\n');
}

main()
  .catch(err => {
    console.error('Fatal error seeding Borka landing pages:', err);
  })
  .finally(() => prisma.$disconnect());
