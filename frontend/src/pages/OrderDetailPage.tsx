import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { fetchOrder, updateOrderStatus, cancelOrder, payOrder, markStationReady, type Order } from '../lib/orders'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './OrderDetailPage.module.scss'

const statusLabels: Record<string, string> = {
  pending: 'In attesa',
  confirmed: 'Confermato',
  preparing: 'In preparazione',
  ready: 'Pronto',
  completed: 'Completato',
  cancelled: 'Annullato',
}

const nextStatus: Record<string, { status: string; label: string } | null> = {
  pending: { status: 'confirmed', label: 'Conferma ordine' },
  confirmed: { status: 'preparing', label: 'Inizia preparazione' },
  preparing: null,
  ready: { status: 'completed', label: 'Completa ordine' },
  completed: null,
  cancelled: null,
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [creditPayAmount, setCreditPayAmount] = useState(0)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)

  const load = async () => {
    if (!orderId) return
    const data = await fetchOrder(orderId)
    setOrder(data.item)
    setCreditPayAmount(data.item.total)
    setIsLoading(false)
  }

  useEffect(() => { void load() }, [orderId])

  const handleStatus = async (status: string) => {
    if (!orderId) return
    await updateOrderStatus(orderId, status)
    await load()
  }

  const handleCancel = () => {
    if (!orderId) return
    setCancelTarget(orderId)
  }

  const handlePay = async () => {
    if (!orderId) return
    await payOrder(orderId, creditPayAmount)
    await load()
  }

  const handleStationReady = async (stationId: string) => {
    if (!orderId) return
    await markStationReady(orderId, stationId)
    await load()
  }

  if (isLoading || !order) return null

  const next = nextStatus[order.status]
  const externalAmount = order.total - order.creditAmountUsed
  const totalItems = order.items.length
  const readyItems = order.items.filter((i) => i.ready).length

  const groups = new Map<string, { name: string; stationId: string; items: typeof order.items }>()
  for (const item of order.items) {
    const key = item.stationId
    if (!groups.has(key)) {
      groups.set(key, { name: item.stationName, stationId: key, items: [] })
    }
    groups.get(key)!.items.push(item)
  }

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to="/orders" className={styles.backLink}>&larr; Torna agli ordini</Link>

        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className="eyebrow">Ordine</span>
            <h1 className={styles.title}>Ordine #{order.id.slice(-6)}</h1>
          </div>
          <div className={styles.badges}>
            <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
              {statusLabels[order.status]}
            </span>
            <span className={`${styles.paymentBadge} ${styles[`payment_${order.paymentStatus}`]}`}>
              {order.paymentStatus === 'paid' ? 'Pagato' : order.paymentStatus === 'refunded' ? 'Rimborsato' : 'Da pagare'}
            </span>
          </div>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Cliente</span>
            <span className={styles.metaValue}>{order.customerName ?? 'Anonimo'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Totale</span>
            <span className={styles.metaValue}>&euro;{order.total.toFixed(2)}</span>
          </div>
          {order.creditAmountUsed > 0 && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Pagato con crediti</span>
              <span className={styles.metaValue}>&euro;{order.creditAmountUsed.toFixed(2)}</span>
            </div>
          )}
          {externalAmount > 0 && order.paymentStatus === 'paid' && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Pagato in altro modo</span>
              <span className={styles.metaValue}>&euro;{externalAmount.toFixed(2)}</span>
            </div>
          )}
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Data</span>
            <span className={styles.metaValue}>{new Date(order.createdAt).toLocaleString('it-IT')}</span>
          </div>
          {order.status === 'preparing' && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Avanzamento</span>
              <span className={styles.metaValue}>{readyItems}/{totalItems} articoli pronti</span>
            </div>
          )}
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Articoli</h2>
          {Array.from(groups.entries()).map(([key, group]) => {
            const groupReady = group.items.every((i) => i.ready)
            return (
              <div key={key} className={`${styles.stationGroup} ${groupReady ? styles.stationGroupReady : ''}`}>
                <div className={styles.stationHeader}>
                  <h3 className={styles.stationTitle}>{group.name}</h3>
                  {order.status === 'preparing' && (
                    <span className={styles.stationReadyBadge}>
                      {group.items.filter((i) => i.ready).length}/{group.items.length}
                    </span>
                  )}
                </div>
                <div className={styles.itemsList}>
                  {group.items.map((item, idx) => (
                    <div key={idx} className={`${styles.itemRow} ${item.ready ? styles.itemReady : ''}`}>
                      <div className={styles.itemInfo}>
                        <strong>{item.productName}</strong>
                        <span className={styles.itemDetail}>
                          &euro;{item.unitPrice.toFixed(2)} x {item.quantity}
                        </span>
                      </div>
                      <div className={styles.itemRight}>
                        <span className={styles.itemSubtotal}>&euro;{item.subtotal.toFixed(2)}</span>
                        {item.ready && <span className={styles.readyMark}>&#10003;</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {order.status === 'preparing' && !groupReady && (
                  <button
                    className={styles.stationReadyBtn}
                    onClick={() => handleStationReady(group.stationId)}
                  >
                    Pronto
                  </button>
                )}
              </div>
            )
          })}
        </section>

        {order.notes && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Note</h2>
            <p className={styles.notes}>{order.notes}</p>
          </section>
        )}

        {order.cancelReason && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Motivo annullamento</h2>
            <p className={styles.notes}>{order.cancelReason}</p>
          </section>
        )}

        <section className={styles.actions}>
          {next && (
            <button className={styles.primaryBtn} onClick={() => handleStatus(next.status)}>
              {next.label}
            </button>
          )}

          {order.paymentStatus === 'unpaid' && (
            <div className={styles.paySection}>
              <h3 className={styles.payTitle}>Paga ordine</h3>
              <div className={styles.payRow}>
                <div className={styles.payField}>
                  <label>Crediti da usare (&euro;)</label>
                  <input
                    type="number"
                    min={0}
                    max={order.total}
                    step={0.01}
                    value={creditPayAmount}
                    onChange={(e) => setCreditPayAmount(Number(e.target.value))}
                  />
                </div>
                <button className={styles.primaryBtn} onClick={handlePay}>
                  Paga
                </button>
              </div>
              {creditPayAmount < order.total && (
                <p className={styles.payHint}>
                  &euro;{creditPayAmount.toFixed(2)} con crediti + &euro;{(order.total - creditPayAmount).toFixed(2)} in altro modo
                </p>
              )}
              {creditPayAmount === 0 && (
                <p className={styles.payHint}>Nessun credito usato — pagamento esterno</p>
              )}
            </div>
          )}

          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <button className={styles.dangerBtn} onClick={handleCancel}>
              Annulla ordine
            </button>
          )}
        </section>
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
    </div>
  )
}
