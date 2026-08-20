import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { AdminSidebar } from './AdminSidebar'
import { AdminTopBar } from './AdminTopBar'
import styles from './AdminLayout.module.scss'

export function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const isSlideshow = location.pathname.includes('/slideshow')
  const isCashier = /\/stands\/[^/]+\/order/.test(location.pathname) || /\/cashier/.test(location.pathname)
  const isOrdersQueue = /\/ordersqueue/.test(location.pathname)
  const isStationQueue = /\/orders\/station\//.test(location.pathname)
  const isMenuPrint = /\/menu-print/.test(location.pathname)

  const hideChrome = isSlideshow || isCashier || isOrdersQueue || isStationQueue || isMenuPrint

  return (
    <div className={styles.admin}>
      {!hideChrome && (
        <AdminSidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className={styles.main} data-hide-chrome={hideChrome || undefined}>
        {!hideChrome && (
          <AdminTopBar onMenuToggle={() => setIsMobileMenuOpen((v) => !v)} />
        )}

        <div className={styles.content}>
          <div className="page-shell">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
