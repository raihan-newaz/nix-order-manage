import {
  Activity,
  BarChart3,
  Boxes,
  PackageSearch,
  FolderTree,
  Images,
  Calculator,
  ReceiptText,
  LayoutDashboard,
  MessageSquareText,
  Palette,
  FileText,
  Store,
  Tags,
  PackageCheck,
  Settings2,
  ShoppingBag,
  Truck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { User } from '../../types';

export interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
  roles?: User['role'][];
  children?: Array<{ label: string; path: string; roles?: User['role'][] }>;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

// Keep access rules alongside the navigation contract. The backend remains the
// authority for every mutation; this only controls product discoverability.
export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Command center',
    items: [
      { label: 'Overview', path: '/', icon: LayoutDashboard, description: 'Business health and action center' },
      { label: 'Live orders', path: '/orders', icon: ShoppingBag, description: 'Process, assign, and dispatch orders' },
      { label: 'Courier & COD', path: '/courier-hub', icon: Truck, description: 'Delivery operations and reconciliation', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'ACCOUNTANT'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Products', path: '/products', icon: PackageSearch, description: 'Catalogue, pricing, variations, media, and SEO' },
      { label: 'Inventory', path: '/inventory', icon: Boxes, description: 'Stock levels, alerts, and adjustments' },
      { label: 'Categories', path: '/categories', icon: FolderTree, description: 'Product taxonomy and storefront collections' },
      { label: 'Attributes', path: '/attributes', icon: Tags, description: 'Reusable product options and variation terms' },
      { label: 'Media Gallery', path: '/media', icon: Images, description: 'Upload and reuse storefront images' },
      { label: 'Purchases', path: '/purchases', icon: PackageCheck, description: 'Suppliers and purchase orders', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT'] },
      { label: 'Customers', path: '/crm', icon: UsersRound, description: 'Customer intelligence and risk' },
    ],
  },
  {
    label: 'Growth & finance',
    items: [
      { label: 'Finance', path: '/accounting', icon: Calculator, description: 'Profit, purchases, expenses, and cash accounts', roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'OPERATIONS_MANAGER'] },
      { label: 'Expenses', path: '/expenses', icon: ReceiptText, description: 'Record, categorize, and review operating costs', roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'OPERATIONS_MANAGER'] },
      { label: 'Analytics', path: '/analytics', icon: BarChart3, description: 'Sales, profit, customers, costs, and purchase trends', roles: ['SUPER_ADMIN', 'ACCOUNTANT', 'OPERATIONS_MANAGER'] },
      { label: 'Messages', path: '/messaging', icon: MessageSquareText, description: 'WhatsApp, SMS, and templates', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CALL_CENTER_AGENT'] },
      { label: 'Storefront', path: '/storefront', icon: Store, description: 'Shop content, merchandising, and delivery rates', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
      { label: 'Tracking & CAPI', path: '/tracking', icon: Activity, description: 'Google Analytics, Meta Pixel, server-side CAPI & custom events', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
      { label: 'Pages', path: '/pages', icon: FileText, description: 'Manage landing, content, and visual pages', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
      { label: 'Theme Customizer', path: '/theme-customizer', icon: Palette, description: 'Colors, type, layout, and homepage sections', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
      { label: 'Settings', path: '/settings', icon: Settings2, description: 'Team and integrations', children: [
        { label: 'WooCommerce', path: '/settings/woocommerce', roles: ['SUPER_ADMIN'] },
        { label: 'Couriers', path: '/settings/couriers', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
        { label: 'Payments', path: '/settings/payments', roles: ['SUPER_ADMIN'] },
        { label: 'Staff Users', path: '/settings/users', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
        { label: 'Audit Log', path: '/settings/audit', roles: ['SUPER_ADMIN', 'OPERATIONS_MANAGER'] },
        { label: 'Security', path: '/settings/security' },
      ] },
    ],
  },
];

export const allNavigationItems = navigationGroups.flatMap((group) => group.items);

export const canSeeNavigationItem = (item: NavigationItem, role?: User['role'], builderAccess?: boolean) =>
  item.path === '/builder' && builderAccess !== undefined ? builderAccess : !item.roles || (!!role && item.roles.includes(role));

export const canAccessPath = (pathname: string, role?: User['role'], builderAccess?: boolean) => {
  if (pathname === '/builder' || pathname.startsWith('/landing-pages')) return Boolean(builderAccess) && (role === 'SUPER_ADMIN' || role === 'OPERATIONS_MANAGER');
  const item = allNavigationItems.find((candidate) => pathname === candidate.path || (candidate.path !== '/' && pathname.startsWith(`${candidate.path}/`)));
  if (!item || !canSeeNavigationItem(item, role, builderAccess)) return false;
  const child = item.children?.find((candidate) => candidate.path === pathname);
  if (item.children && pathname !== item.path && !child) return false;
  return !child?.roles || (!!role && child.roles.includes(role));
};

export const pageTitleForPath = (pathname: string) =>
  pathname === '/landing-pages/new' ? 'Create landing page' :
  pathname.startsWith('/landing-pages/') ? 'Edit landing page' :
  pathname === '/pages/new' ? 'Create page' :
  pathname.startsWith('/pages/') ? 'Edit page' :
  pathname.startsWith('/settings/') ? ({ woocommerce: 'WooCommerce Settings', couriers: 'Courier Settings', payments: 'Payment Settings', users: 'Staff Users', audit: 'Audit Log', security: 'Security Settings' } as Record<string, string>)[pathname.split('/')[2]] || 'Settings' :
  pathname.startsWith('/orders/') ? 'Order details' :
  pathname === '/products/new' ? 'Create product' :
  pathname.startsWith('/products/') ? 'Edit product' :
  allNavigationItems.find((item) => item.path === pathname)?.label || 'NIX Commerce';

export const pageDescriptionForPath = (pathname: string) =>
  pathname === '/landing-pages/new' ? 'Choose a template and build a single-page checkout' :
  pathname.startsWith('/landing-pages/') ? 'Edit the content, offer and checkout' :
  pathname === '/pages/new' ? 'Build a new storefront page' :
  pathname.startsWith('/pages/') ? 'Edit page content, URL and search appearance' :
  pathname.startsWith('/settings/') ? ({ woocommerce: 'Store connection and synchronization', couriers: 'Courier provider connections and API credentials', payments: 'Online checkout and payment gateway configuration', users: 'Staff accounts and access roles', audit: 'Review important actions performed in the admin panel', security: 'Password and account security controls' } as Record<string, string>)[pathname.split('/')[2]] || 'Manage workspace settings' :
  pathname.startsWith('/orders/') ? 'Customer, payment, items, risk, and fulfilment' :
  pathname === '/products/new' ? 'Add a storefront-ready catalogue item' :
  pathname.startsWith('/products/') ? 'Update storefront content and commercial data' :
  allNavigationItems.find((item) => item.path === pathname)?.description || 'NIX Commerce operations workspace';
