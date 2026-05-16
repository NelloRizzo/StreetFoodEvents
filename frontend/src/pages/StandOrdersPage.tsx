import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import {
  fetchOrders,
  updateOrderStatus,
  cancelOrder,
  resetOrderCounter,
  type Order,
} from '../lib/orders'
import styles from './StandOrdersPage.module.scss'

const statusLabels: Record<string, string> = {
  pending: 'In attesa',
  confirmed: 'Confermato',
  preparing: 'In preparazione',
  ready: 'Pronto',
  completed: 'Completato',
  cancelled: 'Annullato',
}

export function StandOrdersPage() {
  const { standId } = useParams<{ standId: string }>()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterEventId, setFilterEventId] = useState<string>('')
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!standId) return
    apiRequest<{ items: { id: string; name: string }[] }>(`/stands?eventId=&_=${standId}`)
      .then(() => {
        apiRequest<{ items: { id: string; name: string }[] }>('/events')
          .then((d) => setEvents(d.items))
          .catch(() => {})
      })
      .catch(() => {})
  }, [standId])

  const load = useCallback(async () => {
    if (!standId) return
    const params: Record<string, string> = { standId }
    if (filterStatus) params.status = filterStatus
    if (filterEventId) params.eventId = filterEventId
    const data = await fetchOrders(params)
    setOrders(data.items)
    setIsLoading(false)
  }, [standId, filterStatus, filterEventId])

  useEffect(() => { void load() }, [load])

  const handleComplete = async (orderId: string) => {
    await updateOrderStatus(orderId, 'completed')
    await load()
  }

  const handleReady = async (orderId: string) => {
    await updateOrderStatus(orderId, 'ready')
    await load()
  }

  const handleCancel = async (orderId: string) => {
    const reason = prompt("Motivo dell'annullamento (opzionale):")
    await cancelOrder(orderId, reason ?? undefined)
    await load()
  }

  const handleResetCounter = async () => {
    if (!standId) return
    const ok = window.confirm('Azzerare il contatore ordini? Gli ordini esistenti manterranno il loro numero.')
    if (!ok) return
    await resetOrderCounter(standId)
    alert('Contatore azzerato.')
  }

  if (isLoading) return null
  if (!standId) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <Link to="/dashboard" className={styles.backLink}>&larr; Dashboard</Link>
            <h1 className={styles.title}>Ordini dello stand</h1>
          </div>
          <div className={styles.headerActions}>
            <select
              value={filterEventId}
              onChange={(e) => { setFilterEventId(e.target.value); setIsLoading(true) }}
              className={styles.filterSelect}
            >
              <option value="">Tutti gli eventi</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setIsLoading(true) }}
              className={styles.filterSelect}
            >
              <option value="">Tutti gli stati</option>
              <option value="pending">In attesa</option>
              <option value="confirmed">Confermati</option>
              <option value="preparing">In preparazione</option>
              <option value="ready">Pronti</option>
              <option value="completed">Completati</option>
              <option value="cancelled">Annullati</option>
            </select>
            <button className={styles.secondaryBtn} onClick={handleResetCounter}>
              Azzera contatore
            </button>
          </div>
        </div>

        {orders.length === 0 && (
          <p className={styles.empty}>Nessun ordine trovato.</p>
        )}

        <div className={styles.orderList}>
          {orders.map((order) => {
            const stationGroups = new Map<string, { name: string; items: typeof order.items }>()
            for (const item of order.items) {
              const key = item.stationId
              if (!stationGroups.has(key)) {
                stationGroups.set(key, { name: item.stationName, items: [] })
              }
              stationGroups.get(key)!.items.push(item)
            }

            return (
              <article key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <div className={styles.orderNumber}>#{order.orderNumber}</div>
                  <div className={styles.orderBadges}>
                    {order.customerName && (
                      <span className={styles.customerName}>{order.customerName}</span>
                    )}
                    <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
                      {statusLabels[order.status]}
                    </span>
                    <span className={`${styles.paymentBadge} ${styles[`payment_${order.paymentStatus}`]}`}>
                      {order.paymentStatus === 'paid' ? 'Pagato' : order.paymentStatus === 'refunded' ? 'Rimborsato' : 'Da pagare'}
                    </span>
                    <span className={styles.orderTotal}>&euro;{order.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className={styles.stationGroups}>
                  {Array.from(stationGroups.entries()).map(([key, group]) => (
                    <div key={key} className={styles.stationGroup}>
                      <span className={styles.stationName}>{group.name}</span>
                      <div className={styles.items}>
                        {group.items.map((item, idx) => (
                          <span key={idx} className={`${styles.item} ${item.ready ? styles.itemReady : ''}`}>
                            {item.productName} x{item.quantity}
                            {item.ready && <span className={styles.readyMark}>&#10003;</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.orderActions}>
                  {order.status === 'preparing' && (
                    <button className={styles.readyBtn} onClick={() => handleReady(order.id)}>
                      Segna come pronto
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button className={styles.completeBtn} onClick={() => handleComplete(order.id)}>
                      Consegna effettuata
                    </button>
                  )}
                  {!['completed', 'cancelled'].includes(order.status) && (
                    <button className={styles.dangerBtn} onClick={() => handleCancel(order.id)}>
                      Annulla
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
