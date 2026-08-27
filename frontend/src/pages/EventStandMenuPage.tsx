import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { createOrder } from '../lib/orders'
import { useEventTheme } from '../features/theme/useEventTheme'
import { useAuth } from '../features/auth/auth-context'
import { ConfirmModal } from '../components/ConfirmModal'
import { QRCodeDownload } from '../components/QRCodeDownload'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import type { UploadedImage } from '../lib/upload'
import styles from './EventStandMenuPage.module.scss'

type MenuItem = {
  id: string
  eventId: string
  standId: string
  productId: string
  product: {
    id: string
    name: string
    description: string | null
    price: number
    ingredients: string[]
    allergens: string[]
    isFrozen: boolean
    coverImage: UploadedImage | null
  } | null
  stationIds: string[]
  priceOverride: number | null
}

type CategoryMenuItem = {
  standId: string
  standName: string
  standNumber: number | null
  productId: string
  eventProductId: string
  name: string
  description: string | null
  price: number
  ingredients: string[]
  allergens: string[]
  isFrozen: boolean
  coverImage: UploadedImage | null
  categoryIds: string[]
  stationIds: string[]
}

type Event = {
  id: string
  name: string
  currencyName: string
  currencySymbol: UploadedImage | null
  themeBrand: string | null
  themeText: string | null
  themeSurface: string | null
  themeHighlight: string | null
}

type Stand = {
  id: string
  name: string
  slogan: string | null
  description: string | null
  coverImage: UploadedImage | null
  logo: UploadedImage | null
  gallery: UploadedImage[]
  numbers: { eventId: string; number: number; showOnMap: boolean }[]
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
  const [allStands, setAllStands] = useState<Stand[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [payWithCredits, setPayWithCredits] = useState(false)
  const [creditAmount, setCreditAmount] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [viewMode, setViewMode] = useState<'stand' | 'category'>('stand')
  const [categoryItems, setCategoryItems] = useState<CategoryMenuItem[]>([])
  const [categoryLabels, setCategoryLabels] = useState<string[]>([])

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
      apiRequest<{ items: Stand[] }>(`/stands?eventId=${eventId}`),
    ])
      .then(([eventData, standData, menuData, standsData]) => {
        setEvent(eventData.item)
        setStand(standData.item)
        setMenuItems(menuData.items)
        setAllStands(
          standsData.items
            .slice()
            .sort((a, b) => {
              const numA = a.numbers?.find((n) => n.eventId === eventId)?.number ?? Infinity
              const numB = b.numbers?.find((n) => n.eventId === eventId)?.number ?? Infinity
              return numA - numB
            })
        )
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [eventId, standId])

  useEffect(() => {
    if (user) setCustomerName(`${user.firstName} ${user.lastName}`)
  }, [user])

  useEffect(() => {
    if (viewMode !== 'category' || !eventId) return
    apiRequest<{ items: CategoryMenuItem[]; categories: string[] }>(`/events/${eventId}/menu`)
      .then((data) => {
        setCategoryItems(data.items)
        setCategoryLabels(data.categories)
      })
      .catch(() => {})
  }, [viewMode, eventId])

  useEffect(() => {
    if (!selectedItem) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedItem(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedItem])

  const visibleStands = useMemo(() => {
    if (!eventId) return allStands
    return allStands.filter((s) => {
      const num = s.numbers?.find((n) => n.eventId === eventId)
      return num && num.showOnMap !== false
    })
  }, [allStands, eventId])

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

        {visibleStands.length > 1 && (
          <div className={styles.standBarWrap}>
            <span className={styles.standBarLabel}>Scegli lo stand:</span>
            <nav className={styles.standBar} aria-label="Stand dell'evento">
              {visibleStands.map((s) => {
                const num = s.numbers?.find((n) => n.eventId === eventId)
                const isActive = s.id === standId && viewMode === 'stand'
                return (
                  <Link
                    key={s.id}
                    to={`/events/${eventId}/stands/${s.id}`}
                    className={`${styles.standChip} ${isActive ? styles.standChipActive : ''}`}
                    onClick={() => { if (!isActive) { setCart([]); setViewMode('stand') } }}
                  >
                    {(s.logo ?? s.coverImage) && (
                      <img src={(s.logo ?? s.coverImage)!.url} alt="" className={styles.standChipImg} />
                    )}
                    {num && <span className={styles.standChipNum}>{num.number}</span>}
                    <span className={styles.standChipName}>{s.name}</span>
                  </Link>
                )
              })}
              <button
                type="button"
                className={`${styles.standChip} ${viewMode === 'category' ? styles.standChipActive : ''}`}
                onClick={() => { setViewMode('category'); setCart([]) }}
              >
                <span className={styles.standChipName}>Per categoria</span>
              </button>
            </nav>
          </div>
        )}

        {stand.coverImage && viewMode === 'stand' && (
          <div className={styles.coverWrap}>
            <img src={stand.coverImage.url} alt={`${stand.name} — copertina`} className={styles.cover} />
          </div>
        )}

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {viewMode === 'stand' ? (
              <>
                {(stand.logo ?? stand.coverImage) && (
                  <img
                    src={(stand.logo ?? stand.coverImage)!.url}
                    alt={`${stand.name} — logo`}
                    className={styles.logo}
                  />
                )}
                <div>
                  <span className="eyebrow">Menu — {event.name}</span>
                  <h1 className={styles.title}>{stand.name}</h1>
                  {stand.slogan && <p className={styles.slogan}>{stand.slogan}</p>}
                </div>
              </>
            ) : (
              <div>
                <span className="eyebrow">Menu — {event.name}</span>
                <h1 className={styles.title}>Tutti i prodotti per categoria</h1>
              </div>
            )}
          </div>
          {viewMode === 'stand' && (
            <QRCodeDownload
              apiPath={`/stands/${standId}/qrcode?eventId=${eventId}`}
              fileName={`menu-${stand.name}`}
            />
          )}
        </div>

        {viewMode === 'stand' ? (
          <div className={styles.layout}>
            <div className={styles.left}>
              {stand.description && (
                <div className={styles.desc} dangerouslySetInnerHTML={{ __html: stand.description }} />
              )}

              {menuItems.length > 0 && (
                <section className={styles.menuSection}>
                  <h2 className={styles.sectionTitle}>Prodotti</h2>

                  <div className={styles.menuList}>
                  {menuItems.map((item) => {
                    const product = item.product
                    const price = item.priceOverride ?? product?.price ?? 0

                    return (
                      <div
                        key={item.id}
                        className={styles.menuCard}
                        onClick={() => setSelectedItem(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedItem(item)
                          }
                        }}
                      >
                        {product?.coverImage ? (
                          <img
                            src={product.coverImage.url}
                            alt={product.name}
                            className={styles.thumb}
                          />
                        ) : (
                          <span className={styles.thumbPlaceholder}>
                            {product?.name ? product.name.charAt(0).toUpperCase() : '?'}
                          </span>
                        )}
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
                          {price > 0 && (
                            <span className={styles.menuPrice}>
                              {price.toFixed(2)}
                              <CurrencyDisplay
                                currencyName={event.currencyName}
                                currencySymbol={event.currencySymbol}
                              />
                            </span>
                          )}
                          {isAuthenticated && (
                            <button
                              className={styles.addBtn}
                              onClick={(e) => {
                                e.stopPropagation()
                                addToCart(item)
                              }}
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
            )}

            {stand.gallery && stand.gallery.length > 0 && (
              <section className={styles.gallerySection}>
                <h2 className={styles.sectionTitle}>Galleria</h2>
                <div className={styles.galleryGrid}>
                  {stand.gallery.map((img) => (
                    <img
                      key={img.publicId}
                      src={img.url}
                      alt={`${stand.name} — galleria`}
                      className={styles.galleryImage}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          {isAuthenticated && menuItems.length > 0 && (
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
                            {(c.unitPrice * c.quantity).toFixed(2)}
                            <CurrencyDisplay
                              currencyName={event.currencyName}
                              currencySymbol={event.currencySymbol}
                            />
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
                        {total.toFixed(2)}
                        <CurrencyDisplay
                          currencyName={event.currencyName}
                          currencySymbol={event.currencySymbol}
                        />
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
        ) : (
          <div className={styles.layout}>
            <div className={styles.left}>
              {categoryLabels.length > 0 ? (
                categoryLabels.map((cat) => {
                  const items = categoryItems.filter((ci) => ci.categoryIds.includes(cat))
                  if (items.length === 0) return null
                  return (
                    <section key={cat} className={styles.menuSection}>
                      <h2 className={styles.sectionTitle}>{cat}</h2>
                      <div className={styles.menuList}>
                        {items.map((item) => (
                          <div key={item.eventProductId} className={styles.menuCard}>
                            {item.coverImage ? (
                              <img src={item.coverImage.url} alt={item.name} className={styles.thumb} />
                            ) : (
                              <span className={styles.thumbPlaceholder}>{item.name.charAt(0).toUpperCase()}</span>
                            )}
                            <div className={styles.menuInfo}>
                              <strong className={styles.menuName}>{item.name}</strong>
                              {item.standName && (
                                <span className={styles.menuIngredients}>Stand: {item.standNumber != null ? `${item.standNumber} — ` : ''}{item.standName}</span>
                              )}
                              {item.ingredients.length > 0 && (
                                <span className={styles.menuIngredients}>{item.ingredients.join(', ')}</span>
                              )}
                            </div>
                            <div className={styles.menuRight}>
                              {item.price > 0 && (
                                <span className={styles.menuPrice}>
                                  {item.price.toFixed(2)}
                                  <CurrencyDisplay currencyName={event.currencyName} currencySymbol={event.currencySymbol} />
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                })
              ) : (
                <p className={styles.emptyCart}>Nessun prodotto disponibile.</p>
              )}

              {categoryItems.some((ci) => ci.categoryIds.length === 0) && (
                <section className={styles.menuSection}>
                  <h2 className={styles.sectionTitle}>Senza categoria</h2>
                  <div className={styles.menuList}>
                    {categoryItems.filter((ci) => ci.categoryIds.length === 0).map((item) => (
                      <div key={item.eventProductId} className={styles.menuCard}>
                        {item.coverImage ? (
                          <img src={item.coverImage.url} alt={item.name} className={styles.thumb} />
                        ) : (
                          <span className={styles.thumbPlaceholder}>{item.name.charAt(0).toUpperCase()}</span>
                        )}
                        <div className={styles.menuInfo}>
                          <strong className={styles.menuName}>{item.name}</strong>
                          {item.standName && (
                            <span className={styles.menuIngredients}>Stand: {item.standNumber != null ? `${item.standNumber} — ` : ''}{item.standName}</span>
                          )}
                          {item.ingredients.length > 0 && (
                            <span className={styles.menuIngredients}>{item.ingredients.join(', ')}</span>
                          )}
                        </div>
                        <div className={styles.menuRight}>
                          {item.price > 0 && (
                            <span className={styles.menuPrice}>
                              {item.price.toFixed(2)}
                              <CurrencyDisplay currencyName={event.currencyName} currencySymbol={event.currencySymbol} />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
      {selectedItem?.product && (
        <div className={styles.overlay} onClick={() => setSelectedItem(null)}>
          <div
            className={styles.productModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={selectedItem.product.name}
          >
            {selectedItem.product.coverImage ? (
              <img
                src={selectedItem.product.coverImage.url}
                alt={selectedItem.product.name}
                className={styles.productImage}
              />
            ) : (
              <div className={styles.productImagePlaceholder}>
                {selectedItem.product.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={styles.productInfo}>
              <h2 className={styles.productName}>
                {selectedItem.product.name}
                {selectedItem.product.isFrozen && <span className={styles.frozenBadge}> *</span>}
              </h2>
              {selectedItem.product.description && (
                <p className={styles.productDescription}>{selectedItem.product.description}</p>
              )}
              {selectedItem.product.ingredients.length > 0 && (
                <p className={styles.productIngredients}>
                  <strong>Ingredienti:</strong> {selectedItem.product.ingredients.join(', ')}
                </p>
              )}
              {selectedItem.product.allergens.length > 0 && (
                <p className={styles.productAllergens}>
                  <strong>Allergeni:</strong> {selectedItem.product.allergens.join(', ')}
                </p>
              )}
              {(selectedItem.priceOverride ?? selectedItem.product.price) > 0 && (
                <span className={styles.productPrice}>
                  {(selectedItem.priceOverride ?? selectedItem.product.price).toFixed(2)}
                  <CurrencyDisplay
                    currencyName={event.currencyName}
                    currencySymbol={event.currencySymbol}
                  />
                </span>
              )}
              <p className={styles.photoDisclaimer}>La foto è solo indicativa. Il prodotto potrebbe differire da quanto mostrato.</p>
            </div>
            <div className={styles.productActions}>
              {isAuthenticated && (
                <button
                  className={styles.modalAddBtn}
                  onClick={() => addToCart(selectedItem)}
                >
                  Aggiungi al carrello
                </button>
              )}
              <button
                className={styles.modalCloseBtn}
                onClick={() => setSelectedItem(null)}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
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
