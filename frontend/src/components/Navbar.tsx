import { useState, useRef, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import { Avatar } from './Avatar'
import styles from './Navbar.module.scss'

type EventItem = {
  id: string
  name: string
  location: { label: string; city?: string | null }
  startDate: string
  endDate: string
  shortDescription: string | null
  coverImage: { url: string } | null
}

const userNavItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Ordini', to: '/orders' },
  { label: 'Preferiti', to: '/favorites' },
]

const adminNavItems = [
  { label: 'Eventi', to: '/events' },
  { label: 'Stand', to: '/stands' },
  { label: 'Prodotti', to: '/products' },
  { label: 'Prodotti per evento', to: '/event-products' },
  { label: 'Utenti', to: '/users' },
  { label: 'Ruoli', to: '/user-roles' },
  { label: 'Staff', to: '/staff' },
  { label: 'Partecipanti', to: '/event-users' },
]

type NavbarProps = {
  isAuthenticated?: boolean
  user?: import('../features/auth/auth-context').AuthUser | null
  onLogout?: () => Promise<void> | void
}

export function Navbar({
  isAuthenticated: _isAuthenticated,
  user: _user,
  onLogout,
}: NavbarProps) {
  const { isAuthenticated, user } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isAdminOpen, setIsAdminOpen] = useState(false)
  const [isEventsOpen, setIsEventsOpen] = useState(false)
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const adminMenuRef = useRef<HTMLDivElement>(null)
  const eventsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setIsAdminOpen(false)
      }
      if (eventsMenuRef.current && !eventsMenuRef.current.contains(event.target as Node)) {
        setIsEventsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isEventsOpen && events.length === 0 && !eventsLoading) {
      setEventsLoading(true)
      apiRequest<{ items: EventItem[] }>('/events')
        .then((data) => {
          setEvents(data.items)
          setEventsLoading(false)
        })
        .catch(() => setEventsLoading(false))
    }
  }, [isEventsOpen, events.length, eventsLoading])

  return (
    <header className={styles.header}>
      <div className={`page-shell ${styles.inner}`}>
        <Link className={styles.brand} to="/" aria-label="Street Food Events home">
          <span className={styles.brandMark}>SF</span>
          <span className={styles.brandText}>
            <strong>Street Food Events</strong>
            <span>Gestione stand e moneta evento</span>
          </span>
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={isMenuOpen}
          aria-controls="site-navigation"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span className={styles.menuIcon} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Menu
        </button>

        <nav
          id="site-navigation"
          className={`${styles.nav} ${isMenuOpen ? styles.navOpen : ''}`}
        >
          {isAuthenticated ? (
            <div className={styles.authGroup}>
              <div className={styles.userNavList}>
                {userNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    className={styles.navLink}
                    to={item.to}
                    onClick={() => { setIsMenuOpen(false); setIsUserMenuOpen(false) }}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>

              <div className={styles.eventsSection} ref={eventsMenuRef}>
                <button
                  type="button"
                  className={`${styles.eventsToggle} ${isEventsOpen ? styles.eventsToggleOpen : ''}`}
                  onClick={() => setIsEventsOpen((open) => !open)}
                  aria-expanded={isEventsOpen}
                >
                  Eventi
                  <span className={styles.eventsArrow} aria-hidden="true" />
                </button>

                {isEventsOpen && (
                  <div className={styles.eventsDropdown}>
                    {eventsLoading && (
                      <span className={styles.eventsLoading}>Caricamento...</span>
                    )}
                    {!eventsLoading && events.length === 0 && (
                      <span className={styles.eventsEmpty}>Nessun evento disponibile.</span>
                    )}
                    {!eventsLoading && events.map((event) => (
                      <Link
                        key={event.id}
                        to={`/events/${event.id}`}
                        className={styles.eventCard}
                        onClick={() => { setIsMenuOpen(false); setIsEventsOpen(false); setIsUserMenuOpen(false) }}
                      >
                        {event.coverImage ? (
                          <img
                            className={styles.eventCardImage}
                            src={event.coverImage.url}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.eventCardImagePlaceholder} />
                        )}
                        <div className={styles.eventCardBody}>
                          <strong className={styles.eventCardName}>{event.name}</strong>
                          <span className={styles.eventCardDate}>
                            {new Date(event.startDate).toLocaleDateString('it-IT', {
                              day: 'numeric', month: 'short'
                            })}
                            {' — '}
                            {new Date(event.endDate).toLocaleDateString('it-IT', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </span>
                          <span className={styles.eventCardLocation}>
                            {event.location.label}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {(user?.isAdmin) && (
                <div className={styles.adminSection} ref={adminMenuRef}>
                  <button
                    type="button"
                    className={`${styles.adminToggle} ${isAdminOpen ? styles.adminToggleOpen : ''}`}
                    onClick={() => setIsAdminOpen((open) => !open)}
                    aria-expanded={isAdminOpen}
                  >
                    Amministrazione
                    <span className={styles.adminArrow} aria-hidden="true" />
                  </button>

                  {isAdminOpen && (
                    <div className={styles.adminDropdown}>
                      {adminNavItems.map((item) => (
                        <NavLink
                          key={item.to}
                          className={styles.adminDropdownLink}
                          to={item.to}
                          onClick={() => { setIsMenuOpen(false); setIsUserMenuOpen(false); setIsAdminOpen(false) }}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                      <a
                        className={styles.adminDropdownLink}
                        href="/flyer/index.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { setIsMenuOpen(false); setIsUserMenuOpen(false); setIsAdminOpen(false) }}
                      >
                        Volantino
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.userSection} ref={userMenuRef}>
                <button
                  type="button"
                  className={styles.userToggle}
                  onClick={() => setIsUserMenuOpen((open) => !open)}
                  aria-expanded={isUserMenuOpen}
                  aria-label="Menu utente"
                >
                  <Avatar
                    src={user?.avatar?.url ?? null}
                    firstName={user?.firstName ?? '?'}
                    lastName={user?.lastName ?? '?'}
                    size="sm"
                  />
                </button>

                {isUserMenuOpen && (
                  <div className={styles.userDropdown}>
                    <span className={styles.userDropdownName}>
                      {user ? `${user.firstName} ${user.lastName}` : 'Operatore'}
                    </span>
                    <span className={styles.userDropdownEmail}>{user?.email}</span>
                    <div className={styles.userDropdownActions}>
                      <Link
                        className={styles.dropdownAction}
                        to="/dashboard"
                        onClick={() => { setIsMenuOpen(false); setIsUserMenuOpen(false) }}
                      >
                        Il mio profilo
                      </Link>
                      <Link
                        className={styles.dropdownAction}
                        to="/guide/event-cashier"
                        onClick={() => { setIsMenuOpen(false); setIsUserMenuOpen(false) }}
                      >
                        Guide
                      </Link>
                      <button
                        type="button"
                        className={styles.dropdownAction}
                        onClick={async () => {
                          setIsMenuOpen(false)
                          setIsUserMenuOpen(false)
                          await onLogout?.()
                        }}
                      >
                        Esci
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.authGroup}>
              <Link
                className={styles.secondaryCta}
                to="/platform"
              >
                Platform
              </Link>
              <Link className={styles.cta} to="/login" onClick={() => setIsMenuOpen(false)}>
                Accedi
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
