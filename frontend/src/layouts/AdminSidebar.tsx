import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import { Avatar } from '../components/Avatar'
import styles from './AdminSidebar.module.scss'

type EventItem = { id: string; name: string }

type AdminSidebarProps = {
  isMobileOpen: boolean
  onMobileClose: () => void
}

type SidebarSection = {
  label: string
  items: { label: string; to: string; icon: string }[]
}

export function AdminSidebar({ isMobileOpen, onMobileClose }: AdminSidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [events, setEvents] = useState<EventItem[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiRequest<{ items: EventItem[] }>('/events')
      .then((d) => setEvents(d.items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    onMobileClose()
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const eventOptions = events.map((ev) => ({
    label: ev.name,
    basePath: `/admin/events/${ev.id}`,
  }))

  const sections: SidebarSection[] = [
    {
      label: 'Ordini',
      items: [
        ...eventOptions.map((ev) => ({
          label: `Cassa ${ev.label}`,
          to: `${ev.basePath}/cashier`,
          icon: '\u{1F4B0}',
        })),
        ...eventOptions.map((ev) => ({
          label: `Ordini ${ev.label}`,
          to: `${ev.basePath}/orders`,
          icon: '\u{1F4C4}',
        })),
      ],
    },
    {
      label: 'Gestione',
      items: [
        { label: 'Eventi', to: '/admin/events', icon: '\u{1F4C5}' },
        { label: 'Stand', to: '/admin/stands', icon: '\u{1F3EA}' },
        { label: 'Prodotti', to: '/admin/products', icon: '\u{1F6D2}' },
        { label: 'Prodotti per evento', to: '/admin/event-products', icon: '\u{1F4E6}' },
        { label: 'Staff', to: '/admin/staff', icon: '\u{1F465}' },
      ],
    },
    {
      label: 'Finanziario',
      items: [
        { label: 'Portafogli eventi', to: '/admin/event-users', icon: '\u{1F4B3}' },
        ...eventOptions.map((ev) => ({
          label: `Liquidazione ${ev.label}`,
          to: `${ev.basePath}/settlements`,
          icon: '\u{1F4B8}',
        })),
      ],
    },
    {
      label: 'Foto',
      items: [
        ...eventOptions.map((ev) => ({
          label: `Galleria ${ev.label}`,
          to: `${ev.basePath}/galleria`,
          icon: '\u{1F5BC}',
        })),
        ...eventOptions.map((ev) => ({
          label: `Photo booth ${ev.label}`,
          to: `${ev.basePath}/photo-booth`,
          icon: '\u{1F4F7}',
        })),
        { label: 'Cornici', to: '/admin/frames', icon: '\u{1F5BC}' },
      ],
    },
    {
      label: 'Piattaforma',
      items: [
        { label: 'Utenti', to: '/admin/users', icon: '\u{1F464}' },
        { label: 'Ruoli', to: '/admin/user-roles', icon: '\u{1F511}' },
        { label: 'Contratti d\'uso', to: '/admin/usage-contracts', icon: '\u{1F4C4}' },
        { label: 'Menu stampa', to: '/admin/menu-print', icon: '\u{1F5A8}' },
        { label: 'Guide', to: '/guide/event-cashier', icon: '\u{1F4D6}' },
        { label: 'Volantino', to: '/flyer', icon: '\u{1F4E2}' },
      ],
    },
  ]

  return (
    <>
      {isMobileOpen && (
        <div className={styles.overlay} onClick={onMobileClose} />
      )}

      <aside
        className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${isMobileOpen ? styles.mobileOpen : ''}`}
      >
        <div className={styles.sidebarHeader}>
          <NavLink className={styles.brand} to="/admin/dashboard" onClick={onMobileClose}>
            <span className={styles.brandMark}>SF</span>
            {!isCollapsed && (
              <span className={styles.brandText}>Admin</span>
            )}
          </NavLink>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setIsCollapsed((v) => !v)}
            title={isCollapsed ? 'Espandi' : 'Comprimi'}
          >
            {isCollapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>

        <nav className={styles.nav}>
          <NavLink
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            to="/admin/dashboard"
            onClick={onMobileClose}
          >
            <span className={styles.navIcon}>{'\u{1F4CA}'}</span>
            {!isCollapsed && <span className={styles.navLabel}>Dashboard</span>}
          </NavLink>

          {sections.map((section) => (
            <div key={section.label} className={styles.section}>
              {!isCollapsed && (
                <span className={styles.sectionLabel}>{section.label}</span>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  to={item.to}
                  onClick={onMobileClose}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter} ref={userMenuRef}>
          <button
            type="button"
            className={styles.userBtn}
            onClick={() => setIsUserMenuOpen((v) => !v)}
          >
            <Avatar
              src={user?.avatar?.url ?? null}
              firstName={user?.firstName ?? '?'}
              lastName={user?.lastName ?? '?'}
              size="sm"
            />
            {!isCollapsed && (
              <span className={styles.userName}>{user?.firstName}</span>
            )}
          </button>

          {isUserMenuOpen && (
            <div className={styles.userDropdown}>
              <span className={styles.userDropdownName}>
                {user ? `${user.firstName} ${user.lastName}` : ''}
              </span>
              <span className={styles.userDropdownEmail}>{user?.email}</span>
              <NavLink className={styles.userDropdownAction} to="/" onClick={onMobileClose}>
                Modalit\u00E0 pubblica
              </NavLink>
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
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
