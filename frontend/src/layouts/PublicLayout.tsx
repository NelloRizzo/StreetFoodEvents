import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import styles from './PublicLayout.module.scss'
import { PublicHeader } from '../components/PublicHeader'
import { PublicBottomBar } from '../components/PublicBottomBar'
import { CookieConsentBanner } from '../components/CookieConsentBanner'
import { initGTM, trackPageView } from '../lib/gtm'
import { hasConsent } from '../lib/consent'

export function PublicLayout() {
  const location = useLocation()

  useEffect(() => {
    if (hasConsent()) {
      initGTM()
    }
  }, [])

  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])

  const isSlideshow = location.pathname.includes('/slideshow')
  const isCashier = /\/stands\/[^/]+\/order/.test(location.pathname) || /\/cashier/.test(location.pathname)
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
