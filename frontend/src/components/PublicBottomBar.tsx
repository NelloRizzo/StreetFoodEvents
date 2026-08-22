import { useEffect, useState, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { Avatar } from './Avatar'
import styles from './PublicBottomBar.module.scss'

export function PublicBottomBar() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const lastEventId = localStorage.getItem('lastEventId') || ''

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setIsUserMenuOpen(false)
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const mapPath = lastEventId ? `/events/${lastEventId}/mappa` : '/'

  return (
    <nav className={styles.bar} aria-label="Navigazione principale">
      <NavLink
        className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
        to="/"
        end
      >
        <span className={styles.tabIcon}>{'\u{1F3E0}'}</span>
        <span className={styles.tabLabel}>Home</span>
      </NavLink>

      <NavLink
        className={({ isActive }) => `${styles.tab} ${isActive && location.pathname.startsWith('/events') && !location.pathname.includes('/mappa') && !location.pathname.includes('/ordersqueue') ? styles.tabActive : ''}`}
        to={lastEventId ? `/events/${lastEventId}` : '/'}
      >
        <span className={styles.tabIcon}>{'\u{1F4C5}'}</span>
        <span className={styles.tabLabel}>Eventi</span>
      </NavLink>

      <NavLink
        className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
        to={mapPath}
      >
        <span className={styles.tabIcon}>{'\u{1F5FA}'}</span>
        <span className={styles.tabLabel}>Mappa</span>
      </NavLink>

      <NavLink
        className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
        to={isAuthenticated ? '/admin/dashboard' : '/login'}
      >
        <span className={styles.tabIcon}>{'\u{1F4F1}'}</span>
        <span className={styles.tabLabel}>QR</span>
      </NavLink>

      <div className={`${styles.tab} ${styles.tabUser}`} ref={userMenuRef}>
        <button
          type="button"
          className={styles.tabUserBtn}
          onClick={() => setIsUserMenuOpen((v) => !v)}
        >
          {isAuthenticated ? (
            <Avatar
              src={user?.avatar?.url ?? null}
              firstName={user?.firstName ?? '?'}
              lastName={user?.lastName ?? '?'}
              size="sm"
            />
          ) : (
            <span className={styles.tabIcon}>{'\u{1F464}'}</span>
          )}
          <span className={styles.tabLabel}>{isAuthenticated ? 'Profilo' : 'Accedi'}</span>
        </button>

        {isUserMenuOpen && (
          <div className={styles.userDropdown}>
            {isAuthenticated ? (
              <>
                <span className={styles.userDropdownName}>
                  {user?.firstName} {user?.lastName}
                </span>
                <span className={styles.userDropdownEmail}>{user?.email}</span>
                <Link className={styles.userDropdownAction} to="/admin/dashboard">
                  Modalità operatore
                </Link>
                <Link className={styles.userDropdownAction} to="/favorites">
                  Preferiti
                </Link>
                <button
                  type="button"
                  className={styles.userDropdownAction}
                  onClick={async () => {
                    setIsUserMenuOpen(false)
                    await logout()
                  }}
                >
                  Esci
                </button>
              </>
            ) : (
              <>
                <Link className={styles.userDropdownAction} to="/login" onClick={() => setIsUserMenuOpen(false)}>
                  Accedi
                </Link>
                <Link className={styles.userDropdownAction} to="/register" onClick={() => setIsUserMenuOpen(false)}>
                  Registrati
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
