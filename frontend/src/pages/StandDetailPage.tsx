import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { AliasManager } from '../components/AliasManager'
import { apiRequest } from '../lib/api'
import { useEventTheme } from '../features/theme/useEventTheme'
import { fetchFavorites, createFavorite, deleteFavorite } from '../lib/favorites'
import { QRCodeDownload } from '../components/QRCodeDownload'
import { ImageUploader } from '../components/ImageUploader'
import type { UploadedImage } from '../lib/upload'
import styles from './StandDetailPage.module.scss'

type Stand = {
  id: string
  name: string
  slogan: string | null
  description: string | null
  eventIds: string[]
  createdAt: string
  updatedAt: string
}

type Station = {
  id: string
  standId: string
  name: string
  createdAt: string
  updatedAt: string
}

type EventProduct = {
  id: string
  eventId: string
  standId: string
  productId: string
  stationIds: string[]
  priceOverride: number | null
  available: boolean
  createdAt: string
  updatedAt: string
}

type EventRef = { id: string; name: string }
type ProductRef = { id: string; name: string; price: number }

type ProductFormData = {
  eventId: string
  productId: string
  stationIds: string[]
  priceOverride: string
}

const emptyProductForm: ProductFormData = { eventId: '', productId: '', stationIds: [], priceOverride: '' }

export function StandDetailPage() {
  const { standId } = useParams<{ standId: string }>()
  const [stand, setStand] = useState<Stand | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newStationName, setNewStationName] = useState('')
  const [editingStation, setEditingStation] = useState<{ id: string; name: string } | null>(null)
  const [eventTheme, setEventTheme] = useState<{ themeBrand: string | null; themeText: string | null; themeSurface: string | null; themeHighlight: string | null } | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favId, setFavId] = useState<string | null>(null)
  const [favLoading, setFavLoading] = useState(false)
  const [eventProducts, setEventProducts] = useState<EventProduct[]>([])
  const [events, setEvents] = useState<EventRef[]>([])
  const [products, setProducts] = useState<ProductRef[]>([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [productForm, setProductForm] = useState<ProductFormData>(emptyProductForm)
  const [showNewProductForm, setShowNewProductForm] = useState(false)
  const [newProductForm, setNewProductForm] = useState({ name: '', ingredients: '', price: '', coverImage: null as UploadedImage | null, gallery: [] as UploadedImage[] })
  const [selectedActionEventId, setSelectedActionEventId] = useState('')

  const fetchStand = async () => {
    const data = await apiRequest<{ item: Stand }>(`/stands/${standId}`)
    setStand(data.item)
  }

  const fetchEventTheme = async (eventId: string) => {
    try {
      const data = await apiRequest<{ item: { themeBrand: string | null; themeText: string | null; themeSurface: string | null; themeHighlight: string | null } }>(`/events/${eventId}`)
      setEventTheme(data.item)
    } catch { /* not required */ }
  }

  const fetchStations = async () => {
    const data = await apiRequest<{ items: Station[] }>(`/stations?standId=${standId}`)
    setStations(data.items)
    setIsLoading(false)
  }

  const checkFavorite = async () => {
    if (!standId) return
    try {
      const data = await fetchFavorites()
      for (const fav of data.items) {
        if (fav.stand?.id === standId) {
          setIsFavorite(true)
          setFavId(fav.id)
          return
        }
      }
      setIsFavorite(false)
      setFavId(null)
    } catch { /* not required */ }
  }

  useEffect(() => {
    if (standId) {
      fetchStand()
      fetchStations()
      checkFavorite()
    }
  }, [standId])

  useEffect(() => {
    if (stand?.eventIds?.[0]) {
      fetchEventTheme(stand.eventIds[0])
    }
  }, [stand])

  useEventTheme(eventTheme)

  const toggleFavorite = async () => {
    if (!standId || favLoading) return
    setFavLoading(true)
    try {
      if (isFavorite && favId) {
        await deleteFavorite(favId)
        setIsFavorite(false)
        setFavId(null)
      } else {
        const data = await createFavorite({ standId })
        setIsFavorite(true)
        setFavId(data.item.id)
      }
    } catch { /* not required */ }
    setFavLoading(false)
  }

  const createStation = async () => {
    if (!newStationName.trim()) return
    await apiRequest('/stations', {
      method: 'POST',
      bodyJson: { standId, name: newStationName.trim() },
    })
    setNewStationName('')
    await fetchStations()
  }

  const updateStation = async () => {
    if (!editingStation || !editingStation.name.trim()) return
    await apiRequest(`/stations/${editingStation.id}`, {
      method: 'PATCH',
      bodyJson: { name: editingStation.name.trim() },
    })
    setEditingStation(null)
    await fetchStations()
  }

  const deleteStation = async (id: string) => {
    await apiRequest(`/stations/${id}`, { method: 'DELETE' })
    await fetchStations()
  }

  const fetchEventProducts = async () => {
    try {
      const data = await apiRequest<{ items: EventProduct[] }>(`/event-products?standId=${standId}`)
      setEventProducts(data.items)
    } catch { /* not required */ }
  }

  const fetchRefs = async () => {
    try {
      const [eventsData, productsData] = await Promise.all([
        apiRequest<{ items: EventRef[] }>('/events'),
        apiRequest<{ items: ProductRef[] }>('/products'),
      ])
      setEvents(eventsData.items)
      setProducts(productsData.items)
    } catch { /* not required */ }
  }

  useEffect(() => {
    if (standId) {
      fetchEventProducts()
      fetchRefs()
    }
  }, [standId])

  useEffect(() => {
    if (window.location.hash === '#prodotti') {
      document.getElementById('prodotti')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [eventProducts])

  useEffect(() => {
    if (stand && events.length > 0 && !selectedActionEventId) {
      const first = stand.eventIds.find((id) => events.some((e) => e.id === id))
      if (first) setSelectedActionEventId(first)
    }
  }, [stand, events, selectedActionEventId])

  useEffect(() => {
    if (!selectedActionEventId) {
      setSelectedEventUnifiedCashier(false)
      return
    }
    apiRequest<{ item: { unifiedCashierEnabled: boolean } }>(`/events/${selectedActionEventId}`)
      .then((data) => setSelectedEventUnifiedCashier(data.item.unifiedCashierEnabled ?? false))
      .catch(() => setSelectedEventUnifiedCashier(false))
  }, [selectedActionEventId])

  const toggleProductStation = (stationId: string) => {
    setProductForm((prev) => ({
      ...prev,
      stationIds: prev.stationIds.includes(stationId)
        ? prev.stationIds.filter((id) => id !== stationId)
        : [...prev.stationIds, stationId],
    }))
  }

  const createEventProduct = async () => {
    await apiRequest('/event-products', {
      method: 'POST',
      bodyJson: {
        eventId: productForm.eventId,
        standId,
        productId: productForm.productId,
        stationIds: productForm.stationIds,
        priceOverride: productForm.priceOverride ? Number(productForm.priceOverride) : null,
      },
    })
    setShowProductForm(false)
    setProductForm(emptyProductForm)
    await fetchEventProducts()
  }

  const deleteEventProduct = async (id: string) => {
    await apiRequest(`/event-products/${id}`, { method: 'DELETE' })
    await fetchEventProducts()
  }

  const createNewProduct = async () => {
    const data = await apiRequest<{ item: ProductRef }>('/products', {
      method: 'POST',
      bodyJson: {
        name: newProductForm.name,
        ingredients: newProductForm.ingredients.split(',').map((s) => s.trim()).filter(Boolean),
        price: Number(newProductForm.price),
        coverImage: newProductForm.coverImage,
        gallery: newProductForm.gallery,
      },
    })
    setShowNewProductForm(false)
    setNewProductForm({ name: '', ingredients: '', price: '', coverImage: null, gallery: [] })
    setProducts((prev) => [...prev, data.item])
    setShowProductForm(true)
    setProductForm({ ...emptyProductForm, productId: data.item.id })
  }

  const eventName = (id: string) => events.find((e) => e.id === id)?.name ?? id
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id

  const filteredEventProducts = selectedActionEventId
    ? eventProducts.filter((ep) => ep.eventId === selectedActionEventId)
    : eventProducts

  if (isLoading || !stand) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to="/stands" className={styles.backLink}>&larr; Torna agli stand</Link>

        <div className={styles.header}>
          <div>
            <span className="eyebrow">Stand</span>
            <h1 className={styles.title}>{stand.name}</h1>
            {stand.slogan && <p className={styles.slogan}>{stand.slogan}</p>}
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ''}`}
              onClick={toggleFavorite}
              aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            >
              {isFavorite ? '\u2764' : '\u2661'}
            </button>
            <QRCodeDownload
              apiPath={`/stands/${standId}/qrcode${selectedActionEventId ? `?eventId=${selectedActionEventId}` : ''}`}
              fileName={`stand-${stand.name}`}
            />
          </div>
        </div>

        {stand.description && (
          <div className={styles.desc} dangerouslySetInnerHTML={{ __html: stand.description }} />
        )}

        <div className={styles.actionSection}>
          <div className={styles.actionRow}>
            <label className={styles.actionLabel}>Evento</label>
            <select
              value={selectedActionEventId}
              onChange={(e) => setSelectedActionEventId(e.target.value)}
              className={styles.actionSelect}
            >
              {events.filter((ev) => stand.eventIds.includes(ev.id)).length === 0 && (
                <option value="">Nessun evento</option>
              )}
              {events.filter((ev) => stand.eventIds.includes(ev.id)).map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>

        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Postazioni</h2>

          <div className={styles.addForm}>
            <input
              value={newStationName}
              onChange={(e) => setNewStationName(e.target.value)}
              placeholder="Nome postazione (es. Cucina, Griglia, Bibite)"
              onKeyDown={(e) => e.key === 'Enter' && createStation()}
            />
            <button className={styles.primaryBtn} onClick={createStation}>
              Aggiungi
            </button>
          </div>

          <div className={styles.stationList}>
            {stations.map((station) => (
              <div key={station.id} className={styles.stationCard}>
                {editingStation?.id === station.id ? (
                  <div className={styles.editRow}>
                    <input
                      value={editingStation.name}
                      onChange={(e) => setEditingStation({ ...editingStation, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && updateStation()}
                    />
                    <button className={styles.textBtn} onClick={updateStation}>Salva</button>
                    <button className={styles.textBtn} onClick={() => setEditingStation(null)}>Annulla</button>
                  </div>
                ) : (
                  <>
                    <Link className={styles.stationName} to={`/orders/station/${station.id}`}>{station.name}</Link>
                    <div className={styles.stationActions}>
                      <button className={styles.textBtn} onClick={() => setEditingStation({ id: station.id, name: station.name })}>
                        Modifica
                      </button>
                      <button className={styles.dangerBtn} onClick={() => deleteStation(station.id)}>
                        Elimina
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {stations.length === 0 && (
              <p className={styles.empty}>Nessuna postazione. Aggiungine una.</p>
            )}
          </div>
        </section>

        <section className={styles.section} id="prodotti">
          <h2 className={styles.sectionTitle}>Prodotti ({filteredEventProducts.length})</h2>

          {!showProductForm && !showNewProductForm && (
            <div className={styles.productActions}>
              <button className={styles.primaryBtn} onClick={() => { setShowNewProductForm(true); setShowProductForm(false) }}>
                Nuovo prodotto
              </button>
              <button className={styles.secondaryBtn} onClick={() => { setShowProductForm(true); setShowNewProductForm(false) }}>
                Aggiungi esistente
              </button>
            </div>
          )}

          {showNewProductForm && (
            <form className={styles.productForm} onSubmit={(e) => { e.preventDefault(); createNewProduct() }}>
              <h3 className={styles.formSubtitle}>Nuovo prodotto</h3>
              <div className={styles.field}>
                <label htmlFor="np-name">Nome *</label>
                <input id="np-name" value={newProductForm.name} onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })} required />
              </div>
              <div className={styles.field}>
                <label htmlFor="np-ingredients">Ingredienti (separati da virgola)</label>
                <input id="np-ingredients" value={newProductForm.ingredients} onChange={(e) => setNewProductForm({ ...newProductForm, ingredients: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="np-price">Prezzo standard *</label>
                <input id="np-price" type="number" step="0.01" min="0" value={newProductForm.price} onChange={(e) => setNewProductForm({ ...newProductForm, price: e.target.value })} required />
              </div>
              <ImageUploader
                mode="single"
                type="product"
                value={newProductForm.coverImage}
                onChange={(data) => setNewProductForm({ ...newProductForm, coverImage: data as UploadedImage | null })}
                label="Immagine di copertina"
              />
              <ImageUploader
                mode="multiple"
                type="product"
                value={newProductForm.gallery}
                onChange={(data) => setNewProductForm({ ...newProductForm, gallery: data as UploadedImage[] })}
                label="Galleria"
              />
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={!newProductForm.name || !newProductForm.price}>
                  Crea e associa
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowNewProductForm(false)}>
                  Annulla
                </button>
              </div>
            </form>
          )}

          {showProductForm && (
            <form className={styles.productForm} onSubmit={(e) => { e.preventDefault(); createEventProduct() }}>
              <h3 className={styles.formSubtitle}>Associa prodotto esistente</h3>
              <div className={styles.field}>
                <label htmlFor="ep-event">Evento</label>
                <select id="ep-event" value={productForm.eventId} onChange={(e) => setProductForm({ ...productForm, eventId: e.target.value, stationIds: [] })} required>
                  <option value="">Seleziona evento</option>
                  {events.filter((ev) => stand.eventIds.includes(ev.id)).map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="ep-product">Prodotto</label>
                <select id="ep-product" value={productForm.productId} onChange={(e) => setProductForm({ ...productForm, productId: e.target.value })} required>
                  <option value="">Seleziona prodotto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.price.toFixed(2)} &euro;)</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="ep-price">Prezzo personalizzato (opzionale)</label>
                <input id="ep-price" type="number" step="0.01" min="0" value={productForm.priceOverride} placeholder="Lascia vuoto per usare il prezzo standard" onChange={(e) => setProductForm({ ...productForm, priceOverride: e.target.value })} />
              </div>

              <div className={styles.field}>
                <label>Postazioni</label>
                <div className={styles.checkboxGroup}>
                  {stations.map((st) => (
                    <label key={st.id} className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={productForm.stationIds.includes(st.id)}
                        onChange={() => toggleProductStation(st.id)}
                      />
                      {st.name}
                    </label>
                  ))}
                  {stations.length === 0 && (
                    <span className={styles.hint}>Crea prima le postazioni.</span>
                  )}
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={!productForm.eventId || !productForm.productId || productForm.stationIds.length === 0}>
                  Associa
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowProductForm(false)}>
                  Annulla
                </button>
              </div>
            </form>
          )}

          <div className={styles.productList}>
            {filteredEventProducts.map((ep) => (
              <div key={ep.id} className={styles.productCard}>
                <div className={styles.productCardBody}>
                  <strong>{productName(ep.productId)}</strong>
                  <span className={styles.productEvent}>{eventName(ep.eventId)}</span>
                  <span className={styles.productStations}>
                    {stations.filter((s) => ep.stationIds.includes(s.id)).map((s) => s.name).join(', ')}
                  </span>
                  {ep.priceOverride !== null && (
                    <span className={styles.productPrice}>{ep.priceOverride.toFixed(2)} &euro;</span>
                  )}
                </div>
                <div className={styles.productCardActions}>
                  <button
                    className={`${styles.availabilityBtn} ${ep.available ? '' : styles.unavailableBtn}`}
                    onClick={async () => {
                      try {
                        await apiRequest(`/event-products/${ep.id}`, { method: 'PATCH', bodyJson: { available: !ep.available } })
                        setEventProducts((prev) => prev.map((p) => p.id === ep.id ? { ...p, available: !p.available } : p))
                      } catch {}
                    }}
                  >
                    {ep.available ? 'Disponibile' : 'Non disp.'}
                  </button>
                  <button className={styles.dangerBtn} onClick={() => deleteEventProduct(ep.id)}>
                    Rimuovi
                  </button>
                </div>
              </div>
            ))}

            {filteredEventProducts.length === 0 && !showProductForm && !showNewProductForm && (
              <p className={styles.empty}>Nessun prodotto associato a questo stand.</p>
            )}
          </div>
        </section>

        <AliasManager entityType="stand" entityRef={standId!} />
      </div>
    </div>
  )
}
