import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { fetchStandKioskRecent, type KioskState } from '../lib/orders'
import styles from './OrderTrackingModal.module.scss'

const POLL_INTERVAL_MS = 5000

const statusLabels: Record<string, string> = {
  confirmed: 'Confermato — in preparazione',
  preparing: 'In preparazione',
  ready: 'Pronto',
}

type StandLite = { id: string; name: string }

type OrderTrackingModalProps = {
  open: boolean
  eventId: string
  standId?: string
  variant?: 'standalone' | 'inline'
  onClose?: () => void
}

export function OrderTrackingModal({ open, eventId, standId, variant = 'standalone', onClose }: OrderTrackingModalProps) {
  const [stands, setStands] = useState<StandLite[]>([])
  const [selectedStandId, setSelectedStandId] = useState(standId ?? '')
  const [kiosk, setKiosk] = useState<KioskState | null>(null)

  useEffect(() => {
    if (standId) setSelectedStandId(standId)
  }, [standId])

  useEffect(() => {
    if (standId || !open) return
    let cancelled = false
    apiRequest<{ items: StandLite[] }>(`/stands?eventId=${eventId}`)
      .then((res) => { if (!cancelled) setStands(res.items) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [standId, eventId, open])

  useEffect(() => {
    setKiosk(null)
  }, [selectedStandId])

  const load = useCallback(async () => {
    if (!selectedStandId) return
    try {
      const res = await fetchStandKioskRecent(selectedStandId, eventId, window.location.origin)
      setKiosk(res)
    } catch {
      /* ignorato */
    }
  }, [selectedStandId, eventId])

  useEffect(() => {
    if (!open || !selectedStandId) return
    void load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [open, selectedStandId, load])

  useEffect(() => {
    if (!open || variant !== 'standalone' || !onClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [open, variant, onClose])

  if (!open) return null

  const hasOrder = Boolean(kiosk?.order && kiosk.qrCode)

  const card = (
    <div className={styles.card} onClick={(e) => e.stopPropagation()}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Tracking ordine</span>
        {variant === 'standalone' && onClose && (
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Chiudi">×</button>
        )}
      </div>

      {!selectedStandId ? (
        <div className={styles.standPicker}>
          <label className={styles.standLabel} htmlFor="tracking-stand">Stand</label>
          <select
            id="tracking-stand"
            className={styles.standSelect}
            value={selectedStandId}
            onChange={(e) => setSelectedStandId(e.target.value)}
          >
            <option value="">Seleziona stand</option>
            {stands.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      ) : hasOrder ? (
        <>
          {(kiosk?.queueCount ?? 0) > 0 && (
            <span className={styles.queueBadge}>
              {kiosk!.queueCount} ordini in coda
            </span>
          )}
          <span className={`${styles.orderNumber} ${kiosk!.order!.isGift ? styles.orderNumberGift : ''}`}>
            {kiosk!.order!.isGift ? 'O' : '#'}{kiosk!.order!.orderNumber}
          </span>
          <span className={styles.statusBadge}>{statusLabels[kiosk!.order!.status] ?? kiosk!.order!.status}</span>
          {kiosk!.order!.isGift && <span className={styles.giftBadge}>OMAGGIO</span>}
          <img src={kiosk!.qrCode!} alt="QR code monitoraggio ordine" className={styles.qr} />
          <ul className={styles.items}>
            {kiosk!.order!.items.map((item, idx) => (
              <li key={idx} className={styles.itemRow}>
                <span className={styles.itemQty}>x{item.quantity}</span>
                <span className={styles.itemName}>{item.productName}</span>
                <span className={styles.itemStation}>{item.stationName}</span>
              </li>
            ))}
          </ul>
          <span className={styles.hint}>Inquadra per seguire il tuo ordine</span>
        </>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyText}>Nessun ordine in attesa</span>
          <span className={styles.emptyHint}>Il QR del prossimo ordine apparirà qui.</span>
        </div>
      )}
    </div>
  )

  if (variant === 'inline') return card

  return (
    <div className={styles.overlay} onClick={onClose}>
      {card}
    </div>
  )
}