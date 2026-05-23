import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import {
  fetchOrders,
  fetchStandReport,
  updateOrderStatus,
  cancelOrder,
  cancelOrderItems,
  resetOrderCounter,
  type Order,
  type StandReport,
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

export function StandOrdersPage() {
  const { standId } = useParams<{ standId: string }>()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterEventId, setFilterEventId] = useState<string>('')
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  const [partialOrderId, setPartialOrderId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [report, setReport] = useState<StandReport | null>(null)

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
    const params: Record<string, string> = { standId, startDate, endDate }
    if (filterStatus) params.status = filterStatus
    if (filterEventId) params.eventId = filterEventId
    const data = await fetchOrders(params)
    const filtered = filterStatus
      ? data.items
      : data.items.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
    setOrders(filtered)
    setIsLoading(false)
  }, [standId, filterStatus, filterEventId, startDate, endDate])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!standId) return
    fetchStandReport(standId, filterEventId || undefined, startDate, endDate)
      .then((r) => setReport(r))
      .catch(() => {})
  }, [standId, filterEventId, startDate, endDate])

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

        {report && (
          <div className={styles.reportCard}>
            <div className={styles.reportHeader}>
              <span className={styles.reportTitle}>Riepilogo</span>
              <span className={styles.reportPeriod}>{startDate} &rarr; {endDate}</span>
            </div>
            <div className={styles.reportStats}>
              <div className={styles.reportStat}>
                <span className={styles.reportStatValue}>{report.summary.totalOrders}</span>
                <span className={styles.reportStatLabel}>Ordini</span>
              </div>
              <div className={styles.reportStat}>
                <span className={styles.reportStatValue}>&euro;{report.summary.totalRevenue.toFixed(2)}</span>
                <span className={styles.reportStatLabel}>Ricavi</span>
              </div>
              <div className={styles.reportStat}>
                <span className={styles.reportStatValue}>&euro;{report.summary.totalCreditRevenue.toFixed(2)}</span>
                <span className={styles.reportStatLabel}>Crediti</span>
              </div>
              <div className={styles.reportStat}>
                <span className={styles.reportStatValue}>&euro;{report.summary.totalExternalRevenue.toFixed(2)}</span>
                <span className={styles.reportStatLabel}>Esterni</span>
              </div>
              {report.summary.totalRefunded > 0 && (
                <div className={styles.reportStat}>
                  <span className={`${styles.reportStatValue} ${styles.reportRefunded}`}>
                    &euro;{report.summary.totalRefunded.toFixed(2)}
                  </span>
                  <span className={styles.reportStatLabel}>Rimborsati</span>
                </div>
              )}
            </div>
          </div>
        )}

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
