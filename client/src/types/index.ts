export interface User {
  builderAccess?: boolean;
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'SUPER_ADMIN' | 'OPERATIONS_MANAGER' | 'ACCOUNTANT' | 'INVENTORY_MANAGER' | 'CALL_CENTER_AGENT' | 'DISPATCHER';
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  avatar?: string;
  is2FAEnabled?: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  color?: string;
  size?: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  unitBuyPrice: number;
  totalPrice: number;
  totalBuyPrice: number;
  variant?: ProductVariant;
  product?: Product;
}

export interface Order {
  id: string;
  orderNumber: string;
  wooOrderId?: number;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  district?: string;
  city?: string;
  zone?: string;
  area?: string;
  status: 'PENDING' | 'CONFIRMED' | 'PACKAGING' | 'HANDED_OVER' | 'IN_TRANSIT' | 'DELIVERED' | 'PARTIAL_DELIVERED' | 'CANCELLED' | 'RETURNED' | 'HOLD' | 'FAKE_TRASH';
  priority: 'NORMAL' | 'URGENT';
  paymentMethod: string;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED';
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  grandTotal: number;
  advancePaid: number;
  codAmount: number;
  cogsCost: number;
  courierName?: 'STEADFAST' | 'PATHAO' | 'REDX' | 'PAPERFLY' | 'MANUAL';
  courierTrackingCode?: string;
  courierTrackingLink?: string;
  courierConsignmentId?: string;
  courierStoreId?: string;
  courierStatus?: string;
  courierCharge: number;
  courierReturnCharge: number;
  courierCodReceived: number;
  courierSettlementStatus: 'PENDING' | 'RECONCILED' | 'DISCREPANCY';
  internalNote?: string;
  customerNote?: string;
  checkoutDetails?: string | null;
  isFraudSuspect: boolean;
  isDuplicate: boolean;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  customer?: Customer;
  assignedTo?: { id: string; name: string; phone?: string };
  warehouse?: { id: string; name: string };
  messageLogs?: Array<{ id: string; status?: string; channel?: string; createdAt: string }>;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  address?: string;
  district?: string;
  city?: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  totalSpent: number;
  successRate: number;
  riskScore: number;
  isBlacklisted: boolean;
  tags?: string;
  notes?: string;
  orders?: Order[];
  stats?: {
    totalOrders: number;
    completedOrders: number;
    returnedOrders: number;
    cancelledOrders: number;
    totalSpent: number;
    successRate: number;
  };
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  color?: string;
  size?: string;
  attributes?: string;
  buyPrice: number;
  regularPrice: number;
  salePrice: number;
  stockQuantity: number;
  minStockThreshold?: number;
  image?: string;
  gallery?: string;
  metaTitle?: string;
  metaDescription?: string;
  status?: 'ACTIVE' | 'OUT_OF_STOCK' | 'ARCHIVED';
}

export interface Product {
  slug?: string | null;
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  category?: string;
  buyPrice: number;
  regularPrice: number;
  salePrice: number;
  stockQuantity: number;
  minStockThreshold: number;
  image?: string;
  gallery?: string;
  metaTitle?: string;
  metaDescription?: string;
  status: string;
  productType?: 'SIMPLE' | 'VARIABLE';
  attributes?: string;
  wooProductId?: number;
  isWooSynced?: boolean;
  variants: ProductVariant[];
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchased: number;
  totalPaid: number;
  balanceDue: number;
}

export interface PurchaseOrder {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplier: Supplier;
  warehouse?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  totalAmount: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  purchaseDate: string;
  note?: string;
  createdAt?: string;
  items: {
    id: string;
    productId?: string | null;
    variantId?: string | null;
    productName?: string | null;
    productSku?: string | null;
    variantName?: string | null;
    variantSku?: string | null;
    product?: Product | null;
    variant?: ProductVariant | null;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
}

export interface Account {
  id: string;
  name: string;
  type: string;
  accountNumber?: string;
  bankName?: string;
  balance: number;
  isDefault: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  isFixed: boolean;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  recipient?: string;
  note?: string;
  category: ExpenseCategory;
  account: Account;
}

export interface AdCost {
  id: string;
  platform: 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | 'INSTAGRAM';
  campaignName: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  bdtAmount: number;
  date: string;
  impressions?: number;
  clicks?: number;
  ordersGenerated?: number;
  cpa?: number;
  notes?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  eventTrigger: string;
  channel: string;
  body: string;
  isActive: boolean;
}

export interface CourierConfig {
  id: string;
  provider: 'STEADFAST' | 'PATHAO' | 'REDX' | 'PAPERFLY';
  apiKey?: string;
  secretKey?: string;
  clientId?: string;
  clientSecret?: string;
  storeId?: string;
  baseUrl?: string;
  isEnabled: boolean;
  isDefault: boolean;
}
