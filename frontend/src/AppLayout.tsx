import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import styles from './App.module.scss'
import { Navbar } from './components/Navbar'
import { CookieConsentBanner } from './components/CookieConsentBanner'
import { useAuth } from './features/auth/auth-context'
import { initGTM, trackPageView } from './lib/gtm'
import { hasConsent } from './lib/consent'

export function AppLayout() {
  const { isAuthenticated, logout, user } = useAuth()
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

  const hideChrome = isSlideshow || isCashier

  return (
    <div className={styles.app} id="top">
      {!hideChrome && (
        <Navbar
          isAuthenticated={isAuthenticated}
          user={user}
          onLogout={logout}
        />
      )}

      <Outlet />

      {!hideChrome && (
        <footer className={styles.footer}>
          <div className={`page-shell ${styles.footerInner}`}>
            <span>&copy; {new Date().getFullYear()} Street Food Events</span>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </footer>
      )}

      <CookieConsentBanner />
    </div>
  )
}
