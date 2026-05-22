import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { createOrder } from '../lib/orders'
import { useAuth } from '../features/auth/auth-context'
import styles from './NewOrderPage.module.scss'

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

type CartItem = {
  eventProductId: string
  productName: string
  stationId: string
  stationName: string
  quantity: number
  unitPrice: number
}

export function NewOrderPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  const [stands, setStands] = useState<{ id: string; name: string }[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedStandId, setSelectedStandId] = useState('')
  const [menu, setMenu] = useState<(EventProduct & { product?: Product; stations?: Station[] })[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [payWithCredits, setPayWithCredits] = useState(false)
  const [creditAmount, setCreditAmount] = useState(0)
  const [customerName, setCustomerName] = useState('')

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  useEffect(() => {
    apiRequest<{ items: { id: string; name: string }[] }>('/events')
      .then((d) => {
        setEvents(d.items)
        if (d.items.length > 0) {
          setSelectedEventId(d.items[0].id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedEventId) { setStands([]); return }
    apiRequest<{ items: { id: string; name: string }[] }>(`/stands?eventId=${selectedEventId}`)
      .then((d) => {
        setStands(d.items)
        if (d.items.length > 0) {
          setSelectedStandId(d.items[0].id)
        }
      })
      .catch(() => {})
  }, [selectedEventId])

  useEffect(() => {
    if (!selectedEventId || !selectedStandId) { setMenu([]); return }
    const loadMenu = async () => {
      const [epData, stationData] = await Promise.all([
        apiRequest<{ items: EventProduct[] }>(`/event-products?eventId=${selectedEventId}&standId=${selectedStandId}`),
        apiRequest<{ items: Station[] }>(`/stations?standId=${selectedStandId}`),
      ])
      const stations = stationData.items
      const enriched = await Promise.all(
        epData.items.map(async (ep) => {
          let product: Product | undefined
          try {
            const data = await apiRequest<{ item: Product }>(`/products/${ep.productId}`)
            product = data.item
          } catch {}
          return { ...ep, product, stations: stations.filter((s) => ep.stationIds.includes(s.id)) }
        })
      )
      setMenu(enriched)
    }
    loadMenu()
  }, [selectedEventId, selectedStandId])

  useEffect(() => {
    if (user) setCustomerName(`${user.firstName} ${user.lastName}`)
  }, [user])

  const addToCart = (ep: EventProduct & { product?: Product; stations?: Station[] }, stationId: string, stationName: string) => {
    if (!ep.product) return
    setCart((prev) => {
      const existing = prev.find((i) => i.eventProductId === ep.id && i.stationId === stationId)
      if (existing) {
        return prev.map((i) =>
          i.eventProductId === ep.id && i.stationId === stationId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [
        ...prev,
        {
          eventProductId: ep.id,
          productName: ep.product!.name,
          stationId,
          stationName,
          quantity: 1,
          unitPrice: ep.priceOverride ?? ep.product!.price,
        },
      ]
    })
  }

  const updateQuantity = (eventProductId: string, stationId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.eventProductId === eventProductId && i.stationId === stationId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    )
  }

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setIsSubmitting(true)
    try {
      const effectiveCredit = payWithCredits ? Math.min(creditAmount || total, total) : 0
      await createOrder({
        eventId: selectedEventId,
        standId: selectedStandId,
        customerName: customerName || undefined,
        items: cart.map((i) => ({
          eventProductId: i.eventProductId,
          stationId: i.stationId,
          quantity: i.quantity,
        })),
        paymentOnCreate: effectiveCredit > 0 ? { creditAmount: effectiveCredit } : undefined,
      })
      navigate('/orders')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Errore durante la creazione ordine')
    }
    setIsSubmitting(false)
  }

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to="/orders" className={styles.backLink}>&larr; Torna agli ordini</Link>
        <div className={styles.header}>
          <span className="eyebrow">Ordini</span>
          <h1 className={styles.title}>Nuovo ordine</h1>
        </div>

        <div className={styles.layout}>
          <div className={styles.left}>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label>Evento</label>
                <select value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); setSelectedStandId(''); setCart([]) }}>
                  <option value="">Seleziona evento</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {selectedEventId && (
                <div className={styles.field}>
                  <label>Stand</label>
                  <select value={selectedStandId} onChange={(e) => { setSelectedStandId(e.target.value); setCart([]) }}>
                    <option value="">Seleziona stand</option>
                    {stands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {selectedStandId && menu.length > 0 && (
              <div className={styles.menu}>
                <h2 className={styles.sectionTitle}>Menu</h2>
                {menu.map((ep) => (
                  <div key={ep.id} className={styles.menuItem}>
                    <div className={styles.menuItemInfo}>
                      <strong>{ep.product?.name ?? 'Caricamento...'}</strong>
                      <span className={styles.menuItemPrice}>&euro;{(ep.priceOverride ?? ep.product?.price ?? 0).toFixed(2)}</span>
                    </div>
                    <div className={styles.menuItemStations}>
                      {ep.stations?.map((s) => (
                        <button key={s.id} className={styles.addBtn} onClick={() => addToCart(ep, s.id, s.name)}>
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedStandId && menu.length === 0 && (
              <p className={styles.empty}>Nessun prodotto disponibile per questo stand.</p>
            )}
          </div>

          <div className={styles.right}>
            <div className={styles.cartCard}>
              <h2 className={styles.sectionTitle}>Carrello</h2>

              <div className={styles.field}>
                <label>Cliente</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome cliente" />
              </div>

              {cart.length === 0 ? (
                <p className={styles.emptyCart}>Seleziona prodotti dal menu.</p>
              ) : (
                <div className={styles.cartItems}>
                  {cart.map((item) => (
                    <div key={`${item.eventProductId}-${item.stationId}`} className={styles.cartItem}>
                      <div className={styles.cartItemInfo}>
                        <strong>{item.productName}</strong>
                        <span className={styles.cartItemStation}>{item.stationName}</span>
                        <span className={styles.cartItemPrice}>&euro;{item.unitPrice.toFixed(2)} x {item.quantity}</span>
                      </div>
                      <div className={styles.cartItemActions}>
                        <button className={styles.qtyBtn} onClick={() => updateQuantity(item.eventProductId, item.stationId, -1)}>-</button>
                        <span className={styles.qtyValue}>{item.quantity}</span>
                        <button className={styles.qtyBtn} onClick={() => updateQuantity(item.eventProductId, item.stationId, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.totalRow}>
                <strong>Totale</strong>
                <strong>&euro;{total.toFixed(2)}</strong>
              </div>

              <div className={styles.paymentOptions}>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={payWithCredits} onChange={(e) => setPayWithCredits(e.target.checked)} />
                  Paga con crediti evento
                </label>
                {payWithCredits && total > 0 && (
                  <div className={styles.creditField}>
                    <label>Crediti da usare (&euro;)</label>
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
                        Saldo restante: &euro;{(total - creditAmount).toFixed(2)} da pagare in altro modo
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                className={`${styles.primaryBtn} ${styles.submitBtn}`}
                onClick={handleSubmit}
                disabled={cart.length === 0 || isSubmitting}
              >
                {isSubmitting ? 'Creazione in corso...' : payWithCredits ? 'Crea ordine con pagamento' : 'Crea ordine (da pagare)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
