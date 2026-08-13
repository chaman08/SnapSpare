import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { RequireRole } from '@/features/auth/components/RequireRole'

const AppShell = lazy(() =>
  import('@/components/layout/AppShell').then((m) => ({ default: m.AppShell })),
)
const SellerShell = lazy(() =>
  import('@/components/layout/SellerShell').then((m) => ({ default: m.SellerShell })),
)
const AdminShell = lazy(() =>
  import('@/components/layout/AdminShell').then((m) => ({ default: m.AdminShell })),
)

const HomePage = lazy(() => import('@/pages/shop/HomePage'))
const CategoriesPage = lazy(() => import('@/pages/shop/CategoriesPage'))
const CategoryPage = lazy(() => import('@/pages/shop/CategoryPage'))
const ProductDetailPage = lazy(() => import('@/pages/shop/ProductDetailPage'))
const SearchResultsPage = lazy(() => import('@/pages/shop/SearchResultsPage'))
const GaragePage = lazy(() => import('@/pages/shop/GaragePage'))
const StorePage = lazy(() => import('@/pages/shop/StorePage'))
const VehicleLandingPage = lazy(() => import('@/pages/shop/VehicleLandingPage'))
const BrandPage = lazy(() => import('@/pages/shop/BrandPage'))
const OrdersPage = lazy(() => import('@/pages/shop/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/pages/shop/OrderDetailPage'))
const AccountPage = lazy(() => import('@/pages/shop/AccountPage'))
const CartPage = lazy(() => import('@/pages/shop/CartPage'))
const CheckoutPage = lazy(() => import('@/pages/shop/CheckoutPage'))
const RfqListPage = lazy(() => import('@/pages/shop/RfqListPage'))
const RfqNewPage = lazy(() => import('@/pages/shop/RfqNewPage'))
const RfqDetailPage = lazy(() => import('@/pages/shop/RfqDetailPage'))
const SellLandingPage = lazy(() => import('@/pages/sell/SellLandingPage'))
const SellApplyPage = lazy(() => import('@/pages/sell/SellApplyPage'))
const SellerDashboardPage = lazy(() => import('@/pages/seller/SellerDashboardPage'))
const SellerListingsPage = lazy(() => import('@/pages/seller/SellerListingsPage'))
const AddListingPage = lazy(() => import('@/pages/seller/AddListingPage'))
const EditListingPage = lazy(() => import('@/pages/seller/EditListingPage'))
const SellerInventoryPage = lazy(() => import('@/pages/seller/SellerInventoryPage'))
const SellerBulkUploadPage = lazy(() => import('@/pages/seller/SellerBulkUploadPage'))
const SellerPartRequestsPage = lazy(() => import('@/pages/seller/SellerPartRequestsPage'))
const NewPartRequestPage = lazy(() => import('@/pages/seller/NewPartRequestPage'))
const SellerRfqsPage = lazy(() => import('@/pages/seller/SellerRfqsPage'))
const SellerRfqDetailPage = lazy(() => import('@/pages/seller/SellerRfqDetailPage'))
const SellerOrdersPage = lazy(() => import('@/pages/seller/SellerOrdersPage'))
const SellerWarrantyClaimsPage = lazy(() => import('@/pages/seller/SellerWarrantyClaimsPage'))
const SellerDisputesPage = lazy(() => import('@/pages/seller/SellerDisputesPage'))
const SellerTaxPage = lazy(() => import('@/pages/seller/SellerTaxPage'))
const SellerPaymentsPage = lazy(() => import('@/pages/seller/SellerPaymentsPage'))
const SellerStaffPage = lazy(() => import('@/pages/seller/SellerStaffPage'))
const SellerSettingsPage = lazy(() => import('@/pages/seller/SellerSettingsPage'))
const KhataPage = lazy(() => import('@/pages/shop/KhataPage'))
const AdminCreditApprovalsPage = lazy(() => import('@/pages/admin/AdminCreditApprovalsPage'))
const AdminSellerApplicationsPage = lazy(() => import('@/pages/admin/AdminSellerApplicationsPage'))
const AdminSellerApplicationDetailPage = lazy(() => import('@/pages/admin/AdminSellerApplicationDetailPage'))
const AdminPartRequestsQueuePage = lazy(() => import('@/pages/admin/AdminPartRequestsQueuePage'))
const AdminPartRequestDetailPage = lazy(() => import('@/pages/admin/AdminPartRequestDetailPage'))
const AdminRfqsQueuePage = lazy(() => import('@/pages/admin/AdminRfqsQueuePage'))
const AdminRfqDetailPage = lazy(() => import('@/pages/admin/AdminRfqDetailPage'))
const AdminNotificationsPage = lazy(() => import('@/pages/admin/AdminNotificationsPage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminGstReportsPage = lazy(() => import('@/pages/admin/AdminGstReportsPage'))
const AdminReviewModerationPage = lazy(() => import('@/pages/admin/AdminReviewModerationPage'))
const AdminSpuriousReportsQueuePage = lazy(() => import('@/pages/admin/AdminSpuriousReportsQueuePage'))
const AdminSpuriousReportDetailPage = lazy(() => import('@/pages/admin/AdminSpuriousReportDetailPage'))
const AdminBrandAuthorizationsPage = lazy(() => import('@/pages/admin/AdminBrandAuthorizationsPage'))
const AdminWarrantyClaimsQueuePage = lazy(() => import('@/pages/admin/AdminWarrantyClaimsQueuePage'))
const AdminWarrantyClaimDetailPage = lazy(() => import('@/pages/admin/AdminWarrantyClaimDetailPage'))
const AdminDisputesQueuePage = lazy(() => import('@/pages/admin/AdminDisputesQueuePage'))
const AdminDisputeDetailPage = lazy(() => import('@/pages/admin/AdminDisputeDetailPage'))
// Phase 19: admin console.
const AdminSellersPage = lazy(() => import('@/pages/admin/AdminSellersPage'))
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage'))
const AdminFinancePage = lazy(() => import('@/pages/admin/AdminFinancePage'))
const AdminCataloguePage = lazy(() => import('@/pages/admin/AdminCataloguePage'))
const AdminFitmentPage = lazy(() => import('@/pages/admin/AdminFitmentPage'))
const AdminListingsPage = lazy(() => import('@/pages/admin/AdminListingsPage'))
const AdminReturnsQueuePage = lazy(() => import('@/pages/admin/AdminReturnsQueuePage'))
const AdminMarketingPage = lazy(() => import('@/pages/admin/AdminMarketingPage'))
const AdminContentPage = lazy(() => import('@/pages/admin/AdminContentPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminConfigPage = lazy(() => import('@/pages/admin/AdminConfigPage'))
const AdminAuditLogPage = lazy(() => import('@/pages/admin/AdminAuditLogPage'))
// Phase 22: discoverability & measurement.
const AdminAnalyticsPage = lazy(() => import('@/pages/admin/AdminAnalyticsPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ImpersonateRedirectPage = lazy(() => import('@/pages/ImpersonateRedirectPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
// Phase 24: launch readiness.
const LegalPage = lazy(() => import('@/pages/LegalPage'))
const HelpCentrePage = lazy(() => import('@/pages/shop/HelpCentrePage'))
const SupportPage = lazy(() => import('@/pages/shop/SupportPage'))
const AdminSupportTicketsPage = lazy(() => import('@/pages/admin/AdminSupportTicketsPage'))
const AdminSupportTicketDetailPage = lazy(() => import('@/pages/admin/AdminSupportTicketDetailPage'))

function RouteFallback() {
  return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 py-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function withFallback(children: JSX.Element) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: withFallback(<AppShell />),
    children: [
      { index: true, element: withFallback(<HomePage />) },
      { path: 'categories', element: withFallback(<CategoriesPage />) },
      { path: 'search', element: withFallback(<SearchResultsPage />) },
      // Phase 22: canonical flat product URL — the static 'p' segment keeps
      // this unambiguous against `parts/:categorySlug/:subCategorySlug`
      // (react-router ranks a static segment above a dynamic one at the same
      // position, same trick the old nested /p/:partId route already used).
      { path: 'parts/p/:partSlugId', element: withFallback(<ProductDetailPage />) },
      { path: 'parts/:categorySlug', element: withFallback(<CategoryPage />) },
      { path: 'parts/:categorySlug/:subCategorySlug', element: withFallback(<CategoryPage />) },
      // Legacy nested product URL — kept live (not removed) so old links/
      // bookmarks/search-engine-cached URLs still resolve; ProductDetailPage
      // itself redirects to the canonical parts/p/:partSlugId URL once the
      // part loads (see its header comment).
      { path: 'parts/:categorySlug/:subCategorySlug/p/:partId', element: withFallback(<ProductDetailPage />) },
      { path: 'parts/:categorySlug/:subCategorySlug/:vehicleSlug', element: withFallback(<CategoryPage />) },
      { path: 'vehicle/:makeSlug/:modelSlug/:year', element: withFallback(<VehicleLandingPage />) },
      { path: 'brand/:brandSlug', element: withFallback(<BrandPage />) },
      { path: 'garage', element: withFallback(<GaragePage />) },
      { path: 'store/:sellerSlug', element: withFallback(<StorePage />) },
      { path: 'sell', element: withFallback(<SellLandingPage />) },
      {
        path: 'sell/apply',
        element: withFallback(
          <RequireAuth>
            <SellApplyPage />
          </RequireAuth>,
        ),
      },
      {
        path: 'orders',
        element: withFallback(
          <RequireAuth>
            <OrdersPage />
          </RequireAuth>,
        ),
      },
      {
        path: 'orders/:orderId',
        element: withFallback(
          <RequireAuth>
            <OrderDetailPage />
          </RequireAuth>,
        ),
      },
      { path: 'account', element: withFallback(<AccountPage />) },
      {
        path: 'account/khata',
        element: withFallback(
          <RequireAuth>
            <KhataPage />
          </RequireAuth>,
        ),
      },
      { path: 'cart', element: withFallback(<CartPage />) },
      {
        path: 'checkout',
        element: withFallback(
          <RequireAuth>
            <CheckoutPage />
          </RequireAuth>,
        ),
      },
      {
        path: 'rfq',
        element: withFallback(
          <RequireAuth>
            <RfqListPage />
          </RequireAuth>,
        ),
      },
      {
        path: 'rfq/new',
        element: withFallback(
          <RequireAuth>
            <RfqNewPage />
          </RequireAuth>,
        ),
      },
      {
        path: 'rfq/:rfqId',
        element: withFallback(
          <RequireAuth>
            <RfqDetailPage />
          </RequireAuth>,
        ),
      },
      // Phase 24: launch readiness — legal pages, Help Centre, contact/support.
      { path: 'legal/:slug', element: withFallback(<LegalPage />) },
      { path: 'help', element: withFallback(<HelpCentrePage />) },
      { path: 'support', element: withFallback(<SupportPage />) },
    ],
  },
  {
    path: '/login',
    element: withFallback(<LoginPage />),
  },
  {
    path: '/impersonate',
    element: withFallback(<ImpersonateRedirectPage />),
  },
  {
    path: '/seller',
    element: withFallback(
      <RequireRole requiredRole="seller">
        <SellerShell />
      </RequireRole>,
    ),
    children: [
      { index: true, element: withFallback(<SellerDashboardPage />) },
      { path: 'listings', element: withFallback(<SellerListingsPage />) },
      { path: 'listings/new', element: withFallback(<AddListingPage />) },
      { path: 'listings/:listingId/edit', element: withFallback(<EditListingPage />) },
      { path: 'listings/:listingId/inventory', element: withFallback(<SellerInventoryPage />) },
      { path: 'listings/bulk-upload', element: withFallback(<SellerBulkUploadPage />) },
      { path: 'part-requests', element: withFallback(<SellerPartRequestsPage />) },
      { path: 'part-requests/new', element: withFallback(<NewPartRequestPage />) },
      { path: 'rfqs', element: withFallback(<SellerRfqsPage />) },
      { path: 'rfqs/:rfqId', element: withFallback(<SellerRfqDetailPage />) },
      { path: 'orders', element: withFallback(<SellerOrdersPage />) },
      { path: 'warranty-claims', element: withFallback(<SellerWarrantyClaimsPage />) },
      { path: 'disputes', element: withFallback(<SellerDisputesPage />) },
      { path: 'tax', element: withFallback(<SellerTaxPage />) },
      { path: 'payments', element: withFallback(<SellerPaymentsPage />) },
      { path: 'staff', element: withFallback(<SellerStaffPage />) },
      { path: 'settings', element: withFallback(<SellerSettingsPage />) },
    ],
  },
  {
    path: '/admin',
    element: withFallback(
      <RequireRole requiredRole="admin">
        <AdminShell />
      </RequireRole>,
    ),
    children: [
      { index: true, element: withFallback(<AdminDashboardPage />) },
      { path: 'gst-reports', element: withFallback(<AdminGstReportsPage />) },
      { path: 'credit-approvals', element: withFallback(<AdminCreditApprovalsPage />) },
      { path: 'seller-applications', element: withFallback(<AdminSellerApplicationsPage />) },
      { path: 'seller-applications/:applicationId', element: withFallback(<AdminSellerApplicationDetailPage />) },
      { path: 'part-requests', element: withFallback(<AdminPartRequestsQueuePage />) },
      { path: 'part-requests/:requestId', element: withFallback(<AdminPartRequestDetailPage />) },
      { path: 'rfqs', element: withFallback(<AdminRfqsQueuePage />) },
      { path: 'rfqs/:rfqId', element: withFallback(<AdminRfqDetailPage />) },
      { path: 'notifications', element: withFallback(<AdminNotificationsPage />) },
      { path: 'review-moderation', element: withFallback(<AdminReviewModerationPage />) },
      { path: 'spurious-reports', element: withFallback(<AdminSpuriousReportsQueuePage />) },
      { path: 'spurious-reports/:reportId', element: withFallback(<AdminSpuriousReportDetailPage />) },
      { path: 'brand-authorizations', element: withFallback(<AdminBrandAuthorizationsPage />) },
      { path: 'warranty-claims', element: withFallback(<AdminWarrantyClaimsQueuePage />) },
      { path: 'warranty-claims/:claimId', element: withFallback(<AdminWarrantyClaimDetailPage />) },
      { path: 'disputes', element: withFallback(<AdminDisputesQueuePage />) },
      { path: 'disputes/:disputeId', element: withFallback(<AdminDisputeDetailPage />) },
      // Phase 19: admin console.
      { path: 'sellers', element: withFallback(<AdminSellersPage />) },
      { path: 'orders', element: withFallback(<AdminOrdersPage />) },
      { path: 'finance', element: withFallback(<AdminFinancePage />) },
      { path: 'catalogue', element: withFallback(<AdminCataloguePage />) },
      { path: 'fitment', element: withFallback(<AdminFitmentPage />) },
      { path: 'listings', element: withFallback(<AdminListingsPage />) },
      { path: 'returns', element: withFallback(<AdminReturnsQueuePage />) },
      { path: 'marketing', element: withFallback(<AdminMarketingPage />) },
      { path: 'content', element: withFallback(<AdminContentPage />) },
      { path: 'users', element: withFallback(<AdminUsersPage />) },
      { path: 'config', element: withFallback(<AdminConfigPage />) },
      { path: 'audit-log', element: withFallback(<AdminAuditLogPage />) },
      // Phase 22: discoverability & measurement.
      { path: 'analytics', element: withFallback(<AdminAnalyticsPage />) },
      // Phase 24: launch readiness — support ticket queue.
      { path: 'support', element: withFallback(<AdminSupportTicketsPage />) },
      { path: 'support/:ticketId', element: withFallback(<AdminSupportTicketDetailPage />) },
    ],
  },
  { path: '*', element: withFallback(<NotFoundPage />) },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
