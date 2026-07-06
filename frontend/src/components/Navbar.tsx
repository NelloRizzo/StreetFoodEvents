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

const platformItems = [
  { label: 'Eventi', to: '/events' },
  { label: 'Stand', to: '/stands' },
  { label: 'Prodotti', to: '/products' },
  { label: 'Prodotti per evento', to: '/event-products' },
  { label: 'Utenti', to: '/users' },
  { label: 'Ruoli', to: '/user-roles' },
  { label: 'Staff', to: '/staff' },
  { label: 'Partecipanti', to: '/event-users' },
  { label: 'Contratti d\'uso', to: '/admin/usage-contracts' },
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
  const [isEventsOpen, setIsEventsOpen] = useState(false)
  const [isPlatformOpen, setIsPlatformOpen] = useState(false)
  const [isReportsOpen, setIsReportsOpen] = useState(false)
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const eventsMenuRef = useRef<HTMLDivElement>(null)
  const platformMenuRef = useRef<HTMLDivElement>(null)
  const reportsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (eventsMenuRef.current && !eventsMenuRef.current.contains(event.target as Node)) {
        setIsEventsOpen(false)
      }
      if (platformMenuRef.current && !platformMenuRef.current.contains(event.target as Node)) {
        setIsPlatformOpen(false)
      }
      if (reportsMenuRef.current && !reportsMenuRef.current.contains(event.target as Node)) {
        setIsReportsOpen(false)
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

  function closeAll() {
    setIsMenuOpen(false)
    setIsUserMenuOpen(false)
    setIsEventsOpen(false)
    setIsPlatformOpen(false)
    setIsReportsOpen(false)
  }

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
              <div className={styles.topNav}>
                <NavLink
                  className={styles.navLink}
                  to="/dashboard"
                  onClick={closeAll}
                >
                  Dashboard
                </NavLink>
              </div>

              <div className={styles.eventsSection} ref={eventsMenuRef}>
                <button
                  type="button"
                  className={`${styles.dropdownToggle} ${isEventsOpen ? styles.dropdownToggleOpen : ''}`}
                  onClick={() => setIsEventsOpen((open) => !open)}
                  aria-expanded={isEventsOpen}
                >
                  Eventi
                  <span className={styles.dropdownArrow} aria-hidden="true" />
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
                        onClick={closeAll}
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

              <div className={styles.dropdownSection}>
                <NavLink
                  className={styles.navLink}
                  to="/orders"
                  onClick={closeAll}
                >
                  Ordini
                </NavLink>
              </div>

              <div className={styles.dropdownSection} ref={reportsMenuRef}>
                <button
                  type="button"
                  className={`${styles.dropdownToggle} ${isReportsOpen ? styles.dropdownToggleOpen : ''}`}
                  onClick={() => setIsReportsOpen((open) => !open)}
                  aria-expanded={isReportsOpen}
                >
                  Resoconti
                  <span className={styles.dropdownArrow} aria-hidden="true" />
                </button>

                {isReportsOpen && (
                  <div className={styles.dropdownMenu}>
                    <Link className={styles.dropdownLink} to="/admin/menu-print" onClick={closeAll}>
                      Menu stampa
                    </Link>
                    <Link className={styles.dropdownLink} to="/guide/event-cashier" onClick={closeAll}>
                      Guide
                    </Link>
                  </div>
                )}
              </div>

              <div className={styles.dropdownSection} ref={platformMenuRef}>
                <button
                  type="button"
                  className={`${styles.dropdownToggle} ${isPlatformOpen ? styles.dropdownToggleOpen : ''}`}
                  onClick={() => setIsPlatformOpen((open) => !open)}
                  aria-expanded={isPlatformOpen}
                >
                  Piattaforma
                  <span className={styles.dropdownArrow} aria-hidden="true" />
                </button>

                {isPlatformOpen && (
                  <div className={styles.dropdownMenu}>
                    {platformItems.map((item) => (
                      <NavLink
                        key={item.to}
                        className={styles.dropdownLink}
                        to={item.to}
                        onClick={closeAll}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                    <a
                      className={styles.dropdownLink}
                      href="/flyer"
                      target="_blank"
                      rel="noopener"
                      onClick={closeAll}
                    >
                      Volantino
                    </a>
                  </div>
                )}
              </div>

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
                        onClick={closeAll}
                      >
                        Il mio profilo
                      </Link>
                      <Link
                        className={styles.dropdownAction}
                        to="/favorites"
                        onClick={closeAll}
                      >
                        Preferiti
                      </Link>
                      <button
                        type="button"
                        className={styles.dropdownAction}
                        onClick={async () => {
                          closeAll()
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
