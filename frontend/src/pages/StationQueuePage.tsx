import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { fetchOrders, markItemReady, type Order } from '../lib/orders'
import styles from './StationQueuePage.module.scss'

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch { /* ignore */ }
}

export function StationQueuePage() {
  const { stationId } = useParams<{ stationId: string }>()
  const { isAuthenticated, isLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const prevOrderIdsRef = useRef<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!stationId) return
    try {
      const data = await fetchOrders({ stationId, status: 'preparing' })

      const currentIds = new Set(data.items.map((o) => o.id))
      const prevIds = prevOrderIdsRef.current
      if (prevIds.size > 0) {
        const hasNew = data.items.some((o) => !prevIds.has(o.id))
        if (hasNew) playBeep()
      }
      prevOrderIdsRef.current = currentIds

      setOrders(data.items)
    } catch { /* ignore */ }
  }, [stationId])

  useEffect(() => {
    void load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  const handleItemReady = async (orderId: string, eventProductId: string) => {
    try {
      await markItemReady(orderId, eventProductId)
      void load()
    } catch { /* ignore */ }
  }

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!stationId) return null

  const visibleOrders = orders.filter((o) =>
    o.items.some((i) => i.stationId === stationId && !i.ready),
  )

  return (
    <div className={styles.page}>
      <div className={styles.queue}>
        {visibleOrders.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>&#10003;</div>
            <p className={styles.emptyText}>Tutti i prodotti sono pronti</p>
            <p className={styles.emptyHint}>In attesa di nuovi ordini...</p>
          </div>
        )}

        {visibleOrders.map((order) => {
          const stationItems = order.items.filter(
            (i) => i.stationId === stationId,
          )

          return (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderNumber}>#{order.orderNumber}</div>

              <div className={styles.items}>
                {stationItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`${styles.itemRow} ${item.ready ? styles.itemReady : ''}`}
                  >
                    <span className={styles.itemName}>
                      {item.productName}
                    </span>
                    <span className={styles.itemQty}>x{item.quantity}</span>
                    {item.ready ? (
                      <span className={styles.doneBadge}>&#10003;</span>
                    ) : (
                      <button
                        className={styles.readyBtn}
                        onClick={() => handleItemReady(order.id, item.eventProductId)}
                      >
                        Pronto
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
