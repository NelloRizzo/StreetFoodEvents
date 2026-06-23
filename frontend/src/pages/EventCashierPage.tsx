import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { createOrder, type Order } from '../lib/orders'
import { QRScanner } from '../components/QRScanner'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './CashierOrderPage.module.scss'

type EventProduct = {
  id: string
  eventId: string
  standId: string
  productId: string
  stationIds: string[]
  priceOverride: number | null
  available: boolean
}

type Product = {
  _id: string
  name: string
  price: number
}

type Station = {
  id: string
  name: string
}

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
}

type CartItem = {
  eventProductId: string
  productName: string
  stationId: string
  stationName: string
  quantity: number
  unitPrice: number
  notes: string
}

type NotesModalState = {
  open: boolean
  ep: EventProduct & { product?: Product; stations?: Station[] }
  selectedStationId: string
  quantity: number
  notes: string
}

type StandInfo = {
  id: string
  name: string
}

export function EventCashierPage() {
  const { eventId } = useParams<{ eventId: string }>()

  const [eventName, setEventName] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [stands, setStands] = useState<StandInfo[]>([])
  const [selectedStandId, setSelectedStandId] = useState('')
  const [standName, setStandName] = useState('')
  const [menu, setMenu] = useState<(EventProduct & { product?: Product; stations?: Station[] })[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [activeStationId, setActiveStationId] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [isDirectOrder, setIsDirectOrder] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [payWithCredits, setPayWithCredits] = useState(false)
  const [creditAmount, setCreditAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)

  const [notesModal, setNotesModal] = useState<NotesModalState>({
    open: false,
    ep: null as never,
    selectedStationId: '',
    quantity: 1,
    notes: '',
  })

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  useEffect(() => {
    if (!eventId) return

    const init = async () => {
      try {
        const { roles } = await apiRequest<{ roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
        const hasAccess = roles.some(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        if (!hasAccess) { setForbidden(true); setIsLoading(false); return }

        const eventData = await apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
        setEventName(eventData.item.name)

        const standsData = await apiRequest<{ items: StandInfo[] }>(`/stands?eventId=${eventId}`)
        setStands(standsData.items)
      } catch { setForbidden(true) }
      setIsLoading(false)
    }
    void init()
  }, [eventId])

  useEffect(() => {
    if (!eventId || !selectedStandId) return

    const loadStandData = async () => {
      try {
        const stand = stands.find((s) => s.id === selectedStandId)
        if (stand) setStandName(stand.name)

        const [stationData, epData, usersData] = await Promise.all([
          apiRequest<{ items: Station[] }>(`/stations?standId=${selectedStandId}`),
          apiRequest<{ items: EventProduct[] }>(`/event-products?eventId=${eventId}&standId=${selectedStandId}`),
          apiRequest<{ items: User[] }>('/users'),
        ])

        setStations(stationData.items)
        if (stationData.items.length > 0) setActiveStationId(stationData.items[0].id)
        setUsers(usersData.items)

        const enriched = await Promise.all(
          epData.items.map(async (ep) => {
            let product: Product | undefined
            try {
              const data = await apiRequest<{ item: Product }>(`/products/${ep.productId}`)
              product = data.item
            } catch {}
            return { ...ep, product, stations: stationData.items.filter((s) => ep.stationIds.includes(s.id)) }
          })
        )
        setMenu(enriched)

        setCart([])
        setSelectedCustomerId('')
        setIsDirectOrder(false)
        setPayWithCredits(false)
        setCreditAmount(0)
      } catch { /* ignore */ }
    }
    void loadStandData()
  }, [eventId, selectedStandId])

  const openNotesModal = (ep: EventProduct & { product?: Product; stations?: Station[] }) => {
    if (!ep.product) return
    setNotesModal({
      open: true,
      ep,
      selectedStationId: ep.stations && ep.stations.length > 0 ? ep.stations[0].id : '',
      quantity: 1,
      notes: '',
    })
  }

  const addToCart = () => {
    if (!notesModal.ep.product) return
    const ep = notesModal.ep
    const station = ep.stations?.find((s) => s.id === notesModal.selectedStationId)
    if (!station) return

    setCart((prev) => {
      const existing = prev.find(
        (i) => i.eventProductId === ep.id && i.stationId === station.id && i.notes === notesModal.notes
      )
      if (existing) {
        return prev.map((i) =>
          i.eventProductId === ep.id && i.stationId === station.id && i.notes === notesModal.notes
            ? { ...i, quantity: i.quantity + notesModal.quantity }
            : i
        )
      }
      return [
        ...prev,
        {
          eventProductId: ep.id,
          productName: ep.product!.name,
          stationId: station.id,
          stationName: station.name,
          quantity: notesModal.quantity,
          unitPrice: ep.priceOverride ?? ep.product!.price,
          notes: notesModal.notes,
        },
      ]
    })

    setNotesModal({ open: false, ep: null as never, selectedStationId: '', quantity: 1, notes: '' })
  }

  const handleQuantity = (index: number, delta: number) => {
    setCart((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      ).filter((item) => item.quantity > 0)
    )
  }

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleQrScan = useCallback(async (decodedText: string) => {
    try {
      const data = await apiRequest<{ item: User }>(`/users/${decodedText}`)
      const found = data.item
      if (found && users.some((u) => u.id === found.id)) {
        setSelectedCustomerId(found.id)
        setIsDirectOrder(false)
      } else {
        setAlertMsg('Utente non trovato')
      }
    } catch {
      setAlertMsg('QR Code non valido')
    }
    setShowScanner(false)
  }, [users])

  const resetOrder = () => {
    setSelectedCustomerId('')
    setIsDirectOrder(false)
    setPayWithCredits(false)
    setCreditAmount(0)
    setCart([])
  }

  const handleSubmit = async () => {
    if (cart.length === 0 || !eventId || !selectedStandId) return
    setIsSubmitting(true)
    try {
      const effectiveCredit = payWithCredits ? Math.min(creditAmount || total, total) : 0
      const response = await createOrder({
        eventId,
        standId: selectedStandId,
        customerId: !isDirectOrder && selectedCustomerId ? selectedCustomerId : undefined,
        customerName: isDirectOrder ? 'Ordine diretto' : undefined,
        items: cart.map((i) => ({
          eventProductId: i.eventProductId,
          stationId: i.stationId,
          quantity: i.quantity,
          notes: i.notes || undefined,
        })),
        paymentOnCreate: effectiveCredit > 0 ? { creditAmount: effectiveCredit } : undefined,
      })
      setCreatedOrder(response.item)
      resetOrder()
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Errore durante la creazione ordine')
    }
    setIsSubmitting(false)
  }

  function printReceipt() {
    if (!createdOrder) return
    const o = createdOrder
    const itemsHtml = o.items.map((item) =>
      `<div style="display:flex;justify-content:space-between;font-size:13px"><span>${escHtml(item.productName)} x${item.quantity}</span><span>&euro;${item.subtotal.toFixed(2)}</span></div>`
    ).join('')
    const creditsHtml = o.creditAmountUsed > 0
      ? `<div style="font-size:11px;color:#555;text-align:center;margin-top:0.25rem">Crediti: &euro;${o.creditAmountUsed.toFixed(2)}</div>`
      : ''
    const qrHtml = o.receiptQrCode
      ? `<div style="display:flex;justify-content:center;margin:0.5rem 0"><img src="${o.receiptQrCode}" alt="QR" style="width:120px;height:120px;-webkit-print-color-adjust:exact;print-color-adjust:exact" /></div>`
      : ''

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Scontrino #${o.orderNumber}</title><style>
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
<div class="header"><strong>${escHtml(eventName)}</strong><span>${escHtml(standName)}</span></div>
<div class="order-number">#${o.orderNumber}</div>
<div class="items">${itemsHtml}</div>
<div class="total"><span>Totale</span><strong>&euro;${o.total.toFixed(2)}</strong></div>
${creditsHtml}
${qrHtml}
<div class="footer">${new Date().toLocaleString('it-IT')}</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script>
</body></html>`

    const w = window.open('', '_blank', 'width=400,height=600')
    if (w) { w.document.write(html); w.document.close() }
  }

  function escHtml(s: string) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }

  if (isLoading) return null
  if (forbidden) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  if (!eventId) return null

  const filteredMenu = menu.filter((ep) => ep.available !== false && (!activeStationId || ep.stationIds.includes(activeStationId)))

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to={`/events/${eventId}`} className={styles.backBtn}>&larr;</Link>
        <div className={styles.topInfo}>
          <span className={styles.topEvent}>{eventName}</span>
          {standName && <span className={styles.topStand}>{standName}</span>}
        </div>

        <select
          value={selectedStandId}
          onChange={(e) => setSelectedStandId(e.target.value)}
          style={{
            padding: '0.4rem 0.5rem',
            border: '1px solid #0f3460',
            borderRadius: '6px',
            background: '#0f3460',
            color: '#f0f0f0',
            fontSize: '0.85rem',
            minWidth: '160px',
          }}
        >
          <option value="">Seleziona stand</option>
          {stands.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div className={styles.customerSection}>
          <label className={styles.directCheck}>
            <input type="checkbox" checked={isDirectOrder} onChange={(e) => setIsDirectOrder(e.target.checked)} />
            Ordine diretto
          </label>
          {!isDirectOrder && (
            <div className={styles.customerRow}>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className={styles.customerSelect}
              >
                <option value="">Seleziona cliente</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
              <button type="button" className={styles.qrBtn} onClick={() => setShowScanner(true)} title="Scansiona QR">
                &#128247;
              </button>
            </div>
          )}
          {isDirectOrder && <span className={styles.directBadge}>Ordine diretto</span>}
        </div>
      </div>

      {selectedStandId ? (
        <div className={styles.layout}>
          <div className={styles.productPanel}>
            <div className={styles.stationTabs}>
              {stations.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.stationTab} ${activeStationId === s.id ? styles.stationTabActive : ''}`}
                  onClick={() => setActiveStationId(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className={styles.productGrid}>
              {filteredMenu.map((ep) => (
                <button
                  key={ep.id}
                  className={styles.productBtn}
                  onClick={() => openNotesModal(ep)}
                >
                  <span className={styles.productBtnName}>{ep.product?.name ?? '...'}</span>
                  <span className={styles.productBtnPrice}>
                    &euro;{(ep.priceOverride ?? ep.product?.price ?? 0).toFixed(2)}
                  </span>
                </button>
              ))}
              {filteredMenu.length === 0 && (
                <p className={styles.empty}>Nessun prodotto in questa sezione.</p>
              )}
            </div>
          </div>

          <div className={styles.cartPanel}>
            <h2 className={styles.cartTitle}>Carrello</h2>

            {cart.length === 0 ? (
              <p className={styles.emptyCart}>Seleziona prodotti.</p>
            ) : (
              <div className={styles.cartItems}>
                {cart.map((item, idx) => (
                  <div key={idx} className={styles.cartItem}>
                    <div className={styles.cartItemHeader}>
                      <strong className={styles.cartItemName}>{item.productName}</strong>
                      <button className={styles.removeBtn} onClick={() => removeFromCart(idx)}>&#10005;</button>
                    </div>
                    <span className={styles.cartItemStation}>{item.stationName}</span>
                    {item.notes && <span className={styles.cartItemNotes}>"{item.notes}"</span>}
                    <div className={styles.cartItemFooter}>
                      <div className={styles.cartQty}>
                        <button className={styles.qtyBtn} onClick={() => handleQuantity(idx, -1)}>-</button>
                        <span className={styles.qtyValue}>{item.quantity}</span>
                        <button className={styles.qtyBtn} onClick={() => handleQuantity(idx, 1)}>+</button>
                      </div>
                      <span className={styles.cartItemTotal}>&euro;{(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.cartTotal}>
              <span>Totale</span>
              <strong>&euro;{total.toFixed(2)}</strong>
            </div>

            {cart.length > 0 && (
              <>
                <div className={styles.paymentOptions}>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={payWithCredits} onChange={(e) => setPayWithCredits(e.target.checked)} />
                    Paga con crediti evento
                  </label>
                  {payWithCredits && total > 0 && (
                    <div className={styles.creditField}>
                      <label>Crediti (&euro;)</label>
                      <input
                        type="number"
                        min={0}
                        max={total}
                        step={0.01}
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(Number(e.target.value))}
                      />
                      {creditAmount < total && (
                        <span className={styles.remainingHint}>
                          Restano &euro;{(total - creditAmount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  className={styles.submitBtn}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Creazione...'
                    : payWithCredits
                      ? `Crea ordine (${creditAmount > 0 ? `€${creditAmount.toFixed(2)} crediti` : 'da pagare'})`
                      : 'Crea ordine (da pagare)'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.productPanel} style={{ justifyContent: 'center', alignItems: 'center' }}>
          <p className={styles.empty}>Seleziona uno stand per iniziare.</p>
        </div>
      )}

      {notesModal.open && notesModal.ep.product && (
        <div className={styles.overlay} onClick={() => setNotesModal({ ...notesModal, open: false })}>
          <div className={styles.notesModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{notesModal.ep.product.name}</h3>
            <p className={styles.modalPrice}>
              &euro;{(notesModal.ep.priceOverride ?? notesModal.ep.product.price).toFixed(2)}
            </p>

            {notesModal.ep.stations && notesModal.ep.stations.length > 1 && (
              <div className={styles.modalField}>
                <label>Postazione</label>
                <select
                  value={notesModal.selectedStationId}
                  onChange={(e) => setNotesModal({ ...notesModal, selectedStationId: e.target.value })}
                >
                  {notesModal.ep.stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.modalField}>
              <label>Quantità</label>
              <div className={styles.modalQty}>
                <button className={styles.qtyBtn} onClick={() => setNotesModal({ ...notesModal, quantity: Math.max(1, notesModal.quantity - 1) })}>-</button>
                <span className={styles.modalQtyValue}>{notesModal.quantity}</span>
                <button className={styles.qtyBtn} onClick={() => setNotesModal({ ...notesModal, quantity: notesModal.quantity + 1 })}>+</button>
              </div>
            </div>

            <div className={styles.modalField}>
              <label>Note (es. no sugo, più panna)</label>
              <input
                value={notesModal.notes}
                onChange={(e) => setNotesModal({ ...notesModal, notes: e.target.value })}
                placeholder="no sugo, più panna..."
                className={styles.notesInput}
                autoFocus
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalAddBtn} onClick={addToCart}>
                Aggiungi &euro;{((notesModal.ep.priceOverride ?? notesModal.ep.product.price) * notesModal.quantity).toFixed(2)}
              </button>
              <button className={styles.modalCancelBtn} onClick={() => setNotesModal({ ...notesModal, open: false })}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {createdOrder && (
        <div className={styles.overlay} onClick={() => setCreatedOrder(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.confirmTitle}>Ordine creato</h2>
            <div className={styles.confirmOrderNumber}>#{createdOrder.orderNumber}</div>
            <div className={styles.confirmStand}>{standName}</div>
            <div className={styles.confirmItems}>
              {createdOrder.items.map((item, idx) => (
                <div key={idx} className={styles.confirmItem}>
                  <span>{item.productName} x{item.quantity}</span>
                  <span>&euro;{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className={styles.confirmTotal}>
              <span>Totale</span>
              <strong>&euro;{createdOrder.total.toFixed(2)}</strong>
            </div>
            {createdOrder.creditAmountUsed > 0 && (
              <div className={styles.confirmCredits}>
                Pagato &euro;{createdOrder.creditAmountUsed.toFixed(2)} con crediti
              </div>
            )}
            {createdOrder.receiptQrCode && (
              <div className={styles.qrSection}>
                <img src={createdOrder.receiptQrCode} alt="QR ricevuta" className={styles.qrImg} />
                <a href={`/receipt/${createdOrder.id}`} target="_blank" rel="noopener noreferrer" className={styles.qrLink}>
                  Apri ricevuta
                </a>
              </div>
            )}
            <div className={styles.confirmActions}>
                <button className={styles.printBtn} onClick={printReceipt}>
                Stampa scontrino
              </button>
              <button className={styles.confirmCloseBtn} onClick={() => setCreatedOrder(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <QRScanner
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <ConfirmModal
        open={alertMsg !== null}
        variant="alert"
        title="Attenzione"
        message={alertMsg ?? ''}
        confirmLabel="OK"
        onConfirm={() => setAlertMsg(null)}
        onCancel={() => setAlertMsg(null)}
      />
    </div>
  )
}
