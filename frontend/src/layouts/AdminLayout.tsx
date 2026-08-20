import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { AdminSidebar } from './AdminSidebar'
import { AdminTopBar } from './AdminTopBar'
import styles from './AdminLayout.module.scss'

export function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className={styles.admin}>
      <AdminSidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      <div className={styles.main}>
        <AdminTopBar onMenuToggle={() => setIsMobileMenuOpen((v) => !v)} />

        <div className={styles.content}>
          <div className="page-shell">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
