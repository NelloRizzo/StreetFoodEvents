import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { fetchStandDisplayOrders, type StandDisplayData } from '../lib/orders'
import { useEventTheme } from '../features/theme/useEventTheme'
import styles from './StandDisplayPage.module.scss'

const statusLabels: Record<string, string> = {
  confirmed: 'Confermato',
  preparing: 'In preparazione',
  ready: 'Pronto',
}

export function StandDisplayPage() {
  const { eventId, standId } = useParams<{ eventId: string; standId: string }>()
  const [data, setData] = useState<StandDisplayData | null>(null)
  const [eventName, setEventName] = useState('')

  useEventTheme(null)

  const load = useCallback(async () => {
    if (!standId) return
    try {
      const res = await fetchStandDisplayOrders(standId, eventId)
      setData(res)
    } catch { /* ignore */ }
  }, [standId, eventId])

  useEffect(() => {
    void load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!eventId) return
    apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
      .then((res) => setEventName(res.item.name))
      .catch(() => {})
  }, [eventId])

  const orders = data?.items ?? []

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {eventName && <span className={styles.eventName}>{eventName}</span>}
          <span className={styles.standName}>{data?.standName ?? 'Stand'}</span>
        </div>
        <span className={styles.headerHint}>Stato ordini</span>
      </header>

      {orders.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>&#128203;</div>
          <p className={styles.emptyText}>Nessun ordine in lavorazione</p>
          <p className={styles.emptyHint}>I prossimi ordini appariranno qui.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {orders.map((order) => {
            const allReady = order.items.length > 0 && order.items.every((i) => i.ready)
            const isReady = order.status === 'ready' || allReady
            const isPreparing = order.status === 'preparing' && !allReady

            return (
              <article
                key={order.id}
                className={`${styles.orderCard} ${isReady ? styles.orderReady : ''} ${isPreparing ? styles.orderPreparing : ''}`}
              >
                <div className={styles.orderHeader}>
                  <span className={styles.orderNumber}>#{order.orderNumber}</span>
                  <span className={`${styles.statusBadge} ${isReady ? styles.statusReady : ''}`}>
                    {isReady ? 'Pronto' : statusLabels[order.status]}
                  </span>
                </div>

                <div className={styles.items}>
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`${styles.itemRow} ${item.ready ? styles.itemReady : ''}`}
                    >
                      <span className={styles.itemQty}>x{item.quantity}</span>
                      <span className={styles.itemName}>{item.productName}</span>
                      <span className={styles.itemStation}>{item.stationName}</span>
                      {item.ready && <span className={styles.itemDone}>&#10003;</span>}
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <footer className={styles.footer}>
        <span className={styles.footerText}>
          Ritira il tuo ordine al banco quando il numero mostra &ldquo;Pronto&rdquo;
        </span>
      </footer>
    </div>
  )
}
