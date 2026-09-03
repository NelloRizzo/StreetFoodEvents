import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { createOrder, fetchOrders, fetchGiftStats, updateOrderStatus, cancelOrder, type GiftStats, type Order } from '../lib/orders'
import { trackCashierOrderCreated, trackOrderStatusUpdate } from '../lib/analytics'
import { QRScanner } from '../components/QRScanner'
import { ConfirmModal } from '../components/ConfirmModal'
import { CurrencyDisplay, currencyBadgeHtml } from '../components/CurrencyDisplay'
import { GiftCounter } from '../components/GiftCounter'
import type { UploadedImage } from '../lib/upload'
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

export function CashierOrderPage() {
  const { eventId, standId } = useParams<{ eventId: string; standId: string }>()

  const [eventName, setEventName] = useState('')
  const [eventCurrency, setEventCurrency] = useState<{ currencyName: string; currencySymbol: UploadedImage | null } | null>(null)
  const [standName, setStandName] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [menu, setMenu] = useState<(EventProduct & { product?: Product; stations?: Station[] })[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [activeStationId, setActiveStationId] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [isDirectOrder, setIsDirectOrder] = useState(false)
  const [isGift, setIsGift] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [payWithCredits, setPayWithCredits] = useState(false)
  const [creditAmount, setCreditAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [successOrder, setSuccessOrder] = useState<Order | null>(null)
  const [showVoidPrompt, setShowVoidPrompt] = useState(false)
  const [activeOrders, setActiveOrders] = useState<Order[]>([])
  const [giftStats, setGiftStats] = useState<GiftStats | null>(null)

  const [notesModal, setNotesModal] = useState<NotesModalState>({
    open: false,
    ep: null as never,
    selectedStationId: '',
    quantity: 1,
    notes: '',
  })

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  const loadGiftStats = useCallback(async () => {
    if (!eventId || !standId) return
    try {
      setGiftStats(await fetchGiftStats({ eventId, standId }))
    } catch { /* ignore */ }
  }, [eventId, standId])

  useEffect(() => {
    if (!eventId || !standId) return

    const init = async () => {
      try {
        const { stands } = await apiRequest<{ stands: { id: string; name: string }[] }>('/auth/me/stands')
        const stand = stands.find((s) => s.id === standId)
        if (!stand) { setForbidden(true); setIsLoading(false); return }
        setStandName(stand.name)

        const [eventData, stationData, epData, usersData] = await Promise.all([
          apiRequest<{ item: { name: string; currencyName: string; currencySymbol: UploadedImage | null } }>(`/events/${eventId}`),
          apiRequest<{ items: Station[] }>(`/stations?standId=${standId}`),
          apiRequest<{ items: EventProduct[] }>(`/event-products?eventId=${eventId}&standId=${standId}`),
          apiRequest<{ items: User[] }>('/users'),
        ])

        setEventName(eventData.item.name)
        setEventCurrency({
          currencyName: eventData.item.currencyName,
          currencySymbol: eventData.item.currencySymbol,
        })
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
        loadGiftStats()
      } catch { setForbidden(true) }
      setIsLoading(false)
    }
    init()
  }, [eventId, standId, loadGiftStats])

  const loadActiveOrders = useCallback(async () => {
    if (!eventId || !standId) return
    try {
      const data = await fetchOrders({ eventId, standId, status: 'preparing,ready' })
      setActiveOrders(data.items)
    } catch { /* ignore */ }
  }, [eventId, standId])

  useEffect(() => {
    void loadActiveOrders()
    const interval = setInterval(loadActiveOrders, 10000)
    return () => clearInterval(interval)
  }, [loadActiveOrders])

  const handleDeliver = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'completed')
      trackOrderStatusUpdate({ orderId, eventId, standId, toStatus: 'completed' })
      loadActiveOrders()
    } catch { setAlertMsg('Errore durante la consegna') }
  }

  useEffect(() => {
    if (!notesModal.open && notesModal.ep) {
      setNotesModal({ open: false, ep: null as never, selectedStationId: '', quantity: 1, notes: '' })
    }
  }, [notesModal.open, notesModal.ep])

  const openNotesModal = (ep: EventProduct & { product?: Product; stations?: Station[] }) => {
    if (!ep.product) return
    if (ep.stations && ep.stations.length === 1) {
      setNotesModal({
        open: true,
        ep,
        selectedStationId: ep.stations[0].id,
        quantity: 1,
        notes: '',
      })
    } else if (ep.stations && ep.stations.length > 1) {
      setNotesModal({
        open: true,
        ep,
        selectedStationId: ep.stations[0].id,
        quantity: 1,
        notes: '',
      })
    }
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
    setIsGift(false)
    setPayWithCredits(false)
    setCreditAmount(0)
    setCart([])
  }

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setIsSubmitting(true)
    try {
      const effectiveCredit = isGift ? 0 : payWithCredits ? Math.min(creditAmount || total, total) : 0
      const response = await createOrder({
        eventId: eventId!,
        standId: standId!,
        customerId: !isDirectOrder && selectedCustomerId ? selectedCustomerId : undefined,
        customerName: isDirectOrder ? 'Ordine diretto' : undefined,
        items: cart.map((i) => ({
          eventProductId: i.eventProductId,
          stationId: i.stationId,
          quantity: i.quantity,
          notes: i.notes || undefined,
        })),
        paymentOnCreate: isGift ? undefined : { creditAmount: effectiveCredit },
        isGift,
      })
      await updateOrderStatus(response.item.id, 'preparing')
      setSuccessOrder(response.item)
      loadGiftStats()
      resetOrder()
      trackCashierOrderCreated({
        orderId: response.item.id,
        eventId,
        standId,
        eventName,
        standName,
        items: cart.reduce((sum, i) => sum + i.quantity, 0),
        total,
        currency: eventCurrency?.currencyName,
        isGift,
        paidOnCreate: !isGift,
      })
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Errore durante la creazione ordine')
    }
    setIsSubmitting(false)
  }

  const handleVoid = async (reason?: string) => {
    if (!successOrder) return
    try {
      await cancelOrder(successOrder.id, reason)
      setSuccessOrder({ ...successOrder, status: 'cancelled', paymentStatus: 'refunded' })
      setShowVoidPrompt(false)
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Errore durante lo storno')
    }
  }

  function escHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  function printReceipt() {
    if (!successOrder) return
    const o = successOrder
    const badge = eventCurrency ? currencyBadgeHtml(eventCurrency.currencyName) : '&euro;'
    const itemsHtml = o.items.map((item) =>
      `<div style="display:flex;justify-content:space-between;font-size:13px"><span>${escHtml(item.productName)} x${item.quantity}</span><span>${item.subtotal.toFixed(2)} ${badge}</span></div>`
    ).join('')
    const creditsHtml = o.creditAmountUsed > 0
      ? `<div style="font-size:11px;color:#555;text-align:center;margin-top:0.25rem">Crediti: ${o.creditAmountUsed.toFixed(2)} ${badge}</div>`
      : ''
    const qrHtml = o.receiptQrCode
      ? `<div style="display:flex;justify-content:center;margin:0.5rem 0"><img src="${o.receiptQrCode}" alt="QR" style="width:120px;height:120px;-webkit-print-color-adjust:exact;print-color-adjust:exact" /></div>`
      : ''
    const giftHtml = o.isGift
      ? '<div style="text-align:center;font-weight:700;letter-spacing:0.15em;margin:0.5rem 0">OMAGGIO</div>'
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
<div class="order-number">${o.isGift ? 'O' : '#'}${o.orderNumber}</div>
${giftHtml}
<div class="items">${itemsHtml}</div>
<div class="total"><span>Totale</span><strong>${o.total.toFixed(2)} ${badge}</strong></div>
${creditsHtml}
${qrHtml}
<div class="footer">${new Date().toLocaleString('it-IT')}</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script>
</body></html>`

    const w = window.open('', '_blank', 'width=800,height=900')
    if (w) { w.document.write(html); w.document.close() }
  }

  const resetSuccessModal = () => setSuccessOrder(null)

  if (isLoading) return null
  if (forbidden) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  if (!eventId || !standId) return null

  const menuByStation = stations
    .map((s) => ({
      station: s,
      items: menu.filter((ep) => ep.available !== false && ep.stationIds.includes(s.id)),
    }))
    .filter((group) => group.items.length > 0)

  const scrollToStation = (stationId: string) => {
    setActiveStationId(stationId)
    document.getElementById(`station-section-${stationId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/admin/dashboard" className={styles.backBtn}>&larr;</Link>
        <div className={styles.topInfo}>
          <span className={styles.topEvent}>{eventName}</span>
          <span className={styles.topStand}>{standName}</span>
        </div>
        <GiftCounter stats={giftStats} />
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

      <div className={styles.layout}>
        <div className={styles.productPanel}>
          <div className={styles.stationTabs}>
            {stations.map((s) => (
              <button
                key={s.id}
                className={`${styles.stationTab} ${activeStationId === s.id ? styles.stationTabActive : ''}`}
                onClick={() => scrollToStation(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className={styles.productSections}>
            {menuByStation.map((group) => (
              <section
                key={group.station.id}
                id={`station-section-${group.station.id}`}
                className={styles.stationSection}
              >
                <h2 className={styles.stationSectionTitle}>{group.station.name}</h2>
                <div className={styles.productGrid}>
                  {group.items.map((ep) => (
                    <button
                      key={ep.id}
                      className={styles.productBtn}
                      onClick={() => openNotesModal(ep)}
                    >
                      <span className={styles.productBtnName}>{ep.product?.name ?? '...'}</span>
                      <span className={styles.productBtnPrice}>
                        {(ep.priceOverride ?? ep.product?.price ?? 0).toFixed(2)}
                        {eventCurrency && (
                          <CurrencyDisplay
                            currencyName={eventCurrency.currencyName}
                            currencySymbol={eventCurrency.currencySymbol}
                          />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {menuByStation.length === 0 && (
              <p className={styles.empty}>Nessun prodotto disponibile per questo stand.</p>
            )}
          </div>
        </div>

        {activeOrders.length > 0 && (
          <div className={styles.ordersPanel}>
            <h2 className={styles.ordersTitle}>Ordini in corso</h2>
            <div className={styles.ordersList}>
              {activeOrders.map((o) => {
                return (
                  <div key={o.id} className={styles.orderCard}>
                    <div className={styles.orderCardHeader}>
                      <span className={`${styles.orderNumber} ${o.isGift ? styles.orderNumberGift : ''}`}>
                        {o.isGift ? 'O' : '#'}{o.orderNumber}
                      </span>
                      {o.isGift ? (
                        <span className={styles.giftBadge}>OMAGGIO</span>
                      ) : (
                        <span className={styles.orderTotal}>
                          {o.total.toFixed(2)}
                          {eventCurrency && (
                            <CurrencyDisplay
                              currencyName={eventCurrency.currencyName}
                              currencySymbol={eventCurrency.currencySymbol}
                            />
                          )}
                        </span>
                      )}
                    </div>
                    {o.customerName && <span className={styles.orderCustomer}>{o.customerName}</span>}
                    <div className={styles.orderCardItems}>
                      {o.items.map((item, idx) => (
                        <span key={idx} className={`${styles.orderItem} ${item.ready ? styles.orderItemReady : ''}`}>
                          {item.quantity}x {item.productName}
                        </span>
                      ))}
                    </div>
                    {o.status === 'preparing' && (
                      <span className={styles.orderProgress}>In preparazione</span>
                    )}
                    {o.status === 'ready' && (
                      <button className={styles.deliverBtn} onClick={() => handleDeliver(o.id)}>
                        Consegna
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
                    <span className={styles.cartItemTotal}>
                      {(item.unitPrice * item.quantity).toFixed(2)}
                      {eventCurrency && (
                        <CurrencyDisplay
                          currencyName={eventCurrency.currencyName}
                          currencySymbol={eventCurrency.currencySymbol}
                        />
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.cartTotal}>
            <span>Totale</span>
            <strong>
              {total.toFixed(2)}
              {eventCurrency && (
                <CurrencyDisplay
                  currencyName={eventCurrency.currencyName}
                  currencySymbol={eventCurrency.currencySymbol}
                />
              )}
            </strong>
          </div>

          {cart.length > 0 && (
            <>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
                Ordine omaggio (prezzo 0)
              </label>

              {!isGift && (
                <div className={styles.paymentOptions}>
                  <label className={styles.checkbox}>
                    <input type="checkbox" checked={payWithCredits} onChange={(e) => setPayWithCredits(e.target.checked)} />
                    Paga con crediti evento
                  </label>
                  {payWithCredits && total > 0 && (
                    <div className={styles.creditField}>
                      <label>Crediti</label>
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
                          Restano {(total - creditAmount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                className={`${styles.submitBtn} ${isGift ? styles.submitBtnGift : ''}`}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Creazione...'
                  : isGift
                    ? 'Crea omaggio'
                    : payWithCredits
                      ? `Crea ordine (${creditAmount > 0 ? `${creditAmount.toFixed(2)} ${eventCurrency?.currencyName ?? 'crediti'}` : 'da pagare'})`
                      : 'Crea ordine (da pagare)'}
              </button>
            </>
          )}
        </div>
      </div>

      {notesModal.open && notesModal.ep.product && (
        <div className={styles.overlay} onClick={() => setNotesModal({ ...notesModal, open: false })}>
          <div className={styles.notesModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{notesModal.ep.product.name}</h3>
            <p className={styles.modalPrice}>
              {(notesModal.ep.priceOverride ?? notesModal.ep.product.price).toFixed(2)}
              {eventCurrency && (
                <CurrencyDisplay
                  currencyName={eventCurrency.currencyName}
                  currencySymbol={eventCurrency.currencySymbol}
                />
              )}
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
                Aggiungi {((notesModal.ep.priceOverride ?? notesModal.ep.product.price) * notesModal.quantity).toFixed(2)}
                {eventCurrency && (
                  <CurrencyDisplay
                    currencyName={eventCurrency.currencyName}
                    currencySymbol={eventCurrency.currencySymbol}
                  />
                )}
              </button>
              <button className={styles.modalCancelBtn} onClick={() => setNotesModal({ ...notesModal, open: false })}>
                Annulla
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

      {successOrder && (
        <div className={styles.overlay} onClick={resetSuccessModal}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.confirmTitle}>Ordine creato</h2>
            <div className={`${styles.confirmOrderNumber} ${successOrder.isGift ? styles.confirmOrderNumberGift : ''}`}>
              {successOrder.isGift ? 'O' : '#'}{successOrder.orderNumber}
            </div>
            {successOrder.isGift && <span className={styles.giftBadge}>OMAGGIO</span>}
            <div className={styles.confirmStand}>{standName}</div>
            <div className={styles.confirmItems}>
              {successOrder.items.map((item, idx) => (
                <div key={idx} className={styles.confirmItem}>
                  <span>{item.productName} x{item.quantity}</span>
                  <span>
                    {item.subtotal.toFixed(2)}
                    {eventCurrency && (
                      <CurrencyDisplay
                        currencyName={eventCurrency.currencyName}
                        currencySymbol={eventCurrency.currencySymbol}
                      />
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.confirmTotal}>
              <span>Totale</span>
              <strong>
                {successOrder.total.toFixed(2)}
                {eventCurrency && (
                  <CurrencyDisplay
                    currencyName={eventCurrency.currencyName}
                    currencySymbol={eventCurrency.currencySymbol}
                  />
                )}
              </strong>
            </div>
            <div className={styles.confirmPayment}>
              {successOrder.creditAmountUsed > 0
                ? <>Pagato {successOrder.creditAmountUsed.toFixed(2)} con crediti</>
                : 'Pagato in contanti'}
            </div>
            {successOrder.receiptQrCode && (
              <div className={styles.qrSection}>
                <img src={successOrder.receiptQrCode} alt="QR ricevuta" className={styles.qrImg} />
                <a href={`/receipt/${successOrder.id}`} target="_blank" rel="noopener noreferrer" className={styles.qrLink}>
                  Apri ricevuta
                </a>
              </div>
            )}
            <div className={styles.confirmActions}>
              <button className={styles.printBtn} onClick={printReceipt}>
                Stampa scontrino
              </button>
              {successOrder.status !== 'cancelled' && (
                <button className={styles.voidBtn} onClick={() => setShowVoidPrompt(true)}>
                  Storna ordine
                </button>
              )}
              <button className={styles.confirmCloseBtn} onClick={resetSuccessModal}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showVoidPrompt}
        variant="prompt"
        title="Storna ordine"
        message="Inserisci il motivo dello storno:"
        confirmLabel="Storna"
        onConfirm={handleVoid}
        onCancel={() => setShowVoidPrompt(false)}
      />

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
