import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';

import { Layout } from './components/layout/Layout';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { LoginPage } from './pages/LoginPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((module) => ({ default: module.OrdersPage })));
const OrderDetailsPage = lazy(() => import('./pages/OrderDetailsPage').then((module) => ({ default: module.OrderDetailsPage })));
const CourierHubPage = lazy(() => import('./pages/CourierHubPage').then((module) => ({ default: module.CourierHubPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((module) => ({ default: module.InventoryPage })));
const ProductsPage = lazy(() => import('./pages/ProductsPage').then((module) => ({ default: module.ProductsPage })));
const ProductEditorPage = lazy(() => import('./pages/ProductEditorPage').then((module) => ({ default: module.ProductEditorPage })));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage').then((module) => ({ default: module.PurchasesPage })));
const PurchaseDetailsPage = lazy(() => import('./pages/PurchaseDetailsPage').then((module) => ({ default: module.PurchaseDetailsPage })));
const AccountingPage = lazy(() => import('./pages/AccountingPage').then((module) => ({ default: module.AccountingPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then((module) => ({ default: module.ExpensesPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const CrmPage = lazy(() => import('./pages/CrmPage').then((module) => ({ default: module.CrmPage })));
const MessagingPage = lazy(() => import('./pages/MessagingPage').then((module) => ({ default: module.MessagingPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const StorefrontSettingsPage = lazy(() => import('./pages/StorefrontSettingsPage').then((module) => ({ default: module.StorefrontSettingsPage })));
const TrackingPage = lazy(() => import('./pages/TrackingPage').then((module) => ({ default: module.TrackingPage })));
const StorePageEditorPage = lazy(() => import('./pages/StorePagesPage').then((module) => ({ default: module.StorePageEditorPage })));
const LandingDraftPreviewPage = lazy(() => import('./pages/LandingPagesPage').then((module) => ({ default: module.LandingDraftPreviewPage })));
const MediaGalleryPage = lazy(() => import('./pages/MediaGalleryPage').then((module) => ({ default: module.MediaGalleryPage })));
const ThemeCustomizerPage = lazy(() => import('./pages/ThemeCustomizerPage').then((module) => ({ default: module.ThemeCustomizerPage })));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((module) => ({ default: module.CategoriesPage })));
const AttributesPage = lazy(() => import('./pages/AttributesPage').then((module) => ({ default: module.AttributesPage })));
const UnifiedPagesPage = lazy(() => import('./pages/UnifiedPagesPage').then(module => ({ default: module.UnifiedPagesPage })));
const LegacyLandingRedirect = lazy(() => import('./pages/UnifiedPagesPage').then(module => ({ default: module.LegacyLandingRedirect })));
const StudioPage = lazy(() => import('./builder/StudioPage').then(module => ({ default: module.StudioPage })));

const PageLoader = () => (
  <div className="min-h-[40vh] flex items-center justify-center" aria-label="Loading page">
    <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '12px',
                fontSize: '13px',
              },
            }}
          />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/builder/:id" element={<ProtectedRoute><StudioPage /></ProtectedRoute>} />
            <Route path="/landing-pages/preview" element={<ProtectedRoute><LandingDraftPreviewPage /></ProtectedRoute>} />

            {/* Protected Portal Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailsPage />} />
              <Route path="courier-hub" element={<CourierHubPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/new" element={<ProductEditorPage />} />
              <Route path="products/:id/edit" element={<ProductEditorPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="attributes" element={<AttributesPage />} />
              <Route path="media" element={<MediaGalleryPage />} />
              <Route path="purchases" element={<PurchasesPage />} />
              <Route path="purchases/:id" element={<PurchaseDetailsPage />} />
              <Route path="accounting" element={<AccountingPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="crm" element={<CrmPage />} />
              <Route path="messaging" element={<MessagingPage />} />
              <Route path="storefront" element={<StorefrontSettingsPage />} />
              <Route path="tracking" element={<TrackingPage />} />
              <Route path="pages" element={<UnifiedPagesPage />} />
              <Route path="builder" element={<Navigate to="/pages?type=visual" replace />} />
              <Route path="pages/new" element={<StorePageEditorPage />} />
              <Route path="pages/:id/edit" element={<StorePageEditorPage />} />
              <Route path="landing-pages" element={<Navigate to="/pages?type=landing" replace />} />
              <Route path="landing-pages/new" element={<Navigate to="/pages?create=landing" replace />} />
              <Route path="landing-pages/:id/edit" element={<LegacyLandingRedirect />} />
              <Route path="theme-customizer" element={<ThemeCustomizerPage />} />
              <Route path="settings" element={<Navigate to="/settings/woocommerce" replace />} />
              <Route path="settings/:section" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
