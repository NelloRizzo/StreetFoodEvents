import { createBrowserRouter } from 'react-router-dom'

import { AppLayout } from './AppLayout'
import { RequireAuth } from './features/auth/require-auth'
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
import { StandOrdersPage } from './pages/StandOrdersPage'
import { StationQueuePage } from './pages/StationQueuePage'
import { ThemePreviewPage } from './pages/ThemePreviewPage'
import { UsersPage } from './pages/UsersPage'
import { StandsPage } from './pages/StandsPage'
import { CashierOrderPage } from './pages/CashierOrderPage'
import { EventCashierPage } from './pages/EventCashierPage'
import { EventMapPage } from './pages/EventMapPage'
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
import { ContestDeliveryPage } from './pages/ContestDeliveryPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'platform',
        element: <PlatformPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'events/:eventId',
        element: <EventDetailPage />,
      },
      {
        path: 'events/:eventId/mappa',
        element: <EventMapPage />,
      },
      {
        path: 'events/:eventId/pois/:poiId',
        element: <PoiDetailPage />,
      },
      {
        path: 'events/:eventId/stands/:standId',
        element: <EventStandMenuPage />,
      },
      {
        path: 'theme-preview',
        element: <ThemePreviewPage />,
      },
      {
        path: 'privacy',
        element: <PrivacyPage />,
      },
      {
        path: 'guide/:role',
        element: <GuidePage />,
      },
      {
        path: 'receipt/:orderId',
        element: <ReceiptPage />,
      },
      {
        path: 'events/:eventId/contests',
        element: <EventContestsPage />,
      },
      {
        path: 'contest/:contestId',
        element: <ContestPage />,
      },
      {
        path: 'contest/:contestId/play',
        element: <ContestPlayPage />,
      },
      {
        path: 'contest/:contestId/verify/:participantId',
        element: <ContestVerifyPage />,
      },
      {
        path: 'contest/:contestId/consegna',
        element: <ContestDeliveryPage />,
      },
      {
        path: 'events/:eventId/slideshow',
        element: <SlideshowPage />,
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },
          {
            path: 'events',
            element: <EventsPage />,
          },
          {
            path: 'stands',
            element: <StandsPage />,
          },
          {
            path: 'stands/:standId',
            element: <StandDetailPage />,
          },
          {
            path: 'products',
            element: <ProductsPage />,
          },
          {
            path: 'event-products',
            element: <EventProductsPage />,
          },
          {
            path: 'event-users',
            element: <EventUsersPage />,
          },
          {
            path: 'favorites',
            element: <FavoritesPage />,
          },
          {
            path: 'orders/:orderId',
            element: <OrderDetailPage />,
          },
          {
            path: 'events/:eventId/stands/:standId/orders',
            element: <StandOrdersPage />,
          },
          {
            path: 'events/:eventId/stands/:standId/order',
            element: <CashierOrderPage />,
          },
          {
            path: 'events/:eventId/orders',
            element: <EventOrdersPage />,
          },
          {
            path: 'events/:eventId/report',
            element: <EventReportPage />,
          },
          {
            path: 'events/:eventId/cashier',
            element: <EventCashierPage />,
          },
          {
            path: 'events/:eventId/exchange',
            element: <EventExchangePage />,
          },
          {
            path: 'events/:eventId/galleria',
            element: <EventGalleryPage />,
          },
          {
            path: 'events/:eventId/photo-booth',
            element: <PhotoBoothPage />,
          },
          {
            path: 'staff',
            element: <StaffPage />,
          },
          {
            path: 'users',
            element: <UsersPage />,
          },
          {
            path: 'user-roles',
            element: <UserRolesPage />,
          },
          {
            path: 'frames',
            element: <FramesPage />,
          },
          {
            path: 'admin/usage-contracts',
            element: <UsageContractsPage />,
          },
          {
            path: 'admin/menu-print',
            element: <MenuPrintPage />,
          },
        ],
      },
    ],
  },
  {
    path: 'orders/station/:stationId',
    element: <StationQueuePage />,
  },
  {
    path: 'flyer',
    element: <FlyerPage />,
  },
  {
    path: 'show/:entityType/:alias',
    element: <AliasRedirectPage />,
  },
])
