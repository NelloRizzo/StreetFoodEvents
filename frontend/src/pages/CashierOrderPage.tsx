import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { createOrder } from '../lib/orders'
import { QRScanner } from '../components/QRScanner'
import styles from './CashierOrderPage.module.scss'

type EventProduct = {
  id: string
  eventId: string
  standId: string
  productId: string
  stationIds: string[]
  priceOverride: number | null
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
  const [showScanner, setShowScanner] = useState(false)
  const [payWithCredits, setPayWithCredits] = useState(false)
  const [creditAmount, setCreditAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [notesModal, setNotesModal] = useState<NotesModalState>({
    open: false,
    ep: null as never,
    selectedStationId: '',
    quantity: 1,
    notes: '',
  })

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  useEffect(() => {
    if (!eventId || !standId) return

    const init = async () => {
      try {
        const { stands } = await apiRequest<{ stands: { id: string; name: string }[] }>('/auth/me/stands')
        const stand = stands.find((s) => s.id === standId)
        if (!stand) { setForbidden(true); setIsLoading(false); return }
        setStandName(stand.name)

        const [eventData, stationData, epData, usersData] = await Promise.all([
          apiRequest<{ item: { name: string } }>(`/events/${eventId}`),
          apiRequest<{ items: Station[] }>(`/stations?standId=${standId}`),
          apiRequest<{ items: EventProduct[] }>(`/event-products?eventId=${eventId}&standId=${standId}`),
          apiRequest<{ items: User[] }>('/users'),
        ])

        setEventName(eventData.item.name)
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
      } catch { setForbidden(true) }
      setIsLoading(false)
    }
    init()
  }, [eventId, standId])

  useEffect(() => {
    if (!notesModal.open && notesModal.ep) {
      setNotesModal({ open: false, ep: null as never, selectedStationId: '', quantity: 1, notes: '' })
    }
  }, [notesModal.open])

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
        alert('Utente non trovato')
      }
    } catch {
      alert('QR Code non valido')
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
    if (cart.length === 0) return
    setIsSubmitting(true)
    try {
      const effectiveCredit = payWithCredits ? Math.min(creditAmount || total, total) : 0
      await createOrder({
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
        paymentOnCreate: effectiveCredit > 0 ? { creditAmount: effectiveCredit } : undefined,
      })
      resetOrder()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Errore durante la creazione ordine')
    }
    setIsSubmitting(false)
  }

  if (isLoading) return null
  if (forbidden) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  if (!eventId || !standId) return null

  const filteredMenu = activeStationId
    ? menu.filter((ep) => ep.stationIds.includes(activeStationId))
    : menu

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to={`/events/${eventId}/stands/${standId}/orders`} className={styles.backBtn}>&larr;</Link>
        <div className={styles.topInfo}>
          <span className={styles.topEvent}>{eventName}</span>
          <span className={styles.topStand}>{standName}</span>
        </div>
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

      {showScanner && (
        <QRScanner
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
