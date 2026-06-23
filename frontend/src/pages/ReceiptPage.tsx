import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import styles from './ReceiptPage.module.scss'

type ReceiptData = {
  id: string
  orderNumber: number
  status: string
  eventName: string
  standName: string
  standId: string
  items: { productName: string; quantity: number; subtotal: number }[]
  total: number
  creditAmountUsed: number
  receiptQrCode?: string | null
  createdAt: string
}

export function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { isAuthenticated } = useAuth()
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    if (!orderId) return
    apiRequest<{ item: ReceiptData }>(`/orders/${orderId}/receipt`)
      .then((d) => setReceipt(d.item))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [orderId])

  useEffect(() => {
    if (!receipt || !isAuthenticated) return
    apiRequest<{ stands: { id: string }[] }>('/auth/me/stands')
      .then((d) => {
        if (d.stands.some((s) => s.id === receipt.standId)) setHasAccess(true)
      })
      .catch(() => {})
  }, [receipt, isAuthenticated])

  const markCompleted = async () => {
    if (!orderId || marking) return
    setMarking(true)
    try {
      const data = await apiRequest<{ item: { status: string } }>(`/orders/${orderId}`)
      if (data.item.status === 'ready') {
        await apiRequest(`/orders/${orderId}/status`, { method: 'PATCH', bodyJson: { status: 'completed' } })
        setReceipt((prev) => prev ? { ...prev, status: 'completed' } : null)
      }
    } catch {}
    setMarking(false)
  }

  if (isLoading) return null
  if (!receipt) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Ricevuta non trovata.</p></div></div>

  const statusLabel: Record<string, string> = {
    pending: 'In attesa',
    confirmed: 'Confermato',
    preparing: 'In preparazione',
    ready: 'Pronto',
    completed: 'Completato',
    cancelled: 'Annullato',
  }

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.receipt}>
          <div className={styles.header}>
            <h1 className={styles.title}>{receipt.eventName}</h1>
            <span className={styles.stand}>{receipt.standName}</span>
          </div>

          <div className={styles.orderNumber}>
            Ordine #{receipt.orderNumber}
          </div>

          <div className={`${styles.status} ${styles[`status${receipt.status}`]}`}>
            {statusLabel[receipt.status] ?? receipt.status}
          </div>

          <div className={styles.items}>
            {receipt.items.map((item, idx) => (
              <div key={idx} className={styles.item}>
                <span className={styles.itemName}>{item.productName}</span>
                <span className={styles.itemQty}>x{item.quantity}</span>
                <span className={styles.itemPrice}>&euro;{item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className={styles.total}>
            <span>Totale</span>
            <strong>&euro;{receipt.total.toFixed(2)}</strong>
          </div>

          {receipt.creditAmountUsed > 0 && (
            <div className={styles.credits}>
              Pagato &euro;{receipt.creditAmountUsed.toFixed(2)} con crediti
            </div>
          )}

          {receipt.receiptQrCode && (
            <div className={styles.qrSection}>
              <img src={receipt.receiptQrCode} alt="QR ricevuta" className={styles.qrImg} />
            </div>
          )}

          <div className={styles.date}>
            {new Date(receipt.createdAt).toLocaleString('it-IT')}
          </div>

          {hasAccess && receipt.status === 'ready' && (
            <button
              className={styles.collectBtn}
              onClick={markCompleted}
              disabled={marking}
            >
              {marking ? 'Salvataggio...' : 'Segna come ritirato'}
            </button>
          )}

          {hasAccess && (
            <Link to={`/orders/${orderId}`} className={styles.detailLink}>
              Gestisci ordine
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
