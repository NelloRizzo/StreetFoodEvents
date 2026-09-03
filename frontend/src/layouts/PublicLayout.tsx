import { useEffect } from 'react'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'

import styles from './PublicLayout.module.scss'
import { PublicHeader } from '../components/PublicHeader'
import { PublicBottomBar } from '../components/PublicBottomBar'
import { CookieConsentBanner } from '../components/CookieConsentBanner'
import { initGTM, trackPageView, setAnalyticsContext } from '../lib/gtm'
import { getConsent } from '../lib/consent'
import { useAuth } from '../features/auth/auth-context'

export function PublicLayout() {
  const location = useLocation()
  const params = useParams<{ eventId?: string; standId?: string }>()
  const { user } = useAuth()

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

  const hideChrome = isSlideshow || isCashier || isDisplay

  return (
    <div className={styles.layout} id="top">
      {!hideChrome && <PublicHeader />}

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
    </div>
  )
}
