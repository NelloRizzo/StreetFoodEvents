import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import {
  fetchOrders,
  updateOrderStatus,
  cancelOrder,
  cancelOrderItems,
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

const today = () => new Date().toISOString().split('T')[0]

type StandInfo = { id: string; name: string }

export function EventOrdersPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [stands, setStands] = useState<StandInfo[]>([])
  const [filterStandId, setFilterStandId] = useState<string>('')
  const [eventName, setEventName] = useState('')
  const [partialOrderId, setPartialOrderId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())

  useEffect(() => {
    if (!eventId) return
    const checkAccess = async () => {
      try {
        const { roles } = await apiRequest<{ roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
        const hasAccess = roles.some(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        if (!hasAccess) { setForbidden(true); setIsLoading(false); return }

        const ev = await apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
        setEventName(ev.item.name)

        const standsData = await apiRequest<{ items: StandInfo[] }>(`/stands?eventId=${eventId}`)
        setStands(standsData.items)
      } catch { setForbidden(true); setIsLoading(false) }
    }
    void checkAccess()
  }, [eventId])

  const load = useCallback(async () => {
    if (!eventId) return
    const params: Record<string, string> = { eventId, startDate, endDate }
    if (filterStatus) params.status = filterStatus
    if (filterStandId) params.standId = filterStandId
    const data = await fetchOrders(params)
    setOrders(data.items)
    setIsLoading(false)
  }, [eventId, filterStatus, filterStandId, startDate, endDate])

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

  const handlePartialCancel = async () => {
    if (!partialOrderId) return
    const ids = Array.from(selectedItemIds)
    if (ids.length === 0) return
    await cancelOrderItems(partialOrderId, ids)
    setPartialOrderId(null)
    setSelectedItemIds(new Set())
    await load()
  }

  const openPartial = (orderId: string) => {
    setPartialOrderId(orderId)
    setSelectedItemIds(new Set())
  }

  const togglePartialItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) return null
  if (forbidden) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  if (!eventId) return null

  const standMap = new Map(stands.map((s) => [s.id, s.name]))

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all'evento</Link>
            <h1 className={styles.title}>Ordini — {eventName}</h1>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.primaryBtn} to={`/events/${eventId}/cashier`}>
              Cassa unica
            </Link>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Da</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setIsLoading(true) }}
                className={styles.dateInput}
              />
              <label className={styles.dateLabel}>a</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setIsLoading(true) }}
                className={styles.dateInput}
              />
            </div>
            <select
              value={filterStandId}
              onChange={(e) => { setFilterStandId(e.target.value); setIsLoading(true) }}
              className={styles.filterSelect}
            >
              <option value="">Tutti gli stand</option>
              {stands.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
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
          </div>
        </div>

        <div className={styles.totalsBar}>
          <div className={styles.totalItem}>
            <span className={styles.totalLabel}>Ordini</span>
            <span className={styles.totalValue}>{orders.length}</span>
          </div>
          <div className={styles.totalItem}>
            <span className={styles.totalLabel}>Importo totale</span>
            <span className={styles.totalValue}>&euro;{orders.reduce((s, o) => s + o.total, 0).toFixed(2)}</span>
          </div>
          <div className={styles.totalItem}>
            <span className={styles.totalLabel}>Pagati</span>
            <span className={styles.totalValue}>&euro;{orders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0).toFixed(2)}</span>
          </div>
          <div className={styles.totalItem}>
            <span className={styles.totalLabel}>Da pagare</span>
            <span className={styles.totalValue}>&euro;{orders.filter((o) => o.paymentStatus !== 'paid').reduce((s, o) => s + o.total, 0).toFixed(2)}</span>
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

            const totalItems = order.items.length
            const readyItems = order.items.filter((i) => i.ready).length
            const allReady = totalItems > 0 && readyItems === totalItems
            const someReady = readyItems > 0 && !allReady
            const isPartialMode = partialOrderId === order.id

            return (
              <article key={order.id} className={`${styles.orderCard} ${allReady && order.status === 'preparing' ? styles.orderCardAllReady : ''}`}>
                <div className={styles.orderHeader}>
                  <div className={styles.orderNumber}>#{order.orderNumber}</div>
                  <div className={styles.orderBadges}>
                    <span className={styles.standLabel}>
                      {standMap.get(order.standId) || 'Stand sconosciuto'}
                    </span>
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

                {totalItems > 1 && (
                  <div className={styles.progressRow}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${(readyItems / totalItems) * 100}%` }}
                      />
                    </div>
                    <span className={`${styles.progressLabel} ${allReady ? styles.progressDone : ''}`}>
                      {readyItems}/{totalItems} articoli pronti
                    </span>
                  </div>
                )}

                <div className={styles.stationGroups}>
                  {Array.from(stationGroups.entries()).map(([key, group]) => {
                    const stationAllReady = group.items.length > 0 && group.items.every((i) => i.ready)
                    return (
                      <div key={key} className={`${styles.stationGroup} ${stationAllReady ? styles.stationReady : ''}`}>
                        <span className={styles.stationName}>
                          {group.name}
                          {stationAllReady && <span className={styles.stationReadyBadge}>&#10003; Pronta</span>}
                        </span>
                        <div className={styles.items}>
                          {group.items.map((item, idx) => (
                            <span key={idx} className={`${styles.item} ${item.ready ? styles.itemReady : ''}`}>
                              {item.productName} x{item.quantity}
                              {item.notes && <span className={styles.itemNote}>({item.notes})</span>}
                              {item.ready && <span className={styles.readyMark}>&#10003;</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {isPartialMode && (
                  <div className={styles.partialPanel}>
                    <p className={styles.partialTitle}>Seleziona gli articoli da annullare:</p>
                    <div className={styles.partialItems}>
                      {order.items.map((item, idx) => {
                        const itemKey = item.eventProductId
                        const checked = selectedItemIds.has(itemKey)
                        return (
                          <label key={idx} className={`${styles.partialItem} ${item.ready ? styles.partialReady : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={item.ready}
                              onChange={() => togglePartialItem(itemKey)}
                            />
                            <span>
                              {item.productName} x{item.quantity} ({item.stationName})
                              {item.notes && <span className={styles.itemNote}> {item.notes}</span>}
                              {item.ready && <span className={styles.readyMark}> &#10003;</span>}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    <div className={styles.partialActions}>
                      <button
                        className={styles.primaryBtn}
                        onClick={handlePartialCancel}
                        disabled={selectedItemIds.size === 0}
                      >
                        Conferma annullamento
                      </button>
                      <button className={styles.secondaryBtn} onClick={() => setPartialOrderId(null)}>
                        Annulla
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.orderActions}>
                  {order.status === 'preparing' && (
                    <button className={`${styles.readyBtn} ${allReady ? styles.pulseBtn : ''}`} onClick={() => handleReady(order.id)}>
                      Segna come pronto
                    </button>
                  )}
                  {order.status === 'preparing' && someReady && !isPartialMode && (
                    <button className={styles.partialBtn} onClick={() => openPartial(order.id)}>
                      Completa parziale
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
