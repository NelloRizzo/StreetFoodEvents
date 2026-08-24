import { useState, useEffect, useMemo, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import { Avatar } from '../components/Avatar'
import styles from './AdminSidebar.module.scss'

const EVENT_STORAGE_KEY = 'adminSelectedEventId'

type EventItem = { id: string; name: string; endDate?: string | null }

type MyStand = { id: string; name: string; eventIds: string[] }

type SidebarItem = { label: string; to: string; icon: string; external?: boolean }

type AdminSidebarProps = {
  isMobileOpen: boolean
  onMobileClose: () => void
}

type SidebarSection = {
  label: string
  items: SidebarItem[]
}

export function AdminSidebar({ isMobileOpen, onMobileClose }: AdminSidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventItem[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [myStands, setMyStands] = useState<MyStand[]>([])
  const [now] = useState(() => Date.now())
  const [manuallySelectedEventId, setManuallySelectedEventId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(EVENT_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiRequest<{ items: EventItem[] }>('/events')
      .then((d) => setEvents(d.items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    apiRequest<{ stands: MyStand[] }>('/auth/me/stands')
      .then((d) => setMyStands(d.stands))
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

  // Evento attivo: 1) evento nell'URL (pagine event-scoped), 2) selezione manuale
  // persistente, 3) default = primo evento in corso, altrimenti il primo della lista.
  const urlEventId = location.pathname.match(/^\/admin\/events\/([a-f0-9]{24})(?:\/|$)/)?.[1] ?? null
  const storedEventId =
    manuallySelectedEventId && events.some((ev) => ev.id === manuallySelectedEventId)
      ? manuallySelectedEventId
      : null
  const defaultEventId = useMemo(() => {
    if (events.length === 0) return null
    const ongoing = events.find((ev) => {
      if (!ev.endDate) return false
      const endOfDay = new Date(ev.endDate)
      endOfDay.setHours(23, 59, 59, 999)
      return endOfDay.getTime() >= now
    })
    return (ongoing ?? events[0]).id
  }, [events, now])
  const selectedEventId = urlEventId ?? storedEventId ?? defaultEventId

  const selectedEvent = events.find((ev) => ev.id === selectedEventId) ?? null
  const basePath = selectedEvent ? `/admin/events/${selectedEvent.id}` : null

  const handleSelectEvent = (eventId: string) => {
    if (!eventId) return
    setManuallySelectedEventId(eventId)
    try {
      localStorage.setItem(EVENT_STORAGE_KEY, eventId)
    } catch { /* storage non disponibile */ }
    if (
      selectedEventId &&
      eventId !== selectedEventId &&
      location.pathname.startsWith(`/admin/events/${selectedEventId}/`)
    ) {
      navigate(location.pathname.replace(`/admin/events/${selectedEventId}/`, `/admin/events/${eventId}/`))
    }
  }

  const nameCollator = new Intl.Collator('it', { sensitivity: 'base' })
  const managedStands = selectedEventId
    ? myStands
        .filter((s) => s.eventIds.includes(selectedEventId))
        .sort((a, b) => nameCollator.compare(a.name, b.name))
    : []

  const managedStandItems: SidebarItem[] = []
  for (const s of managedStands) {
    managedStandItems.push({
      label: s.name,
      to: `/admin/stands/${s.id}/manage`,
      icon: '\u{1F3EA}',
    })
  }

  const sections: SidebarSection[] = [
    ...(basePath
      ? [{
          label: 'Ordini',
          items: [
            { label: 'Cassa evento', to: `${basePath}/cashier`, icon: '\u{1F4B0}' },
            { label: 'Ordini evento', to: `${basePath}/orders`, icon: '\u{1F4C4}' },
          ],
        } as SidebarSection]
      : []),
    ...(managedStandItems.length > 0
      ? [{ label: 'Operativo', items: managedStandItems } as SidebarSection]
      : []),
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
        ...(basePath
          ? [
              { label: 'Cambio', to: `${basePath}/exchange`, icon: '\u{1F504}' } as SidebarItem,
              { label: 'Liquidazione', to: `${basePath}/settlements`, icon: '\u{1F4B8}' } as SidebarItem,
            ]
          : []),
      ],
    },
    {
      label: 'Foto',
      items: [
        ...(basePath
          ? [
              { label: 'Galleria foto', to: `${basePath}/galleria`, icon: '\u{1F5BC}' } as SidebarItem,
              { label: 'Photo booth', to: `${basePath}/photo-booth`, icon: '\u{1F4F7}' } as SidebarItem,
            ]
          : []),
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

          {!isCollapsed && (
            <div className={styles.eventPicker}>
              <label className={styles.eventPickerLabel} htmlFor="admin-event-picker">
                Evento attivo
              </label>
              <select
                id="admin-event-picker"
                className={styles.eventPickerSelect}
                value={selectedEventId ?? ''}
                onChange={(e) => handleSelectEvent(e.target.value)}
              >
                {events.length === 0 && <option value="">Nessun evento</option>}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
          )}

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
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
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
                Modalità pubblica
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
