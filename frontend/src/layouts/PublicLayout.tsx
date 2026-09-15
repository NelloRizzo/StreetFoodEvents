import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'

import styles from './PublicLayout.module.scss'
import { PublicHeader } from '../components/PublicHeader'
import { PublicBottomBar } from '../components/PublicBottomBar'
import { CookieConsentBanner } from '../components/CookieConsentBanner'
import { OrderTrackingModal } from '../components/OrderTrackingModal'
import { initGTM, trackPageView, setAnalyticsContext } from '../lib/gtm'
import { getConsent } from '../lib/consent'
import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'
import { useTrackingEnabled } from '../lib/tracking'

type RolesPayload = {
  isPlatformAdmin: boolean
  roles: { slug: string; scope: string }[]
}

const ADMIN_TRACKING_ROLE_SLUGS = ['event-admin', 'stand-admin', 'platform-admin']

export function PublicLayout() {
  const location = useLocation()
  const params = useParams<{ eventId?: string; standId?: string }>()
  const { user } = useAuth()
  const [canTrack, setCanTrack] = useState(false)
  const { enabled: trackingEnabled, toggle: onToggleTracking } = useTrackingEnabled('public', params.eventId)

  useEffect(() => {
    if (!user) {
      setCanTrack(false)
      return
    }
    apiRequest<RolesPayload>('/auth/me/roles')
      .then((d) => {
        const isAdminRole =
          d.isPlatformAdmin ||
          d.roles.some((r) => ADMIN_TRACKING_ROLE_SLUGS.includes(r.slug))
        setCanTrack(isAdminRole)
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    const consent = getConsent()
    if (consent) {
      initGTM({ analytics: consent.analytics, ads: consent.ads })
    }
  }, [])

  useEffect(() => {
    trackPageView(location.pathname)

    const isAdminUser = Boolean(user?.isPlatformAdmin || user?.isAdmin)
    setAnalyticsContext({
      role: isAdminUser ? 'admin' : user ? 'user' : 'guest',
      eventId: params.eventId,
      standId: params.standId,
    })
  }, [location.pathname, params.eventId, params.standId, user])

  const isSlideshow = location.pathname.includes('/slideshow')
  const isCashier = /\/stands\/[^/]+\/order$/.test(location.pathname) || /\/cashier/.test(location.pathname)
  const isDisplay = /\/stands\/[^/]+\/ordersqueue/.test(location.pathname)
  const isTrack = location.pathname.startsWith('/track/')

  const hideChrome = isSlideshow || isCashier || isDisplay || isTrack

  return (
    <div className={styles.layout} id="top">
      {!hideChrome && <PublicHeader showTracking={canTrack && Boolean(params.eventId)} trackingEnabled={trackingEnabled} onToggleTracking={onToggleTracking} />}

      <main className={styles.main}>
        <Outlet />
      </main>

      {!hideChrome && (
        <footer className={styles.footer}>
          <div className={`page-shell ${styles.footerInner}`}>
            <span>&copy; {new Date().getFullYear()} Street Food Events</span>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </footer>
      )}

      {!hideChrome && <PublicBottomBar />}

      <CookieConsentBanner />

      {canTrack && trackingEnabled && params.eventId && !hideChrome && (
        <OrderTrackingModal
          open
          eventId={params.eventId}
          onClose={onToggleTracking}
        />
      )}
    </div>
  )
}
