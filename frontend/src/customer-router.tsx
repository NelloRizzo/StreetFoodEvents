import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { HomePage } from './pages/HomePage'
import { PlatformPage } from './pages/PlatformPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ProfilePage } from './pages/ProfilePage'
import { FavoritesPage } from './pages/FavoritesPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventMenuPage } from './pages/EventMenuPage'
import { EventMapPage } from './pages/EventMapPage'
import { PoiDetailPage } from './pages/PoiDetailPage'
import { EventStandMenuPage } from './pages/EventStandMenuPage'
import { StandDetailPage } from './pages/StandDetailPage'
import { StandDisplayPage } from './pages/StandDisplayPage'
import { StandReviewPage } from './pages/StandReviewPage'
import { EventReviewPage } from './pages/EventReviewPage'
import { StandAdhesionWizardPage } from './pages/StandAdhesionWizardPage'
import { EventContestsPage } from './pages/EventContestsPage'
import { ContestPage } from './pages/ContestPage'
import { ContestPlayPage } from './pages/ContestPlayPage'
import { ContestVerifyPage } from './pages/ContestVerifyPage'
import { ContestDeliveryPage } from './pages/ContestDeliveryPage'
import { PublicGalleryPage } from './pages/PublicGalleryPage'
import { SlideshowPage } from './pages/SlideshowPage'
import { FramesPage } from './pages/FramesPage'
import { FlyerPage } from './pages/FlyerPage'
import { ReceiptPage } from './pages/ReceiptPage'
import { TrackOrderPage } from './pages/TrackOrderPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { GuidePage } from './pages/GuidePage'
import { ThemePreviewPage } from './pages/ThemePreviewPage'
import { StationQueuePage } from './pages/StationQueuePage'
import { StandTrackingPage } from './pages/StandTrackingPage'
import { AliasRedirectPage } from './pages/AliasRedirectPage'
import { ActivationPage } from './pages/ActivationPage'
import { AdhesionFormPublicPage } from './pages/AdhesionFormPublicPage'

/* Customers PWA — public-facing routes only (no admin / cashier / station).
   Same origin (same origin repo), served at /customers/, installable + offline
   app-shell via vite-plugin-pwa. Reuses the shared public pages and layouts. */

/* Redirect che deve risolvere il parametro dell'evento: <Navigate to="...">
   non interpola :param, quindi serve un componente che lo legga. */
function LegacyGalleryRedirect() {
  const { eventId } = useParams<{ eventId: string }>()
  return <Navigate to={`/events/${eventId}/gallery`} replace />
}

export const customerRouter = createBrowserRouter(
  [
    /* Public routes (PublicLayout: top bar + bottom bar) */
    {
      path: '/',
      element: <PublicLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'platform', element: <PlatformPage /> },
        { path: 'login', element: <LoginPage /> },
        { path: 'register', element: <RegisterPage /> },
        { path: 'profilo', element: <ProfilePage /> },
        { path: 'favorites', element: <FavoritesPage /> },
        { path: 'events/:eventId', element: <EventDetailPage /> },
        { path: 'events/:eventId/menu', element: <EventMenuPage /> },
        { path: 'events/:eventId/mappa', element: <EventMapPage /> },
        { path: 'events/:eventId/pois/:poiId', element: <PoiDetailPage /> },
        { path: 'events/:eventId/stands/:standId', element: <EventStandMenuPage /> },
        { path: 'stands/:standId', element: <StandDetailPage /> },
        { path: 'stands/:standId/display', element: <StandDisplayPage /> },
        { path: 'stands/:standId/review', element: <StandReviewPage /> },
        { path: 'events/:eventId/review', element: <EventReviewPage /> },
        { path: 'events/:eventId/stand-adhesion', element: <StandAdhesionWizardPage /> },
        { path: 'events/:eventId/contests', element: <EventContestsPage /> },
        { path: 'contest/:contestId', element: <ContestPage /> },
        { path: 'contest/:contestId/play', element: <ContestPlayPage /> },
        { path: 'contest/:contestId/verify/:participantId', element: <ContestVerifyPage /> },
        { path: 'contest/:contestId/delivery', element: <ContestDeliveryPage /> },
        /* Un solo path per la galleria, identico a quello del sito operatore:
           events/:eventId/gallery -> PublicGalleryPage (quella per i visitatori).
           Nella PWA la pagina di gestione (EventGalleryPage: selezione, email,
           social) non e' montata perche' non e' raggiungibile da nessun link e
           appartiene al mondo operatore. */
        { path: 'events/:eventId/gallery', element: <PublicGalleryPage /> },
        { path: 'events/:eventId/galleria', element: <Navigate to="gallery" replace /> },
        { path: 'gallery/:eventId', element: <LegacyGalleryRedirect /> },
        { path: 'events/:eventId/slideshow', element: <SlideshowPage /> },
        { path: 'frames', element: <FramesPage /> },
        { path: 'flyer/:eventId', element: <FlyerPage /> },
        { path: 'receipt/:orderId', element: <ReceiptPage /> },
        { path: 'track/:orderId', element: <TrackOrderPage /> },
        { path: 'privacy', element: <PrivacyPage /> },
        { path: 'guide/:role', element: <GuidePage /> },
        { path: 'theme-preview', element: <ThemePreviewPage /> },
      ],
    },

    /* Standalone routes (no layout) */
    { path: '/orders/station/:stationId', element: <StationQueuePage /> },
    { path: '/events/:eventId/stands/:standId/tracking', element: <StandTrackingPage /> },
    { path: '/show/:entityType/:alias', element: <AliasRedirectPage /> },
    { path: '/attiva/:token', element: <ActivationPage /> },
    { path: '/events/:eventId/adhesion-form', element: <AdhesionFormPublicPage /> },

    /* Catch-all: in questa build le rotte admin (/admin/*, /dashboard, ...)
       non esistono. Un bookmark o un link residuo verso la dashboard
       riporterebbe a un 404 "Unexpected Application Error": meglio la home. */
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename: '/customers' },
)
