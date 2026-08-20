import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { Avatar } from './Avatar'
import styles from './PublicHeader.module.scss'

export function PublicHeader() {
  const { isAuthenticated, user, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} to="/" aria-label="Street Food Events home">
          <span className={styles.brandMark}>SF</span>
          <span className={styles.brandText}>Street Food Events</span>
        </Link>

        <div className={styles.actions} ref={menuRef}>
          {isAuthenticated ? (
            <>
              <Link className={styles.adminLink} to="/admin/dashboard">
                Operatore
              </Link>
              <button
                type="button"
                className={styles.avatarBtn}
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-label="Menu utente"
              >
                <Avatar
                  src={user?.avatar?.url ?? null}
                  firstName={user?.firstName ?? '?'}
                  lastName={user?.lastName ?? '?'}
                  size="sm"
                />
              </button>
            </>
          ) : (
            <Link className={styles.loginBtn} to="/login">
              Accedi
            </Link>
          )}

          {isMenuOpen && isAuthenticated && (
            <div className={styles.dropdown}>
              <span className={styles.dropdownName}>
                {user?.firstName} {user?.lastName}
              </span>
              <span className={styles.dropdownEmail}>{user?.email}</span>
              <Link className={styles.dropdownAction} to="/favorites" onClick={() => setIsMenuOpen(false)}>
                Preferiti
              </Link>
              <Link className={styles.dropdownAction} to="/guide/event-cashier" onClick={() => setIsMenuOpen(false)}>
                Guide
              </Link>
              <Link className={styles.dropdownAction} to="/privacy" onClick={() => setIsMenuOpen(false)}>
                Privacy
              </Link>
              <button
                type="button"
                className={styles.dropdownAction}
                onClick={async () => {
                  setIsMenuOpen(false)
                  await logout()
                }}
              >
                Esci
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
