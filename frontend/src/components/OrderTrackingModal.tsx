import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '../lib/api'
import { fetchStandKioskRecent, type KioskState } from '../lib/orders'
import { onOrderCreated, onTrackingClear } from '../lib/tracking'
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
}

export function OrderTrackingModal({ open, eventId, standId, variant = 'standalone' }: OrderTrackingModalProps) {
  const [stands, setStands] = useState<StandLite[]>([])
  const [selectedStandId, setSelectedStandId] = useState(standId ?? '')
  const [kiosk, setKiosk] = useState<KioskState | null>(null)
  const [active, setActive] = useState(variant === 'inline')
  const baselineRef = useRef<number | null>(null)
  const clearedAtRef = useRef(0)

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
    setActive(variant === 'inline')
    baselineRef.current = null
    clearedAtRef.current = 0
  }, [selectedStandId, variant])

  const load = useCallback(async () => {
    if (!selectedStandId) return
    const startedAt = Date.now()
    try {
      const res = await fetchStandKioskRecent(selectedStandId, eventId, window.location.origin)
      const orderNumber = res.order ? Number(res.order.orderNumber) : 0
      if (variant === 'inline') {
        setKiosk(res)
        if (res.order) setActive(true)
        return
      }
      if (baselineRef.current === null) {
        baselineRef.current = orderNumber
        return
      }
      if (res.order && orderNumber > baselineRef.current) {
        baselineRef.current = orderNumber
        if (clearedAtRef.current > startedAt) return
        setKiosk(res)
        setActive(true)
      }
    } catch {
      /* ignorato */
    }
  }, [selectedStandId, eventId, variant])

  useEffect(() => {
    if (!open || !selectedStandId) return
    baselineRef.current = null
    setActive(false)
    setKiosk(null)
    void load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [open, selectedStandId, load])

  useEffect(() => {
    if (!open) return
    return onOrderCreated((event) => {
      if (event.eventId !== eventId) return
      if (selectedStandId && event.standId !== selectedStandId) return
      void load()
    })
  }, [open, eventId, selectedStandId, load])

  useEffect(() => {
    if (!open) return
    return onTrackingClear((event) => {
      if (event.eventId !== eventId) return
      if (selectedStandId && event.standId !== selectedStandId) return
      clearedAtRef.current = Date.now()
      setKiosk(null)
      setActive(false)
    })
  }, [open, eventId, selectedStandId])

  const dismiss = useCallback(() => {
    clearedAtRef.current = Date.now()
    setKiosk(null)
    setActive(false)
  }, [])

  useEffect(() => {
    if (!open || variant !== 'standalone' || !active) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [open, variant, active, dismiss])

  if (!open) return null

  const hasOrder = Boolean(kiosk?.order && kiosk.qrCode)
  if (variant === 'standalone' && selectedStandId && !active) return null
  if (variant === 'inline' && !hasOrder) return null

  const card = (
    <div className={styles.card} onClick={(e) => e.stopPropagation()}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Tracking ordine</span>
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
      ) : (
        <>
          {(kiosk?.standLogo || kiosk?.standName) && (
            <div className={styles.standIdentity}>
              {kiosk?.standLogo && (
                <img src={kiosk.standLogo} alt="" className={styles.standLogo} />
              )}
              {kiosk?.standNumber && (
                <span className={`${styles.standNumber} ${kiosk.standLogo ? styles.standNumberInline : ''}`}>
                  {kiosk.standNumber}
                </span>
              )}
              <span className={styles.standName}>{kiosk?.standName ?? 'Stand'}</span>
            </div>
          )}
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
      )}
    </div>
  )

  if (variant === 'inline') return card

  return (
    <div className={styles.overlay} onClick={dismiss}>
      {card}
    </div>
  )
}