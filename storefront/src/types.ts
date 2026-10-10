export type Variant = {
  id: string; name: string; sku: string; color?: string; size?: string;
  attributes: Record<string, string>; regularPrice: number; salePrice: number;
  stockQuantity: number; image?: string; inStock: boolean;
};

export type Product = {
  id: string; name: string; slug?: string; sku: string; description?: string; category: string;
  categoryTrail?: Array<{ name: string; slug: string }>;
  gallery: string[]; metaTitle?: string; metaDescription?: string;
  productType: 'SIMPLE' | 'VARIABLE'; attributes: Array<{ attributeId?: string; name: string; type?: string; displayStyle?: string; optionColors?: Record<string,string>; options?: string[]; values?: string[]; visible?: boolean; variation?: boolean }>;
  regularPrice: number; salePrice: number; stockQuantity: number; image?: string;
  inStock: boolean; variants: Variant[];
};

export type CartItem = {
  key: string; productId: string; variantId?: string; name: string; variantName?: string;
  image?: string; unitPrice: number; quantity: number; stockQuantity: number;
};

export type OrderResult = {
  orderNumber: string; status: string; subtotal: number; deliveryCharge: number;
  grandTotal: number; paymentMethod: string;
  customerName?: string; customerPhone?: string; deliveryAddress?: string;
  customer?: { name?: string; phone?: string; email?: string; address?: string };
  items?: Array<{ productId?: string | null; productName?: string; name?: string; image?: string | null; quantity?: number; unitPrice?: number; price?: number }>;
};

export type DeliveryArea = 'OUTSIDE_DHAKA' | 'SUB_AREA' | 'DHAKA_CITY';

export type CustomerAccount = {
  id: string; name: string; email: string; phone: string; alternativePhone?: string;
  address?: string; district?: string; city?: string; zone?: string; area?: string;
  totalOrders: number; completedOrders: number; totalSpent: number; createdAt: string;
};

export type CustomerOrder = {
  id: string; orderNumber: string; status: string; paymentStatus: string;
  subtotal: number; deliveryCharge: number; grandTotal: number; createdAt: string;
  courierTrackingCode?: string;
  items: Array<{ id: string; productName: string; variantName?: string; quantity: number; unitPrice: number; totalPrice: number }>;
};

export type StorefrontSettings = {
  onlinePaymentEnabled?: boolean;
  storeName: string; announcement: string; heroEyebrow: string; heroTitle: string;
  heroText: string; phone: string; insideDhakaCharge: number; subAreaCharge: number; outsideDhakaCharge: number;
  featuredCategories: string[]; heroImages: string[]; heroButtonLabel: string; heroButtonUrl: string;
  aboutTitle: string; aboutText: string; footerText: string;
  themeConfig: ThemeConfig;
};

export type StorePageBlock = { id: string; type: 'TEXT' | 'IMAGE' | 'BUTTON' | 'HTML'; heading?: string; text?: string; url?: string; alt?: string; label?: string; html?: string };
export type StorePage = { id: string; title: string; slug: string; eyebrow: string; excerpt: string; coverImage: string; blocks: StorePageBlock[]; metaTitle: string; metaDescription: string; status: 'PUBLISHED'; isActive: boolean; aliases: string[] };

export type ThemeConfig = {
  primaryColor: string; accentColor: string; backgroundColor: string; textColor: string; mutedColor: string;
  fontFamily: 'Manrope' | 'Inter' | 'Plus Jakarta Sans'; buttonRadius: 'square' | 'soft' | 'round'; cardRadius: 'square' | 'soft' | 'round';
  headerMode: 'STICKY' | 'STATIC'; productDensity: 'COMFORTABLE' | 'COMPACT'; showAnnouncement: boolean; showTrustBar: boolean; showBestSellers: boolean; showAbout: boolean;
  variationStyle?: 'SOFT' | 'CIRCLE' | 'SQUARE';
  maintenanceMode?: boolean;
  showColorName?: boolean;
  buyNowText?: string;
  checkoutFields?: CheckoutField[];
  headerMenu?: Array<{ label: string; url: string }>;
  footerMenus?: Array<{ heading: string; items: Array<{ label: string; url: string }> }>;
  showcase?: Array<{ id: string; eyebrow: string; title: string; source: 'NEW' | 'BEST' | 'CATEGORY'; category?: string; limit: number; enabled: boolean }>;
  analytics?: {
    googleAnalyticsId: string; metaPixelId: string; metaCapiEnabled?: boolean;
    customEvents?: Array<{ name: string; selector: string; ga4Event?: string; metaEvent?: string; metaEventType?: 'custom' | 'standard' }>;
  };
};

export type CheckoutField = { key: string; label: string; type: 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'select'; enabled: boolean; required: boolean; placeholder?: string; options?: string[]; custom?: boolean };
