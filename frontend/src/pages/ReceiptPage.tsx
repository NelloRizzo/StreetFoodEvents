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

  function printReceipt() {
    if (!receipt) return
    const itemsHtml = receipt.items.map((item) =>
      `<div style="display:flex;justify-content:space-between;font-size:13px"><span>${escHtml(item.productName)} x${item.quantity}</span><span>&euro;${item.subtotal.toFixed(2)}</span></div>`
    ).join('')
    const creditsHtml = receipt.creditAmountUsed > 0
      ? `<div style="font-size:11px;color:#555;text-align:center;margin-top:0.25rem">Crediti: &euro;${receipt.creditAmountUsed.toFixed(2)}</div>`
      : ''
    const qrHtml = receipt.receiptQrCode
      ? `<div style="display:flex;justify-content:center;margin:0.5rem 0"><img src="${receipt.receiptQrCode}" alt="QR" style="width:120px;height:120px;-webkit-print-color-adjust:exact;print-color-adjust:exact" /></div>`
      : ''

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Scontrino #${receipt.orderNumber}</title><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-family:'Courier New',monospace;background:#fff;color:#000;font-size:14px}
body{padding:2rem;max-width:320px;margin:0 auto}
@media print{@page{margin:0}body{padding:1.5rem;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.header{display:grid;gap:0.2rem;text-align:center;margin-bottom:0.75rem}
.header strong{font-size:17px}
.order-number{font-size:44px;font-weight:900;text-align:center;margin:0.75rem 0}
.items{padding:0.5rem 0;border-top:2px dashed #000;border-bottom:2px dashed #000}
.total{display:flex;justify-content:space-between;font-size:17px;font-weight:700;margin-top:0.5rem}
.footer{font-size:10px;text-align:center;color:#888;margin-top:0.75rem}
</style></head><body>
<div class="header"><strong>${escHtml(receipt.eventName)}</strong><span>${escHtml(receipt.standName)}</span></div>
<div class="order-number">#${receipt.orderNumber}</div>
<div class="items">${itemsHtml}</div>
<div class="total"><span>Totale</span><strong>&euro;${receipt.total.toFixed(2)}</strong></div>
${creditsHtml}
${qrHtml}
<div class="footer">${new Date(receipt.createdAt).toLocaleString('it-IT')}</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script>
</body></html>`

    const w = window.open('', '_blank', 'width=400,height=600')
    if (w) { w.document.write(html); w.document.close() }
  }

  function escHtml(s: string) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }

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

          <button className={styles.printBtn} onClick={printReceipt}>
            Stampa scontrino
          </button>

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
