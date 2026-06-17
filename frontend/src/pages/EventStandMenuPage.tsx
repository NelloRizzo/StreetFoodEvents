import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { createOrder } from '../lib/orders'
import { useEventTheme } from '../features/theme/useEventTheme'
import { useAuth } from '../features/auth/auth-context'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './EventStandMenuPage.module.scss'

type MenuItem = {
  id: string
  eventId: string
  standId: string
  productId: string
  product: {
    id: string
    name: string
    price: number
    ingredients: string[]
  } | null
  stationIds: string[]
  priceOverride: number | null
}

type Event = {
  id: string
  name: string
  currencySymbol: string | null
  themeBrand: string | null
  themeText: string | null
  themeSurface: string | null
  themeHighlight: string | null
}

type Stand = {
  id: string
  name: string
  slogan: string | null
}

type CartItem = {
  eventProductId: string
  productName: string
  stationId: string
  quantity: number
  unitPrice: number
}

export function EventStandMenuPage() {
  const { eventId, standId } = useParams<{ eventId: string; standId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [stand, setStand] = useState<Stand | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [payWithCredits, setPayWithCredits] = useState(false)
  const [creditAmount, setCreditAmount] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [alertMsg, setAlertMsg] = useState<string | null>(null)

  const total = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  const themeData = useMemo(
    () =>
      event
        ? {
            themeBrand: event.themeBrand,
            themeText: event.themeText,
            themeSurface: event.themeSurface,
            themeHighlight: event.themeHighlight,
          }
        : null,
    [event?.themeBrand, event?.themeText, event?.themeSurface, event?.themeHighlight],
  )

  useEventTheme(themeData)

  useEffect(() => {
    if (!eventId || !standId) return

    Promise.all([
      apiRequest<{ item: Event }>(`/events/${eventId}`),
      apiRequest<{ item: Stand }>(`/stands/${standId}`),
      apiRequest<{ items: MenuItem[] }>(`/event-products?eventId=${eventId}&standId=${standId}`),
    ])
      .then(([eventData, standData, menuData]) => {
        setEvent(eventData.item)
        setStand(standData.item)
        setMenuItems(menuData.items)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [eventId, standId])

  useEffect(() => {
    if (user) setCustomerName(`${user.firstName} ${user.lastName}`)
  }, [user])

  const addToCart = (item: MenuItem) => {
    const product = item.product
    if (!product || item.stationIds.length === 0) return
    const unitPrice = item.priceOverride ?? product.price

    setCart((prev) => {
      const existing = prev.find((c) => c.eventProductId === item.id)
      if (existing) {
        return prev.map((c) =>
          c.eventProductId === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        )
      }
      return [
        ...prev,
        {
          eventProductId: item.id,
          productName: product.name,
          stationId: item.stationIds[0],
          quantity: 1,
          unitPrice,
        },
      ]
    })
  }

  const updateQuantity = (eventProductId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.eventProductId === eventProductId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    )
  }

  const handleSubmit = async () => {
    if (cart.length === 0 || !eventId || !standId) return
    setIsSubmitting(true)
    try {
      const effectiveCredit = payWithCredits ? Math.min(creditAmount || total, total) : 0
      await createOrder({
        eventId,
        standId,
        customerName: customerName || undefined,
        items: cart.map((c) => ({
          eventProductId: c.eventProductId,
          stationId: c.stationId,
          quantity: c.quantity,
        })),
        paymentOnCreate: effectiveCredit > 0 ? { creditAmount: effectiveCredit } : undefined,
      })
      navigate('/orders')
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Errore durante la creazione ordine')
    }
    setIsSubmitting(false)
  }

  if (isLoading || !event || !stand) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all'evento</Link>

        <div className={styles.header}>
          <div>
            <span className="eyebrow">Menu</span>
            <h1 className={styles.title}>{stand.name}</h1>
            {stand.slogan && <p className={styles.slogan}>{stand.slogan}</p>}
          </div>
        </div>

        <div className={styles.layout}>
          <div className={styles.left}>
            <section className={styles.menuSection}>
              <h2 className={styles.sectionTitle}>Prodotti</h2>

              {menuItems.length === 0 && (
                <p className={styles.empty}>Nessun prodotto disponibile per questo stand.</p>
              )}

              <div className={styles.menuList}>
                {menuItems.map((item) => {
                  const product = item.product
                  const price = item.priceOverride ?? product?.price ?? 0

                  return (
                    <div key={item.id} className={styles.menuCard}>
                      <div className={styles.menuInfo}>
                        <strong className={styles.menuName}>
                          {product?.name ?? 'Prodotto sconosciuto'}
                        </strong>
                        {product && product.ingredients.length > 0 && (
                          <span className={styles.menuIngredients}>
                            {product.ingredients.join(', ')}
                          </span>
                        )}
                      </div>
                      <div className={styles.menuRight}>
                        <span className={styles.menuPrice}>
                          {price.toFixed(2)} {event.currencySymbol ?? '€'}
                        </span>
                        {isAuthenticated && (
                          <button
                            className={styles.addBtn}
                            onClick={() => addToCart(item)}
                          >
                            Aggiungi
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {isAuthenticated && (
            <div className={styles.right}>
              <div className={styles.cartCard}>
                <h2 className={styles.sectionTitle}>Carrello</h2>

                <div className={styles.field}>
                  <label>Cliente</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nome cliente"
                  />
                </div>

                {cart.length === 0 ? (
                  <p className={styles.emptyCart}>Seleziona prodotti dal menu.</p>
                ) : (
                  <div className={styles.cartItems}>
                    {cart.map((c) => (
                      <div key={c.eventProductId} className={styles.cartItem}>
                        <div className={styles.cartItemInfo}>
                          <strong>{c.productName}</strong>
                          <span className={styles.cartItemPrice}>
                            {(c.unitPrice * c.quantity).toFixed(2)} {event.currencySymbol ?? '€'}
                          </span>
                        </div>
                        <div className={styles.cartItemActions}>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => updateQuantity(c.eventProductId, -1)}
                          >
                            -
                          </button>
                          <span className={styles.qtyValue}>{c.quantity}</span>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => updateQuantity(c.eventProductId, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cart.length > 0 && (
                  <>
                    <div className={styles.totalRow}>
                      <strong>Totale</strong>
                      <strong>
                        {total.toFixed(2)} {event.currencySymbol ?? '€'}
                      </strong>
                    </div>

                    <div className={styles.paymentOptions}>
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          checked={payWithCredits}
                          onChange={(e) => setPayWithCredits(e.target.checked)}
                        />
                        Paga con crediti wallet
                      </label>
                      {payWithCredits && total > 0 && (
                        <div className={styles.creditField}>
                          <label>Crediti da usare</label>
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
                              Restanti {(total - creditAmount).toFixed(2)} da pagare al ritiro
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
                      {isSubmitting
                        ? 'Creazione in corso...'
                        : payWithCredits
                          ? 'Crea ordine'
                          : 'Ordina (da pagare al ritiro)'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {alertMsg && (
        <ConfirmModal
          open={alertMsg !== null}
          variant="alert"
          title="Attenzione"
          message={alertMsg}
          confirmLabel="OK"
          onConfirm={() => setAlertMsg(null)}
          onCancel={() => setAlertMsg(null)}
        />
      )}
    </div>
  )
}
