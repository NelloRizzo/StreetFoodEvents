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

  return (
    <div className={styles.app} id="top">
      <Navbar
        isAuthenticated={isAuthenticated}
        user={user}
        onLogout={logout}
      />

      <Outlet />

      <footer className={styles.footer}>
        <div className={`page-shell ${styles.footerInner}`}>
          <span>Frontend mobile-first per la suite Street Food Events.</span>
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </footer>

      <CookieConsentBanner />
    </div>
  )
}
