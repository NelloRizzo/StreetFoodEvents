import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { fetchStandKioskRecent, KIOSK_ACTIVE_KEY, type KioskState } from '../lib/orders'
import { useEventTheme } from '../features/theme/useEventTheme'
import styles from './OrderKioskPage.module.scss'

const POLL_INTERVAL_MS = 5000

type MyStand = { id: string; name: string; eventIds: string[] }
type RoleInfo = { slug: string; scope: string; eventId: string | null; standId: string | null }

const statusLabels: Record<string, string> = {
  confirmed: 'Confermato — in preparazione',
  preparing: 'In preparazione',
  ready: 'Pronto',
}

export function OrderKioskPage() {
  const { eventId, standId } = useParams<{ eventId: string; standId: string }>()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [eventName, setEventName] = useState('')
  const [kiosk, setKiosk] = useState<KioskState | null>(null)

  const storageKey = standId ? KIOSK_ACTIVE_KEY(standId) : null
  const [isActive, setIsActive] = useState(() => (storageKey ? localStorage.getItem(storageKey) === '1' : false))

  useEventTheme(null)

  useEffect(() => {
    if (!eventId || !standId) return
    let cancelled = false
    const check = async () => {
      try {
        const [rolesRes, standsRes] = await Promise.all([
          apiRequest<{ isPlatformAdmin: boolean; roles: RoleInfo[] }>('/auth/me/roles'),
          apiRequest<{ stands: MyStand[] }>('/auth/me/stands'),
        ])
        const hasPlatform = rolesRes.isPlatformAdmin || rolesRes.roles.some((r) => r.scope === 'platform')
        const hasEvent = rolesRes.roles.some((r) => r.scope === 'event' && r.eventId === eventId)
        const hasStand = standsRes.stands.some((s) => s.id === standId)
        if (!cancelled) setAuthorized(Boolean(hasPlatform || hasEvent || hasStand))
      } catch {
        if (!cancelled) setAuthorized(false)
      } finally {
        if (!cancelled) setCheckingAuth(false)
      }
    }
    void check()
    return () => { cancelled = true }
  }, [eventId, standId])

  const load = useCallback(async () => {
    if (!standId) return
    try {
      const res = await fetchStandKioskRecent(standId, eventId, window.location.origin)
      setKiosk(res)
    } catch { /* ignore */ }
  }, [standId, eventId])

  useEffect(() => {
    if (!isActive || !standId) return
    void load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isActive, standId, load])

  useEffect(() => {
    if (!eventId) return
    apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
      .then((res) => setEventName(res.item.name))
      .catch(() => {})
  }, [eventId])

  const activate = () => {
    if (!storageKey) return
    localStorage.setItem(storageKey, '1')
    setIsActive(true)
  }

  const deactivate = () => {
    if (!storageKey) return
    localStorage.removeItem(storageKey)
    setIsActive(false)
  }

  if (checkingAuth) {
    return <div className={styles.page}><div className={styles.center}>Caricamento…</div></div>
  }

  if (!authorized) {
    return (
      <div className={styles.page}>
        <div className={styles.lockCard}>
          <div className={styles.lockIcon}>&#128274;</div>
          <h1 className={styles.lockTitle}>Chiosco non attivato</h1>
          <p className={styles.lockHint}>Solo un amministratore dello stand, dell'evento o della piattaforma può attivare questo chiosco.</p>
        </div>
      </div>
    )
  }

  if (!isActive) {
    return (
      <div className={styles.page}>
        <div className={styles.lockCard}>
          <div className={styles.kioskIcon}>&#128421;&#65039;</div>
          <h1 className={styles.lockTitle}>Chiosco ordini</h1>
          <p className={styles.lockHint}>
            Attiva la postazione su questo browser: mostrerà il QR dell'ultimo ordine emesso. I clienti inquadrandolo apriranno una pagina di monitoraggio del proprio ordine.
          </p>
          <button type="button" className={styles.activateBtn} onClick={activate}>
            Attiva chiosco su questo browser
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          {eventName && <span className={styles.eventName}>{eventName}</span>}
          <span className={styles.standName}>{kiosk?.standName ?? 'Stand'}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.queueBadge} ${(kiosk?.queueCount ?? 0) > 0 ? styles.queueBadgeActive : ''}`}>
            {kiosk?.queueCount ?? 0} ordini in coda
          </span>
          <button type="button" className={styles.deactivateBtn} onClick={deactivate}>
            Disattiva chiosco
          </button>
        </div>
      </header>

      {!kiosk || !kiosk.order || !kiosk.qrCode ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>&#128203;</div>
          <p className={styles.emptyText}>Nessun ordine in attesa</p>
          <p className={styles.emptyHint}>Il QR del prossimo ordine apparirà qui.</p>
        </div>
      ) : (
        <div className={styles.kioskCard}>
          <div className={styles.qrCol}>
            <img src={kiosk.qrCode} alt="QR code monitoraggio ordine" className={styles.qr} />
            <p className={styles.qrHint}>Inquadra per seguire il tuo ordine</p>
          </div>
          <div className={styles.infoCol}>
            <span className={`${styles.orderNumber} ${kiosk.order.isGift ? styles.orderNumberGift : ''}`}>
              {kiosk.order.isGift ? 'O' : '#'}{kiosk.order.orderNumber}
            </span>
            <span className={styles.statusBadge}>{statusLabels[kiosk.order.status] ?? kiosk.order.status}</span>
            {kiosk.order.isGift && <span className={styles.giftBadge}>OMAGGIO</span>}
            <ul className={styles.items}>
              {kiosk.order.items.map((item, idx) => (
                <li key={idx} className={styles.itemRow}>
                  <span className={styles.itemQty}>x{item.quantity}</span>
                  <span className={styles.itemName}>{item.productName}</span>
                  <span className={styles.itemStation}>{item.stationName}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <footer className={styles.footer}>
        <span className={styles.footerText}>Inquadra il QR code per monitorare il tuo ordine dal telefono.</span>
      </footer>
    </div>
  )
}