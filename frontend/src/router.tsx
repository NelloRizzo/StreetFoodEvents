import { createBrowserRouter, Navigate } from 'react-router-dom'

import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { EventProductsPage } from './pages/EventProductsPage'
import { EventUsersPage } from './pages/EventUsersPage'
import { EventsPage } from './pages/EventsPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { PlatformPage } from './pages/PlatformPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { ProductsPage } from './pages/ProductsPage'
import { StaffPage } from './pages/StaffPage'
import { UserRolesPage } from './pages/UserRolesPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventStandMenuPage } from './pages/EventStandMenuPage'
import { StandDetailPage } from './pages/StandDetailPage'
import { StandManagePage } from './pages/StandManagePage'
import { StandOrdersPage } from './pages/StandOrdersPage'
import { StandDisplayPage } from './pages/StandDisplayPage'
import { StationQueuePage } from './pages/StationQueuePage'
import { ThemePreviewPage } from './pages/ThemePreviewPage'
import { UsersPage } from './pages/UsersPage'
import { StandsPage } from './pages/StandsPage'
import { CashierOrderPage } from './pages/CashierOrderPage'
import { EventCashierPage } from './pages/EventCashierPage'
import { EventMapPage } from './pages/EventMapPage'
import { EventMenuPage } from './pages/EventMenuPage'
import { EventOrdersPage } from './pages/EventOrdersPage'
import { EventReportPage } from './pages/EventReportPage'
import { EventGalleryPage } from './pages/EventGalleryPage'
import { PhotoBoothPage } from './pages/PhotoBoothPage'
import { PoiDetailPage } from './pages/PoiDetailPage'
import { ReceiptPage } from './pages/ReceiptPage'
import { GuidePage } from './pages/GuidePage'
import { FlyerPage } from './pages/FlyerPage'
import { UsageContractsPage } from './pages/UsageContractsPage'
import { MenuPrintPage } from './pages/MenuPrintPage'
import { AliasRedirectPage } from './pages/AliasRedirectPage'
import { SlideshowPage } from './pages/SlideshowPage'
import { FramesPage } from './pages/FramesPage'
import { EventContestsPage } from './pages/EventContestsPage'
import { ContestPage } from './pages/ContestPage'
import { ContestPlayPage } from './pages/ContestPlayPage'
import { ContestVerifyPage } from './pages/ContestVerifyPage'
import { EventExchangePage } from './pages/EventExchangePage'
import { EventContestManagePage } from './pages/EventContestManagePage'
import { StandSettlementsPage } from './pages/StandSettlementsPage'
import { SettlementsReportPage } from './pages/SettlementsReportPage'
import { ContestDeliveryPage } from './pages/ContestDeliveryPage'
import { ActivationPage } from './pages/ActivationPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { ProductGuidePage } from './pages/ProductGuidePage'
import { RicevutaLiquidazionePage } from './pages/RicevutaLiquidazionePage'
import { InformativaPrivacyPage } from './pages/InformativaPrivacyPage'
import { ParamRedirect } from './components/ParamRedirect'

export const router = createBrowserRouter([
  /* ── Public routes ── */
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'platform', element: <PlatformPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'events/:eventId', element: <EventDetailPage /> },
      { path: 'events/:eventId/menu', element: <EventMenuPage /> },
      { path: 'events/:eventId/mappa', element: <EventMapPage /> },
      { path: 'events/:eventId/pois/:poiId', element: <PoiDetailPage /> },
      { path: 'events/:eventId/stands/:standId', element: <EventStandMenuPage /> },
      { path: 'events/:eventId/stands/:standId/ordersqueue', element: <StandDisplayPage /> },
      { path: 'events/:eventId/contests', element: <EventContestsPage /> },
      { path: 'events/:eventId/slideshow', element: <SlideshowPage /> },
      { path: 'contest/:contestId', element: <ContestPage /> },
      { path: 'contest/:contestId/play', element: <ContestPlayPage /> },
      { path: 'contest/:contestId/verify/:participantId', element: <ContestVerifyPage /> },
      { path: 'contest/:contestId/consegna', element: <ContestDeliveryPage /> },
      { path: 'receipt/:orderId', element: <ReceiptPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'guide/:role', element: <GuidePage /> },
      { path: 'theme-preview', element: <ThemePreviewPage /> },

      /* Legacy admin redirects (old URLs → /admin/*) */
      { path: 'dashboard', element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'events', element: <Navigate to="/admin/events" replace /> },
      { path: 'stands', element: <Navigate to="/admin/stands" replace /> },
      { path: 'stands/:standId', element: <ParamRedirect build={(p) => `/admin/stands/${p.standId}`} /> },
      { path: 'stands/:standId/orders', element: <ParamRedirect build={(p) => `/admin/stands/${p.standId}/orders`} /> },
      { path: 'products', element: <Navigate to="/admin/products" replace /> },
      { path: 'event-products', element: <Navigate to="/admin/event-products" replace /> },
      { path: 'event-users', element: <Navigate to="/admin/event-users" replace /> },
      { path: 'favorites', element: <Navigate to="/admin/favorites" replace /> },
      { path: 'orders/:orderId', element: <ParamRedirect build={(p) => `/admin/orders/${p.orderId}`} /> },
      { path: 'staff', element: <Navigate to="/admin/staff" replace /> },
      { path: 'users', element: <Navigate to="/admin/users" replace /> },
      { path: 'user-roles', element: <Navigate to="/admin/user-roles" replace /> },
      { path: 'frames', element: <Navigate to="/admin/frames" replace /> },
    ],
  },

  /* ── Admin routes (protected) ── */
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      /* Event-scoped admin */
      { path: 'events/:eventId/cashier', element: <EventCashierPage /> },
      { path: 'events/:eventId/orders', element: <EventOrdersPage /> },
      { path: 'events/:eventId/report', element: <EventReportPage /> },
      { path: 'events/:eventId/exchange', element: <EventExchangePage /> },
      { path: 'events/:eventId/settlements', element: <StandSettlementsPage /> },
      { path: 'events/:eventId/settlements/report', element: <SettlementsReportPage /> },
      { path: 'events/:eventId/galleria', element: <EventGalleryPage /> },
      { path: 'events/:eventId/photo-booth', element: <PhotoBoothPage /> },
      { path: 'events/:eventId/contest-manage', element: <EventContestManagePage /> },
      { path: 'events/:eventId/stands/:standId/orders', element: <StandOrdersPage /> },
      { path: 'events/:eventId/stands/:standId/order', element: <CashierOrderPage /> },

      /* Platform-wide admin */
      { path: 'events', element: <EventsPage /> },
      { path: 'stands', element: <StandsPage /> },
      { path: 'stands/:standId', element: <StandDetailPage /> },
      { path: 'stands/:standId/manage', element: <StandManagePage /> },
      { path: 'stands/:standId/orders', element: <StandOrdersPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'event-products', element: <EventProductsPage /> },
      { path: 'event-users', element: <EventUsersPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'orders/:orderId', element: <OrderDetailPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'user-roles', element: <UserRolesPage /> },
      { path: 'frames', element: <FramesPage /> },
      { path: 'usage-contracts', element: <UsageContractsPage /> },
      { path: 'menu-print', element: <MenuPrintPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/product-guide', element: <ProductGuidePage /> },
      { path: 'documents/liquidation-receipt', element: <RicevutaLiquidazionePage /> },
      { path: 'documents/privacy-notice', element: <InformativaPrivacyPage /> },

      /* Legacy admin sub-paths */
      { path: 'usage-contracts-legacy', element: <Navigate to="/admin/usage-contracts" replace /> },
    ],
  },

  /* ── Standalone routes (no layout) ── */
  { path: 'orders/station/:stationId', element: <StationQueuePage /> },
  { path: 'flyer', element: <FlyerPage /> },
  { path: 'show/:entityType/:alias', element: <AliasRedirectPage /> },
  { path: 'attiva/:token', element: <ActivationPage /> },
])
