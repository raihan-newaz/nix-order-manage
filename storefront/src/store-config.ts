import type { StorefrontSettings } from './types';

export const publicSupportPhone = (phone: string | null | undefined) =>
  /^(?:\+?88)?01[3-9]\d{8}$/.test(phone || '') ? phone! : '';

export const store = {
  name: 'NIX',
  tagline: 'Everyday, refined.',
  phone: '01XXXXXXXXX',
  announcement: 'Cash on delivery across Bangladesh · Easy exchange',
  shipping: { dhaka: 60, subArea: 130, outsideDhaka: 150 },
};

export const defaultStorefrontSettings: StorefrontSettings = {
  storeName: store.name, announcement: store.announcement, heroEyebrow: 'THE NEW EDIT',
  heroTitle: 'Everyday style, made effortless.',
  heroText: 'Modern silhouettes, versatile essentials and considered details—made to live in.',
  phone: store.phone, insideDhakaCharge: store.shipping.dhaka,
  subAreaCharge: store.shipping.subArea,
  outsideDhakaCharge: store.shipping.outsideDhaka, featuredCategories: [], heroImages: [],
  heroButtonLabel: 'Shop now', heroButtonUrl: '/shop', aboutTitle: 'Less noise. Better choices.',
  aboutText: 'Our edit focuses on easy-to-style pieces, clear product options and a checkout that takes less than a minute.',
  footerText: 'Thoughtful fashion for real life.',
  themeConfig: { primaryColor: '#171815', accentColor: '#d8ff55', backgroundColor: '#f7f6f2', textColor: '#171815', mutedColor: '#707269', fontFamily: 'Manrope', buttonRadius: 'square', cardRadius: 'square', headerMode: 'STICKY', productDensity: 'COMFORTABLE', showAnnouncement: true, showTrustBar: true, showBestSellers: true, showAbout: true, maintenanceMode: false, variationStyle: 'SOFT', showColorName: true, buyNowText: 'Buy now', checkoutFields: [{ key: 'name', label: 'Full name', type: 'text', enabled: true, required: true }, { key: 'phone', label: 'Mobile number', type: 'tel', enabled: true, required: true }, { key: 'email', label: 'Email address', type: 'email', enabled: true, required: false }, { key: 'address', label: 'Full delivery address', type: 'textarea', enabled: true, required: true }, { key: 'district', label: 'District', type: 'text', enabled: true, required: true }, { key: 'city', label: 'City / area', type: 'text', enabled: true, required: false }, { key: 'note', label: 'Order note', type: 'text', enabled: true, required: false }], analytics: { googleAnalyticsId: '', metaPixelId: '' } },
};
