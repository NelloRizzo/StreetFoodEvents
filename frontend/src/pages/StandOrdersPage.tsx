import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import type { UploadedImage } from '../lib/upload'
import {
  fetchOrders,
  fetchStandReport,
  updateOrderStatus,
  cancelOrder,
  cancelOrderItems,
  resetOrderCounter,
  deleteStandOrders,
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
  const { standId, eventId: urlEventId } = useParams<{ standId: string; eventId?: string }>()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [events, setEvents] = useState<{ id: string; name: string; currencyName: string; currencySymbol: UploadedImage | null }[]>([])
  const effectiveEventId = urlEventId ?? ''
  const [standName, setStandName] = useState('')
  const [eventName, setEventName] = useState('')
  const [partialOrderId, setPartialOrderId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [report, setReport] = useState<StandReport | null>(null)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  useEffect(() => {
    if (!standId) return
    const checkAccess = async () => {
      try {
        const { stands } = await apiRequest<{ stands: { id: string; name: string }[] }>('/auth/me/stands')
        const found = stands.find((s) => s.id === standId)
        if (!found) { setForbidden(true); setIsLoading(false); return }
        setStandName(found.name)
        if (urlEventId) {
          try {
            const ev = await apiRequest<{ item: { name: string } }>(`/events/${urlEventId}`)
            setEventName(ev.item.name)
          } catch {}
        }
      } catch { setForbidden(true); setIsLoading(false) }
    }
    checkAccess()
  }, [standId, urlEventId])

  const load = useCallback(async () => {
    if (!standId) return
    const params: Record<string, string> = { standId, startDate, endDate }
    if (filterStatus) params.status = filterStatus
    if (effectiveEventId) params.eventId = effectiveEventId
    const data = await fetchOrders(params)
    const filtered = filterStatus
      ? data.items
      : data.items.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
    setOrders(filtered)
    setIsLoading(false)
  }, [standId, filterStatus, effectiveEventId, startDate, endDate])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!standId) return
    fetchStandReport(standId, effectiveEventId || undefined, startDate, endDate)
      .then((r) => setReport(r))
      .catch(() => {})
  }, [standId, effectiveEventId, startDate, endDate])

  useEffect(() => {
    if (!urlEventId) {
      apiRequest<{ items: { id: string; name: string; currencyName: string; currencySymbol: UploadedImage | null }[] }>('/events')
        .then((d) => setEvents(d.items))
        .catch(() => {})
    }
  }, [urlEventId])

  const handleComplete = async (orderId: string) => {
    await updateOrderStatus(orderId, 'completed')
    await load()
  }

  const handleReady = async (orderId: string) => {
    await updateOrderStatus(orderId, 'ready')
    await load()
  }

  const handleCancel = (orderId: string) => {
    setCancelTarget(orderId)
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
    setConfirmReset(true)
  }

  if (isLoading) return null
  if (forbidden) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  if (!standId) return null

  const title = urlEventId && eventName ? `Ordini — ${eventName}` : 'Ordini dello stand'
  const newOrderLink = urlEventId
    ? `/admin/events/${urlEventId}/stands/${standId}/order`
    : ''

  const currencyFor = (eventId: string) => {
    const ev = events.find((e) => e.id === eventId)
    if (ev) return ev
    if (report && report.eventId === eventId) return report
    return null
  }

  const CurrencyAmount = ({ eventId, value }: { eventId: string; value: number }) => {
    const cur = currencyFor(eventId)
    if (!cur) return <>&euro;{value.toFixed(2)}</>
    return (
      <>
        <CurrencyDisplay currencyName={cur.currencyName} currencySymbol={cur.currencySymbol} />
        &nbsp;{value.toFixed(2)}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            {standName && <span className={styles.standLabel}>{standName}</span>}
          </div>
          <div className={styles.headerActions}>
            {newOrderLink ? (
              <Link className={styles.primaryBtn} to={newOrderLink}>
                Nuovo ordine
              </Link>
            ) : (
              <button className={styles.primaryBtn} disabled title="Seleziona un evento prima di creare un ordine">
                Nuovo ordine
              </button>
            )}
            {urlEventId && (
              <Link
                className={styles.secondaryBtn}
                to={`/events/${urlEventId}/stands/${standId}/ordersqueue`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Coda Ordini
              </Link>
            )}
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
            <button className={styles.dangerBtn} onClick={() => setConfirmDeleteAll(true)}>
              Cancella tutti gli ordini
            </button>
          </div>
        </div>

        {report && (
          <div className={styles.reportCard}>
            <div className={styles.reportHeader}>
              <span className={styles.reportTitle}>Riepilogo</span>
              <span className={styles.reportPeriod}>{new Date(startDate + 'T00:00:00').toLocaleDateString('it-IT')} &rarr; {new Date(endDate + 'T00:00:00').toLocaleDateString('it-IT')}</span>
            </div>
            <div className={styles.reportStats}>
              <div className={styles.reportStat}>
                <span className={styles.reportStatValue}>{report.summary.totalOrders}</span>
                <span className={styles.reportStatLabel}>Ordini</span>
              </div>
              <div className={styles.reportStat}>
                <span className={styles.reportStatValue}>&euro;{(report.summary.totalRevenue / (report.exchangeRate ?? 1)).toFixed(2)}</span>
                <span className={styles.reportStatLabel}>Ricavi</span>
              </div>
              <div className={styles.reportStat}>
                <span className={styles.reportStatValue}>&euro;{(report.summary.totalCreditRevenue / (report.exchangeRate ?? 1)).toFixed(2)}</span>
                <span className={styles.reportStatLabel}>Crediti</span>
              </div>
              <div className={styles.reportStat}>
                <span className={styles.reportStatValue}>&euro;{(report.summary.totalExternalRevenue / (report.exchangeRate ?? 1)).toFixed(2)}</span>
                <span className={styles.reportStatLabel}>Esterni</span>
              </div>
              {report.summary.totalRefunded > 0 && (
                <div className={styles.reportStat}>
                  <span className={`${styles.reportStatValue} ${styles.reportRefunded}`}>
                    &euro;{(report.summary.totalRefunded / (report.exchangeRate ?? 1)).toFixed(2)}
                  </span>
                  <span className={styles.reportStatLabel}>Rimborsati</span>
                </div>
              )}
              {report.summary.giftOrders > 0 && (
                <div className={styles.reportStat}>
                  <span className={`${styles.reportStatValue} ${styles.reportGift}`}>{report.summary.giftOrders}</span>
                  <span className={styles.reportStatLabel}>Ordini omaggio</span>
                </div>
              )}
              {report.summary.giftProducts > 0 && (
                <div className={styles.reportStat}>
                  <span className={`${styles.reportStatValue} ${styles.reportGift}`}>{report.summary.giftProducts}</span>
                  <span className={styles.reportStatLabel}>Prodotti omaggio</span>
                </div>
              )}
            </div>
          </div>
        )}

        {report && report.pendingOrders.length > 0 && (
          <div className={styles.reportCard}>
            <div className={styles.reportHeader}>
              <span className={styles.reportTitle}>Ordini in sospeso (non pagati/completati)</span>
              <span className={styles.reportPeriod}>{report.pendingOrders.length} ordini</span>
            </div>
            <div className={styles.pendingList}>
              {report.pendingOrders.map((o) => (
                <div key={o.id} className={styles.pendingRow}>
                  <span className={styles.pendingNumber}>
                    {o.isGift && <span className={styles.giftPrefix}>O</span>}#{o.orderNumber}
                  </span>
                  <span className={styles.pendingCustomer}>{o.customerName ?? 'Anonimo'}</span>
                  <span className={styles.pendingTotal}><CurrencyAmount eventId={o.eventId} value={o.total} /></span>
                  <span className={`${styles.statusBadge} ${styles[`status_${o.status}`]}`}>
                    {statusLabels[o.status] ?? o.status}
                  </span>
                  <span className={`${styles.paymentBadge} ${styles[`payment_${o.paymentStatus}`]}`}>
                    {o.paymentStatus === 'paid' ? 'Pagato' : o.paymentStatus === 'refunded' ? 'Rimborsato' : 'Da pagare'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report && report.productQuantities.length > 0 && (
          <div className={styles.reportCard}>
            <div className={styles.reportHeader}>
              <span className={styles.reportTitle}>Quantitativi prodotti venduti</span>
              <span className={styles.reportPeriod}>{new Date(startDate + 'T00:00:00').toLocaleDateString('it-IT')} &rarr; {new Date(endDate + 'T00:00:00').toLocaleDateString('it-IT')}</span>
            </div>
            <div className={styles.reportTableWrap}>
              <table className={styles.reportTable}>
                <thead>
                  <tr>
                    <th>Prodotto</th>
                    <th className={styles.reportNum}>Quantit&agrave;</th>
                    <th className={styles.reportNum}>Omaggi</th>
                    <th className={styles.reportNum}>Ricavi</th>
                  </tr>
                </thead>
                <tbody>
                  {report.productQuantities.map((p) => (
                    <tr key={p.productId}>
                      <td className={styles.reportProduct}>{p.productName}</td>
                      <td className={styles.reportNum}>{p.quantity}</td>
                      <td className={styles.reportNum}>{p.giftQuantity}</td>
                      <td className={styles.reportNum}>&euro;{(p.revenue / (report.exchangeRate ?? 1)).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className={styles.reportTotalRow}>
                    <td>TOTALE</td>
                    <td className={styles.reportNum}>
                      {report.productQuantities.reduce((sum, p) => sum + p.quantity, 0)}
                    </td>
                    <td className={styles.reportNum}>
                      {report.productQuantities.reduce((sum, p) => sum + p.giftQuantity, 0)}
                    </td>
                    <td className={styles.reportNum}>
                      &euro;{(report.productQuantities.reduce((sum, p) => sum + p.revenue, 0) / (report.exchangeRate ?? 1)).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
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
            const orderEventName = events.find((e) => e.id === order.eventId)?.name

            return (
              <article key={order.id} className={`${styles.orderCard} ${allReady && order.status === 'preparing' ? styles.orderCardAllReady : ''}`}>
                <div className={styles.orderHeader}>
                  <div className={styles.orderNumber}>
                    {order.isGift && <span className={styles.giftPrefix}>O</span>}#{order.orderNumber}
                  </div>
                  <div className={styles.orderBadges}>
                    {order.isGift && (
                      <span className={styles.giftBadge}>OMAGGIO</span>
                    )}
                    {!effectiveEventId && orderEventName && (
                      <span className={styles.orderEvent}>{orderEventName}</span>
                    )}
                    {order.customerName && (
                      <span className={styles.customerName}>{order.customerName}</span>
                    )}
                    <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
                      {statusLabels[order.status]}
                    </span>
                    <span className={`${styles.paymentBadge} ${styles[`payment_${order.paymentStatus}`]}`}>
                      {order.paymentStatus === 'paid' ? 'Pagato' : order.paymentStatus === 'refunded' ? 'Rimborsato' : 'Da pagare'}
                    </span>
                    <span className={styles.orderTotal}><CurrencyAmount eventId={order.eventId} value={order.total} /></span>
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
                  <Link className={styles.textBtn} to={`/receipt/${order.id}`} target="_blank" rel="noopener noreferrer">
                    Ricevuta
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <ConfirmModal
        open={cancelTarget !== null}
        variant="prompt"
        title="Annullare ordine?"
        message="Inserisci un motivo opzionale."
        confirmLabel="Annulla ordine"
        danger
        onConfirm={async (reason) => {
          if (!cancelTarget) return
          await cancelOrder(cancelTarget, reason || undefined)
          setCancelTarget(null)
          await load()
        }}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmModal
        open={confirmReset}
        variant="confirm"
        title="Azzerare contatore?"
        message="Gli ordini esistenti manterranno il loro numero."
        danger
        confirmLabel="Azzera"
        onConfirm={async () => {
          if (!standId) return
          await resetOrderCounter(standId)
          setConfirmReset(false)
        }}
        onCancel={() => setConfirmReset(false)}
      />

      <ConfirmModal
        open={confirmDeleteAll}
        variant="confirm"
        title="Cancellare tutti gli ordini?"
        message="Tutti gli ordini di questo stand verranno eliminati definitivamente. Operazione irreversibile."
        danger
        confirmLabel="Cancella tutto"
        onConfirm={async () => {
          if (!standId) return
          await deleteStandOrders(standId)
          setConfirmDeleteAll(false)
          await load()
          setReport(null)
        }}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  )
}
