import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Navigate } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'
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
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get('eventId') ?? undefined
  const extraStations = searchParams.get('stations') ?? ''
  const { isAuthenticated, isLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [stationNames, setStationNames] = useState<Record<string, string>>({})
  const prevOrderIdsRef = useRef<Set<string>>(new Set())

  const stationIds = useMemo(() => {
    const ids: string[] = []
    if (stationId) ids.push(stationId)
    for (const id of extraStations.split(',')) {
      const clean = id.trim()
      if (clean) ids.push(clean)
    }
    return [...new Set(ids)]
  }, [stationId, extraStations])

  const stationKey = stationIds.join(',')

  useEffect(() => {
    const missing = stationIds.filter((id) => !stationNames[id])
    if (missing.length === 0) return
    Promise.all(
      missing.map((id) =>
        apiRequest<{ item: { name: string } }>(`/stations/${id}`)
          .then((r) => ({ id, name: r.item.name }))
          .catch(() => ({ id, name: 'Postazione' })),
      ),
    ).then((list) => {
      setStationNames((prev) => {
        const next = { ...prev }
        for (const s of list) next[s.id] = s.name
        return next
      })
    })
  }, [stationKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!stationKey) return
    try {
      const data = await fetchOrders({ stationId: stationKey, status: 'preparing', eventId })

      const currentIds = new Set(data.items.map((o) => o.id))
      const prevIds = prevOrderIdsRef.current
      if (prevIds.size > 0) {
        const hasNew = data.items.some((o) => !prevIds.has(o.id))
        if (hasNew) playBeep()
      }
      prevOrderIdsRef.current = currentIds

      setOrders(data.items)
    } catch { /* ignore */ }
  }, [stationKey, eventId])

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

  const isEmpty = stationIds.every(
    (sid) => !orders.some((o) => o.items.some((i) => i.stationId === sid && !i.ready)),
  )

  return (
    <div className={styles.page}>
      <div className={styles.queue}>
        {stationIds.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>&#10003;</div>
            <p className={styles.emptyText}>Nessuna postazione</p>
          </div>
        )}

        {stationIds.length === 1 && isEmpty && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>&#10003;</div>
            <p className={styles.emptyText}>Tutti i prodotti sono pronti</p>
            <p className={styles.emptyHint}>In attesa di nuovi ordini...</p>
          </div>
        )}

        {stationIds.map((sid) => {
          const visibleOrders = orders.filter((o) =>
            o.items.some((i) => i.stationId === sid && !i.ready),
          )

          return (
            <section key={sid} className={styles.stationSection}>
              <h1 className={styles.stationTitle}>
                {stationNames[sid] ?? 'Postazione'}
              </h1>

              {visibleOrders.length === 0 && (
                <div className={styles.stationEmpty}>
                  <span className={styles.stationEmptyText}>Tutti i prodotti sono pronti</span>
                  <span className={styles.stationEmptyHint}>In attesa di nuovi ordini...</span>
                </div>
              )}

              {visibleOrders.map((order) => {
                const stationItems = order.items.filter((i) => i.stationId === sid)

                return (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderNumber}>#{order.orderNumber}</div>

                    {order.notes && <div className={styles.orderNote}>{order.notes}</div>}

                    <div className={styles.items}>
                      {stationItems.map((item, idx) => (
                        <div
                          key={idx}
                          className={`${styles.itemRow} ${item.ready ? styles.itemReady : ''}`}
                        >
                          <div className={styles.itemInfo}>
                            <span className={styles.itemName}>
                              {item.productName}
                            </span>
                            {item.notes && <span className={styles.itemNote}>{item.notes}</span>}
                          </div>
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
            </section>
          )
        })}
      </div>
    </div>
  )
}
