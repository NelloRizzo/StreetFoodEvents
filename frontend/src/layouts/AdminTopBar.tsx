import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { Avatar } from '../components/Avatar'
import styles from './AdminTopBar.module.scss'

type AdminTopBarProps = {
  onMenuToggle: () => void
}

function buildBreadcrumbs(pathname: string): { label: string; to?: string }[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; to?: string }[] = []

  if (segments[0] === 'admin') {
    crumbs.push({ label: 'Admin', to: '/admin/dashboard' })
    let path = ''
    for (let i = 1; i < segments.length; i++) {
      path += `/${segments[i]}`
      const full = `/admin${path}`
      const label = segments[i].charAt(0).toUpperCase() + segments[i].slice(1)
        .replace(/-/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
      if (i === segments.length - 1) {
        crumbs.push({ label })
      } else {
        crumbs.push({ label, to: full })
      }
    }
  }
  return crumbs
}

export function AdminTopBar({ onMenuToggle }: AdminTopBarProps) {
  const { user } = useAuth()
  const location = useLocation()
  const breadcrumbs = buildBreadcrumbs(location.pathname)

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={onMenuToggle}
          aria-label="Apri menu"
        >
          <span className={styles.menuIcon}>
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className={styles.crumb}>
              {i > 0 && <span className={styles.separator}>/</span>}
              {crumb.to ? (
                <Link className={styles.crumbLink} to={crumb.to}>{crumb.label}</Link>
              ) : (
                <span className={styles.crumbCurrent}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className={styles.right}>
        <Link className={styles.publicLink} to="/" target="_blank" rel="noopener">
          {'\u{1F310}'} Modalit\u00E0 pubblica
        </Link>
        <Link className={styles.userLink} to="/admin/dashboard">
          <Avatar
            src={user?.avatar?.url ?? null}
            firstName={user?.firstName ?? '?'}
            lastName={user?.lastName ?? '?'}
            size="sm"
          />
          <span className={styles.userName}>
            {user?.firstName} {user?.lastName}
          </span>
        </Link>
      </div>
    </header>
  )
}
