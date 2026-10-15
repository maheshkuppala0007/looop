import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts & Route Guards
import PublicLayout from '../layouts/PublicLayout';
import CustomerLayout from '../layouts/CustomerLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';
import RouteLoadingFallback from '../components/common/RouteLoadingFallback';
import ErrorBoundary from '../components/common/ErrorBoundary';

// 1. Lazy-loaded Public Pages
const LandingPage = lazy(() => import('../pages/public/LandingPage'));
const BrowsePage = lazy(() => import('../pages/public/BrowsePage'));
const ItemDetailPage = lazy(() => import('../pages/public/ItemDetailPage'));
const HowItWorksPage = lazy(() => import('../pages/public/HowItWorksPage'));
const AboutPage = lazy(() => import('../pages/public/AboutPage'));
const LoginPage = lazy(() => import('../pages/public/LoginPage'));
const RegisterPage = lazy(() => import('../pages/public/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/public/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/public/ResetPasswordPage'));
const PublicProfilePage = lazy(() => import('../pages/public/PublicProfilePage'));

// 2. Lazy-loaded Customer Pages
const CustomerDashboard = lazy(() => import('../pages/customer/CustomerDashboard'));
const MyItemsPage = lazy(() => import('../pages/customer/MyItemsPage'));
const ShareItemPage = lazy(() => import('../pages/customer/ShareItemPage'));
const WantedItemsPage = lazy(() => import('../pages/customer/WantedItemsPage'));
const CreateWantedItemPage = lazy(() => import('../pages/customer/CreateWantedItemPage'));
const WantedItemDetailPage = lazy(() => import('../pages/customer/WantedItemDetailPage'));
const RequestsPage = lazy(() => import('../pages/customer/RequestsPage'));
const RequestDetails = lazy(() => import('../pages/customer/RequestDetails'));
const Transactions = lazy(() => import('../pages/customer/Transactions'));
const TransactionDetails = lazy(() => import('../pages/customer/TransactionDetails'));
const MessagesPage = lazy(() => import('../pages/customer/MessagesPage'));
const NotificationsPage = lazy(() => import('../pages/customer/NotificationsPage'));
const SavedItemsPage = lazy(() => import('../pages/customer/SavedItemsPage'));
const ProfilePage = lazy(() => import('../pages/customer/ProfilePage'));
const ReviewsPage = lazy(() => import('../pages/customer/ReviewsPage'));
const ImpactPage = lazy(() => import('../pages/customer/ImpactPage'));
const PointsDashboardPage = lazy(() => import('../pages/customer/PointsDashboardPage'));
const RewardsStorePage = lazy(() => import('../pages/customer/RewardsStorePage'));
const CoinsWalletPage = lazy(() => import('../pages/customer/CoinsWalletPage'));
const MyRewardOrdersPage = lazy(() => import('../pages/customer/MyRewardOrdersPage'));

// 3. Lazy-loaded Admin Pages
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'));
const AdminItemsPage = lazy(() => import('../pages/admin/AdminItemsPage'));
const AdminRequestsPage = lazy(() => import('../pages/admin/AdminRequestsPage'));
const AdminReuseRequestsPage = lazy(() => import('../pages/admin/AdminReuseRequestsPage'));
const AdminBorrowRequestsPage = lazy(() => import('../pages/admin/AdminBorrowRequestsPage'));
const AdminReportsPage = lazy(() => import('../pages/admin/AdminReportsPage'));
const AdminTransactionsPage = lazy(() => import('../pages/admin/AdminTransactionsPage'));
const AdminCategoriesPage = lazy(() => import('../pages/admin/AdminCategoriesPage'));
const AdminAnalyticsPage = lazy(() => import('../pages/admin/AdminAnalyticsPage'));
const AdminSettingsPage = lazy(() => import('../pages/admin/AdminSettingsPage'));
const AdminAuditLogsPage = lazy(() => import('../pages/admin/AdminAuditLogsPage'));
const AdminPointsPage = lazy(() => import('../pages/admin/AdminPointsPage'));
const AdminRewardsPage = lazy(() => import('../pages/admin/AdminRewardsPage'));
const AdminRewardFormPage = lazy(() => import('../pages/admin/AdminRewardFormPage'));
const AdminRewardOrdersPage = lazy(() => import('../pages/admin/AdminRewardOrdersPage'));
const AdminMessagesPage = lazy(() => import('../pages/admin/AdminMessagesPage'));
const AdminNotificationsPage = lazy(() => import('../pages/admin/AdminNotificationsPage'));
const AdminReviewsPage = lazy(() => import('../pages/admin/AdminReviewsPage'));
const AdminBroadcastPage = lazy(() => import('../pages/admin/AdminBroadcastPage'));

// 4. Common Pages
const NotFound = lazy(() => import('../pages/NotFound'));

export const AppRoutes = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
      {/* 1. PUBLIC PORTAL ROUTES */}
      <Route
        path="/"
        element={
          <PublicLayout>
            <LandingPage />
          </PublicLayout>
        }
      />
      <Route
        path="/browse"
        element={
          <PublicLayout>
            <BrowsePage />
          </PublicLayout>
        }
      />
      <Route
        path="/items/:id"
        element={
          <PublicLayout>
            <ItemDetailPage />
          </PublicLayout>
        }
      />
      <Route
        path="/product/:id"
        element={
          <PublicLayout>
            <ItemDetailPage />
          </PublicLayout>
        }
      />
      <Route
        path="/products/:id"
        element={
          <PublicLayout>
            <ItemDetailPage />
          </PublicLayout>
        }
      />
      <Route
        path="/users/:id"
        element={
          <PublicLayout>
            <PublicProfilePage />
          </PublicLayout>
        }
      />
      <Route
        path="/how-it-works"
        element={
          <PublicLayout>
            <HowItWorksPage />
          </PublicLayout>
        }
      />
      <Route
        path="/about"
        element={
          <PublicLayout>
            <AboutPage />
          </PublicLayout>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      {/* 2. CUSTOMER PORTAL ROUTES (PROTECTED) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <CustomerDashboard />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer" element={<Navigate to="/dashboard" replace />} />
      <Route path="/customer/dashboard" element={<Navigate to="/dashboard" replace />} />
      
      {/* Direct Shortcuts & Customer Sub-routes */}
      <Route
        path="/share"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <ShareItemPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/share" element={<Navigate to="/share" replace />} />
      {/* Wanted Items Routes */}
      <Route
        path="/wanted"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <WantedItemsPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/wanted" element={<Navigate to="/wanted" replace />} />

      <Route
        path="/wanted/create"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <CreateWantedItemPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/wanted/create" element={<Navigate to="/wanted/create" replace />} />

      <Route
        path="/wanted/:id"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <WantedItemDetailPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      {/* Requests & Offers Routes */}
      <Route
        path="/requests"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <RequestsPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/requests" element={<Navigate to="/requests" replace />} />

      <Route
        path="/requests/:id"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <RequestDetails />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      {/* Transactions Routes */}
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <Transactions />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/transactions" element={<Navigate to="/transactions" replace />} />

      <Route
        path="/transactions/:id"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <TransactionDetails />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/transactions/:id" element={<Navigate to="/transactions/:id" replace />} />
      {/* Messages Routes */}
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <MessagesPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages/:conversationId"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <MessagesPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      {/* Points & Rewards Dashboard Route */}
      <Route
        path="/points"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <PointsDashboardPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rewards"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <RewardsStorePage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/rewards" element={<Navigate to="/rewards" replace />} />
      <Route
        path="/rewards/orders"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <MyRewardOrdersPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/rewards/orders" element={<Navigate to="/rewards/orders" replace />} />
      <Route
        path="/coins"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <CoinsWalletPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/coins" element={<Navigate to="/coins" replace />} />
      <Route
        path="/customer/messages"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <MessagesPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/messages/:conversationId"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <MessagesPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <NotificationsPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/notifications" element={<Navigate to="/notifications" replace />} />
      <Route
        path="/saved"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <SavedItemsPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/saved" element={<Navigate to="/saved" replace />} />
      <Route
        path="/my-items"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <MyItemsPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/my-items" element={<Navigate to="/my-items" replace />} />
      <Route
        path="/customer/reviews"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <ReviewsPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/impact"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <ImpactPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/impact"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <ImpactPage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <CustomerLayout>
              <ProfilePage />
            </CustomerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/customer/profile" element={<Navigate to="/profile" replace />} />

      {/* 3. ADMIN PORTAL ROUTES */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/products"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminItemsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/items"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminItemsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminUsersPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reuse-requests"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminReuseRequestsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/borrow-requests"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminBorrowRequestsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/requests"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminRequestsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/points"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminPointsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rewards"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminRewardsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rewards/new"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminRewardFormPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rewards/:id/edit"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminRewardFormPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reward-orders"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminRewardOrdersPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/messages"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminMessagesPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminNotificationsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminReportsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transactions"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminTransactionsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminCategoriesPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminAnalyticsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminSettingsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminAuditLogsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reviews"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminReviewsPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/broadcasts"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminBroadcastPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/updates"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout>
              <AdminBroadcastPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* 4. NOT FOUND ROUTE */}
      <Route
        path="*"
        element={
          <PublicLayout>
            <NotFound />
          </PublicLayout>
        }
      />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default AppRoutes;
