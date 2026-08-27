import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'
import { Avatar } from '../components/Avatar'
import styles from './AdminTopBar.module.scss'

type AdminTopBarProps = {
  onMenuToggle: () => void
}

const OID_RE = /^[a-f0-9]{24}$/i

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  events: 'Eventi',
  stands: 'Stand',
  manage: 'Gestione',
  products: 'Prodotti',
  'event-products': 'Prodotti per evento',
  'event-users': 'Portafogli eventi',
  favorites: 'Preferiti',
  orders: 'Ordini',
  order: 'Cassa stand',
  staff: 'Staff',
  users: 'Utenti',
  'user-roles': 'Ruoli',
  frames: 'Cornici',
  'usage-contracts': "Contratti d'uso",
  'menu-print': 'Stampa menù',
  cashier: 'Cassa evento',
  report: 'Resoconto',
  exchange: 'Cambio valuta',
  settlements: 'Liquidazioni',
  galleria: 'Galleria',
  slideshow: 'Slideshow',
  'contest-manage': 'Gestione contest',
}

const OID_FALLBACK_LABELS: Record<string, string> = {
  event: 'Evento',
  stand: 'Stand',
  order: 'Dettaglio ordine',
}

function prettify(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1)
    .replace(/-/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
}

type Crumb = {
  label: string
  segment?: string
  kind?: 'event' | 'stand' | 'order'
  to?: string
}

function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []

  if (segments[0] === 'admin') {
    crumbs.push({ label: 'Admin', to: '/admin/dashboard' })
    let path = ''
    let idContext: 'events' | 'stands' | 'orders' | null = null
    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i]
      path += `/${segment}`
      const full = `/admin${path}`
      const isOid = OID_RE.test(segment)
      let kind: Crumb['kind']
      if (isOid && idContext === 'events') kind = 'event'
      else if (isOid && idContext === 'stands') kind = 'stand'
      else if (isOid && idContext === 'orders') kind = 'order'
      const label = isOid
        ? (kind ? OID_FALLBACK_LABELS[kind] : prettify(segment))
        : (SEGMENT_LABELS[segment] ?? prettify(segment))
      const crumb: Crumb = { label }
      if (kind) {
        crumb.segment = segment
        crumb.kind = kind
      }
      if (i === segments.length - 1) {
        crumbs.push(crumb)
      } else {
        crumbs.push({ ...crumb, to: full })
      }
      idContext = segment === 'events' ? 'events' : segment === 'stands' ? 'stands' : segment === 'orders' ? 'orders' : null
    }
  }
  return crumbs
}

export function AdminTopBar({ onMenuToggle }: AdminTopBarProps) {
  const { user } = useAuth()
  const location = useLocation()
  const breadcrumbs = useMemo(() => buildBreadcrumbs(location.pathname), [location.pathname])
  const [names, setNames] = useState<Record<string, string>>({})
  const requestedRef = useRef(new Set<string>())

  useEffect(() => {
    breadcrumbs.forEach((crumb) => {
      if (!crumb.kind || !crumb.segment) return
      const key = `${crumb.kind}:${crumb.segment}`
      if (requestedRef.current.has(key)) return
      requestedRef.current.add(key)
      if (crumb.kind === 'event') {
        apiRequest<{ item?: { name?: string } }>(`/events/${crumb.segment}`)
          .then((res) => {
            const name = res.item?.name
            if (name) setNames((n) => ({ ...n, [key]: name }))
          })
          .catch(() => {})
      } else if (crumb.kind === 'stand') {
        apiRequest<{ item?: { name?: string } }>(`/stands/${crumb.segment}`)
          .then((res) => {
            const name = res.item?.name
            if (name) setNames((n) => ({ ...n, [key]: name }))
          })
          .catch(() => {})
      } else if (crumb.kind === 'order') {
        apiRequest<{ item?: { orderNumber?: number } }>(`/orders/${crumb.segment}`)
          .then((res) => {
            const orderNumber = res.item?.orderNumber
            if (typeof orderNumber === 'number') setNames((n) => ({ ...n, [key]: `Ordine #${orderNumber}` }))
          })
          .catch(() => {})
      }
    })
  }, [breadcrumbs])

  function displayLabel(crumb: Crumb): string {
    if (crumb.kind && crumb.segment) {
      return names[`${crumb.kind}:${crumb.segment}`] ?? crumb.label
    }
    return crumb.label
  }

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
                <Link className={styles.crumbLink} to={crumb.to}>{displayLabel(crumb)}</Link>
              ) : (
                <span className={styles.crumbCurrent}>{displayLabel(crumb)}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className={styles.right}>
        <Link className={styles.publicLink} to="/" target="_blank" rel="noopener">
          {'\u{1F310}'} Modalità pubblica
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
