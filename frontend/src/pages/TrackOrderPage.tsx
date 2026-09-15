import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { fetchOrderTrack, type OrderTrack } from '../lib/orders'
import styles from './TrackOrderPage.module.scss'

const POLL_INTERVAL_MS = 5000

const statusText: Record<string, string> = {
  pending: 'Ordine ricevuto — in attesa di conferma',
  confirmed: 'Ordine confermato — in preparazione',
  preparing: 'Il tuo ordine è in preparazione',
  ready: 'Il tuo ordine è pronto!',
  completed: 'Ordine completato',
  cancelled: 'Ordine annullato',
}

function playReadySound() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)

    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start(start)
      osc.stop(start + dur)
    }
    tone(880, ctx.currentTime, 0.25)
    tone(1174, ctx.currentTime + 0.3, 0.4)
    tone(880, ctx.currentTime + 0.8, 0.25)
    tone(1174, ctx.currentTime + 1.1, 0.4)
  } catch { /* noop */ }
}

function notifyReady(orderNumber: number, standName: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification('Il tuo ordine è pronto!', {
      body: standName ? `Ordine n° ${orderNumber} — ${standName}` : `Ordine n° ${orderNumber}`,
      tag: `sfe-order-${orderNumber}`,
    })
  } catch { /* noop */ }
}

export function TrackOrderPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<OrderTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notifsEnabled, setNotifsEnabled] = useState(() => 'Notification' in window && Notification.permission === 'granted')
  const prevStatusRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await fetchOrderTrack(orderId)
      setOrder(res.item)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ordine non trovato')
    }
  }, [orderId])

  useEffect(() => {
    void load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!order) return
    const prev = prevStatusRef.current
    prevStatusRef.current = order.status
    if (prev !== order.status && order.status === 'ready') {
      playReadySound()
      notifyReady(order.orderNumber, order.standName ?? '')
    }
  }, [order])

  const enableNotifications = () => {
    if (!('Notification' in window)) return
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') setNotifsEnabled(true)
    })
  }

  if (error && !order) {
    return (
      <div className={styles.page}>
        <div className={styles.center}>
          <div className={styles.sadIcon}>&#128533;</div>
          <h1 className={styles.bigTitle}>Ordine non trovato</h1>
          <p className={styles.hint}>Controlla il QR code o torna al banco dello stand.</p>
          <Link to="/" className={styles.homeLink}>Torna alla home</Link>
        </div>
      </div>
    )
  }

  if (!order) {
    return <div className={styles.page}><div className={styles.center}>Caricamento ordine…</div></div>
  }

  const isReady = order.status === 'ready'
  const isDone = order.status === 'completed'
  const isCancelled = order.status === 'cancelled'
  const inProgress = ['pending', 'confirmed', 'preparing'].includes(order.status)

  return (
    <div className={styles.page}>
      {!notifsEnabled && (
        <button type="button" className={styles.bellBtn} onClick={enableNotifications}>
          &#128276; Abilita notifiche
        </button>
      )}

      <header className={styles.header}>
        <span className={styles.headerLabel}>{order.standName ?? 'Stand'}</span>
        {order.eventName && <span className={styles.headerEvent}>{order.eventName}</span>}
      </header>

      <div className={`${styles.body} ${isReady ? styles.bodyReady : ''}`}>
        {isReady ? (
          <div className={styles.readyBlock}>
            <div className={styles.readyIcon}>&#9989;</div>
            <h1 className={styles.readyTitle}>PRONTO!</h1>
            <p className={styles.readyOrder}>Ordine n° {order.isGift ? 'O' : '#'}{order.orderNumber}</p>
            <p className={styles.readyHint}>Ritira il tuo ordine al banco e buon appetito!</p>
          </div>
        ) : isDone ? (
          <div className={styles.centerBox}>
            <div className={styles.doneIcon}>&#127881;</div>
            <h1 className={styles.statusTitle}>Ordine completato</h1>
            <p className={styles.statusOrder}>Ordine n° {order.isGift ? 'O' : '#'}{order.orderNumber}</p>
          </div>
        ) : isCancelled ? (
          <div className={styles.centerBox}>
            <div className={styles.sadIcon}>&#128683;</div>
            <h1 className={styles.statusTitle}>Ordine annullato</h1>
            <p className={styles.statusOrder}>Ordine n° {order.isGift ? 'O' : '#'}{order.orderNumber}</p>
          </div>
        ) : (
          <div className={styles.progressBlock}>
            <div className={styles.spinner}>&#128721;</div>
            <h1 className={styles.statusTitle}>{inProgress ? 'In lavorazione' : 'Ordine registrato'}</h1>
            <p className={styles.statusOrder}>Ordine n° {order.isGift ? 'O' : '#'}{order.orderNumber}</p>
            <p className={styles.statusText}>{statusText[order.status] ?? 'Stato in aggiornamento…'}</p>
            <p className={styles.readyHint}>Ti avviseremo quando è pronto.</p>
          </div>
        )}
      </div>

      <section className={styles.receipt}>
        <h2 className={styles.receiptTitle}>Cosa hai ordinato</h2>
        <ul className={styles.items}>
          {order.items.map((item, idx) => (
            <li key={idx} className={styles.itemRow}>
              <span className={styles.itemQty}>x{item.quantity}</span>
              <span className={styles.itemName}>{item.productName}</span>
              <span className={styles.itemStation}>{item.stationName}</span>
            </li>
          ))}
        </ul>
        <p className={styles.thanks}>Grazie e a presto! &#128578;</p>
      </section>
    </div>
  )
}