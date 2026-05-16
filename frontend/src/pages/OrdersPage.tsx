import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { fetchOrders, payOrder, cancelOrder, updateOrderStatus, type Order } from '../lib/orders'
import styles from './OrdersPage.module.scss'

const statusLabels: Record<string, string> = {
  pending: 'In attesa',
  confirmed: 'Confermato',
  preparing: 'In preparazione',
  ready: 'Pronto',
  completed: 'Completato',
  cancelled: 'Annullato',
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterEventId, setFilterEventId] = useState('')
  const [filterStandId, setFilterStandId] = useState('')
  const [filterStationId, setFilterStationId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  const [stands, setStands] = useState<{ id: string; name: string }[]>([])
  const [stations, setStations] = useState<{ id: string; name: string; standId: string }[]>([])

  const load = async (eventId?: string, standId?: string, stationId?: string, status?: string) => {
    const params: Record<string, string> = {}
    if (eventId) params.eventId = eventId
    if (standId) params.standId = standId
    if (stationId) params.stationId = stationId
    if (status) params.status = status
    const data = await fetchOrders(Object.keys(params).length > 0 ? params : undefined)
    setOrders(data.items)
    setIsLoading(false)
  }

  useEffect(() => {
    load()
    apiRequest<{ items: { id: string; name: string }[] }>('/events')
      .then((d) => setEvents(d.items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setFilterStandId('')
    setFilterStationId('')
    setStations([])
    if (!filterEventId) {
      setStands([])
      return
    }
    apiRequest<{ items: { id: string; name: string }[] }>(`/stands?eventId=${filterEventId}`)
      .then((d) => setStands(d.items))
      .catch(() => setStands([]))
  }, [filterEventId])

  useEffect(() => {
    setFilterStationId('')
    if (!filterStandId) {
      setStations([])
      return
    }
    apiRequest<{ items: { id: string; name: string; standId: string }[] }>(`/stations?standId=${filterStandId}`)
      .then((d) => setStations(d.items))
      .catch(() => setStations([]))
  }, [filterStandId])

  const handleFilter = () => {
    setIsLoading(true)
    load(filterEventId || undefined, filterStandId || undefined, filterStationId || undefined, filterStatus || undefined)
  }

  const handlePay = async (orderId: string) => {
    await payOrder(orderId, 0)
    handleFilter()
  }

  const handleCancel = async (orderId: string) => {
    await cancelOrder(orderId)
    handleFilter()
  }

  const handleStatus = async (orderId: string, status: string) => {
    await updateOrderStatus(orderId, status)
    handleFilter()
  }

  function stationNames(items: Order['items']): string[] {
    return [...new Set(items.map((i) => i.stationName).filter(Boolean))]
  }

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Gestione</span>
            <h1 className={styles.title}>Ordini</h1>
          </div>
          <Link className={styles.primaryBtn} to="/orders/new">
            Nuovo ordine
          </Link>
        </div>

        <div className={styles.filters}>
          <select value={filterEventId} onChange={(e) => setFilterEventId(e.target.value)}>
            <option value="">Tutti gli eventi</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
          <select value={filterStandId} onChange={(e) => setFilterStandId(e.target.value)} disabled={!filterEventId}>
            <option value="">Tutti gli stand</option>
            {stands.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={filterStationId} onChange={(e) => setFilterStationId(e.target.value)} disabled={!filterStandId}>
            <option value="">Tutte le sezioni</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Tutti gli stati</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button className={styles.secondaryBtn} onClick={handleFilter}>Filtra</button>
        </div>

        <div className={styles.list}>
          {orders.map((order) => (
            <article key={order.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
                  {statusLabels[order.status] ?? order.status}
                </span>
                <span className={`${styles.paymentBadge} ${styles[`payment_${order.paymentStatus}`]}`}>
                  {order.paymentStatus === 'paid' ? 'Pagato' : order.paymentStatus === 'refunded' ? 'Rimborsato' : 'Da pagare'}
                </span>
                <span className={styles.cardTotal}>&euro;{order.total.toFixed(2)}</span>
              </div>
              <div className={styles.cardBody}>
                <strong className={styles.cardName}>
                  {order.customerName ?? 'Cliente'}
                </strong>
                <span className={styles.cardMeta}>
                  {order.items.length} articoli
                </span>
                {stationNames(order.items).length > 0 && (
                  <span className={styles.cardStations}>
                    {stationNames(order.items).join(', ')}
                  </span>
                )}
                {order.paymentStatus === 'paid' && order.creditAmountUsed > 0 && (
                  <span className={styles.cardCredit}>
                    &euro;{order.creditAmountUsed.toFixed(2)} crediti
                    {order.creditAmountUsed < order.total && (
                      <> + &euro;{(order.total - order.creditAmountUsed).toFixed(2)} altro</>
                    )}
                  </span>
                )}
              </div>
              <div className={styles.cardActions}>
                <Link className={styles.textBtn} to={`/orders/${order.id}`}>
                  Dettaglio
                </Link>
                {order.status === 'pending' && (
                  <button className={styles.textBtn} onClick={() => handleStatus(order.id, 'confirmed')}>
                    Conferma
                  </button>
                )}
                {order.status === 'confirmed' && (
                  <button className={styles.textBtn} onClick={() => handleStatus(order.id, 'preparing')}>
                    Prepara
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button className={styles.textBtn} onClick={() => handleStatus(order.id, 'ready')}>
                    Pronto
                  </button>
                )}
                {order.status === 'ready' && (
                  <button className={styles.textBtn} onClick={() => handleStatus(order.id, 'completed')}>
                    Completa
                  </button>
                )}
                {order.paymentStatus === 'unpaid' && order.status !== 'cancelled' && (
                  <button className={styles.textBtn} onClick={() => handlePay(order.id)}>
                    Paga (senza crediti)
                  </button>
                )}
                {order.status !== 'completed' && order.status !== 'cancelled' && (
                  <button className={styles.dangerBtn} onClick={() => handleCancel(order.id)}>
                    Annulla
                  </button>
                )}
              </div>
            </article>
          ))}

          {orders.length === 0 && (
            <p className={styles.empty}>Nessun ordine trovato.</p>
          )}
        </div>
      </div>
    </div>
  )
}
