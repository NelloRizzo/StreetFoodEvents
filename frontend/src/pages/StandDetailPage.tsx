import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useEventTheme } from '../features/theme/useEventTheme'
import { useAdminEvent } from '../layouts/AdminEventContext'
import { fetchFavorites, createFavorite, deleteFavorite } from '../lib/favorites'
import { QRCodeDownload } from '../components/QRCodeDownload'
import { ImageUploader } from '../components/ImageUploader'
import { OverlayPanel } from '../components/OverlayPanel'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import { CategorySelect } from '../components/CategorySelect'
import { ALLERGEN_OPTIONS } from '../lib/allergens'
import { eventWithDate } from '../lib/events'
import { stripHtml } from '../lib/socialMenu'
import { RichEditor } from '../components/RichEditor'
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
  sequenceOrder?: number
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
  categoryIds: string[]
  available: boolean
  sequenceOrder?: number
  createdAt: string
  updatedAt: string
}

/* `startDate` serve a distinguere due edizioni della stessa manifestazione:
   senza la data una `<select>` con dentro "Street Food Roma" due volte non
   lascia scegliere quale sia. Il dato arriva gia' da `GET /api/events`
   (lo rimanda `toEventResponse`), quindi qui basta tiparlo. */
type EventRef = { id: string; name: string; startDate: string; currencyName: string; currencySymbol: UploadedImage | null }
type ProductRef = { id: string; name: string; price: number }

/* Niente `eventId`: l'evento e' quello attivo nella barra laterale
   (`AdminEventContext`), unico posto dove si sceglie. Metterlo anche qui
   faceva scegliere due volte la stessa cosa, e con due edizioni della stessa
   manifestazione la select era quella che le distingueva. */
type ProductFormData = {
  productId: string
  stationIds: string[]
  priceOverride: string
  categoryIds: string[]
}

const emptyProductForm: ProductFormData = { productId: '', stationIds: [], priceOverride: '', categoryIds: [] }

export function StandDetailPage() {
  const { standId } = useParams<{ standId: string }>()
  const { selectedEventId } = useAdminEvent()
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
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    description: '',
    ingredients: '',
    allergens: [] as string[],
    isFrozen: false,
    price: '',
    coverImage: null as UploadedImage | null,
    gallery: [] as UploadedImage[],
  })

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

  const moveStation = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= stations.length) return

    const next = [...stations]
    const [moving] = next.splice(index, 1)
    next.splice(target, 0, moving)

    const items = next.map((s, i) => ({ stationId: s.id, sequenceOrder: i + 1 }))

    setStations((prev) => {
      const orderById = new Map(items.map((it) => [it.stationId, it.sequenceOrder]))
      return prev.map((s) => (orderById.has(s.id) ? { ...s, sequenceOrder: orderById.get(s.id)! } : s))
    })

    try {
      await apiRequest('/stations/reorder', { method: 'PATCH', bodyJson: { items } })
    } catch {
      await fetchStations()
    }
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

  const toggleProductStation = (stationId: string) => {
    setProductForm((prev) => ({
      ...prev,
      stationIds: prev.stationIds.includes(stationId)
        ? prev.stationIds.filter((id) => id !== stationId)
        : [...prev.stationIds, stationId],
    }))
  }

  const createEventProduct = async () => {
    /* Senza evento attivo non c'e' dove associare il prodotto: il pulsante
       resta disabilitato e questa guardia e' per il tipo, non per l'utente. */
    if (!selectedEventId) return

    await apiRequest('/event-products', {
      method: 'POST',
      bodyJson: {
        eventId: selectedEventId,
        standId,
        productId: productForm.productId,
        stationIds: productForm.stationIds,
        priceOverride: productForm.priceOverride ? Number(productForm.priceOverride) : null,
        categoryIds: productForm.categoryIds,
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

  const moveProduct = async (index: number, direction: -1 | 1) => {
    const list = filteredEventProducts
    const target = index + direction
    if (target < 0 || target >= list.length) return

    const next = [...list]
    const [moving] = next.splice(index, 1)
    next.splice(target, 0, moving)

    const items = next.map((ep, i) => ({ epId: ep.id, sequenceOrder: i + 1 }))

    setEventProducts((prev) => {
      const orderById = new Map(items.map((it) => [it.epId, it.sequenceOrder]))
      return prev.map((ep) => (orderById.has(ep.id) ? { ...ep, sequenceOrder: orderById.get(ep.id)! } : ep))
    })

    try {
      await apiRequest('/event-products/reorder', { method: 'PATCH', bodyJson: { items } })
    } catch {
      await fetchEventProducts()
    }
  }

  const createNewProduct = async () => {
    /* Descrizione HTML sanificata lato server: un editor vuoto da' `<p></p>`
       e una descrizione assente non deve viaggiare come markup vuoto. */
    const description = stripHtml(newProductForm.description) ? newProductForm.description.trim() : null
    const data = await apiRequest<{ item: ProductRef }>('/products', {
      method: 'POST',
      bodyJson: {
        name: newProductForm.name,
        description,
        ingredients: newProductForm.ingredients.split(',').map((s) => s.trim()).filter(Boolean),
        allergens: newProductForm.allergens,
        isFrozen: newProductForm.isFrozen,
        price: Number(newProductForm.price),
        coverImage: newProductForm.coverImage,
        gallery: newProductForm.gallery,
      },
    })
    setShowNewProductForm(false)
    setNewProductForm({ name: '', description: '', ingredients: '', allergens: [], isFrozen: false, price: '', coverImage: null, gallery: [] })
    setProducts((prev) => [...prev, data.item])
    setShowProductForm(true)
    setProductForm({ ...emptyProductForm, productId: data.item.id })
  }

  const toggleNewAllergen = (value: string) => {
    setNewProductForm((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(value)
        ? prev.allergens.filter((a) => a !== value)
        : [...prev.allergens, value],
    }))
  }

  /* Il nome evento porta la data: due edizioni della stessa manifestazione
     altrimenti sarebbero due voci identiche. L'id resta il fallback quando
     l'evento non e' in lista (non deve accadere, ma un id e' meglio di un
     buco). */
  const eventName = (id: string) => eventWithDate(events.find((e) => e.id === id)) || id
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id

  const filteredEventProducts = (selectedEventId
    ? eventProducts.filter((ep) => ep.eventId === selectedEventId)
    : eventProducts
  )
    .slice()
    .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0))

  /* L'evento attivo, con la sua moneta: serve al modulo di associazione, che
     non lo sceglie piu' e quindi lo deve leggere. */
  const activeEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) : undefined
  const activeCurrency = activeEvent?.currencyName
    ? activeEvent.currencyName.charAt(0).toUpperCase()
    : '€'

  /* Il link breve del menu e' annidato in quello dell'evento:
     `/show/stand/<alias evento>/<nome stand>`.
     Il segmento dello stand non si crea piu' qui: si ricava dal suo nome, in
     `lib/socialMenu.ts`. Per questo la pagina non ha piu' un campo "Link
     alias": la sorgente e' il link breve dell'evento, che si imposta dalla
     pagina dell'evento. */

  const sortedStations = stations.slice().sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0))

  if (isLoading || !stand) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">

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
              apiPath={`/stands/${standId}/qrcode${selectedEventId ? `?eventId=${selectedEventId}` : ''}`}
              fileName={`stand-${stand.name}`}
            />
          </div>
        </div>

        {stand.description && (
          <div className={styles.desc} dangerouslySetInnerHTML={{ __html: stand.description }} />
        )}

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
            {sortedStations.map((station, index) => (
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
                      {sortedStations.length > 1 && (
                        <div className={styles.reorderBtns}>
                          <button
                            className={styles.reorderBtn}
                            onClick={() => moveStation(index, -1)}
                            disabled={index === 0}
                            title="Sposta su"
                          >
                            ▲
                          </button>
                          <button
                            className={styles.reorderBtn}
                            onClick={() => moveStation(index, 1)}
                            disabled={index === sortedStations.length - 1}
                            title="Sposta giù"
                          >
                            ▼
                          </button>
                        </div>
                      )}
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

          {/* I due moduli stanno in un drawer laterale (`OverlayPanel`):
              inline il primo spingeva il resto della sezione fuori schermo,
              e il secondo si apriva *sotto* la lista dei prodotti, lontano
              dal bottone che lo apre. Il footer e' fuori dal `<form>` e
              invia con l'attributo `form=`, altrimenti non invierebbe. */}
          <OverlayPanel
            open={showNewProductForm}
            placement="right"
            title="Nuovo prodotto"
            onClose={() => setShowNewProductForm(false)}
            footer={
              <>
                <button
                  type="submit"
                  form="new-product-form"
                  className={styles.primaryBtn}
                  disabled={!newProductForm.name || !newProductForm.price}
                >
                  Crea e associa
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowNewProductForm(false)}>
                  Annulla
                </button>
              </>
            }
          >
            <form
              id="new-product-form"
              className={styles.formFlush}
              onSubmit={(e) => { e.preventDefault(); createNewProduct() }}
            >
              <div className={styles.field}>
                <label htmlFor="np-name">Nome *</label>
                <input id="np-name" value={newProductForm.name} onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })} required />
              </div>
              <div className={styles.field}>
                <label>Descrizione</label>
                <RichEditor
                  value={newProductForm.description}
                  onChange={(html) => setNewProductForm({ ...newProductForm, description: html })}
                  placeholder="Descrizione breve del prodotto (opzionale)"
                  maxLength={2000}
                  imageUploadType="product"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="np-ingredients">Ingredienti (separati da virgola)</label>
                <input id="np-ingredients" value={newProductForm.ingredients} onChange={(e) => setNewProductForm({ ...newProductForm, ingredients: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label>Allergeni (Reg. UE 1169/2011)</label>
                <div className={styles.allergenGrid}>
                  {ALLERGEN_OPTIONS.map((opt) => (
                    <label key={opt.value} className={styles.allergenCheck}>
                      <input
                        type="checkbox"
                        checked={newProductForm.allergens.includes(opt.value)}
                        onChange={() => toggleNewAllergen(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={newProductForm.isFrozen}
                  onChange={(e) => setNewProductForm({ ...newProductForm, isFrozen: e.target.checked })}
                />
                <span>Prodotto congelato *</span>
              </label>
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
            </form>
          </OverlayPanel>

          <OverlayPanel
            open={showProductForm}
            placement="right"
            title="Associa prodotto esistente"
            onClose={() => setShowProductForm(false)}
            footer={
              <>
                <button
                  type="submit"
                  form="link-existing-form"
                  className={styles.primaryBtn}
                  disabled={!selectedEventId || !productForm.productId || productForm.stationIds.length === 0}
                >
                  Associa
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowProductForm(false)}>
                  Annulla
                </button>
              </>
            }
          >
            <form
              id="link-existing-form"
              className={styles.formFlush}
              onSubmit={(e) => { e.preventDefault(); createEventProduct() }}
            >
              {/* L'evento non si sceglie qui: e' quello attivo nella barra
                  laterale, e il prodotto va associato a quello. Mostriamo
                  quale, perche' con due edizioni della stessa manifestazione
                  la differenza si vede solo nella data. */}
              <div className={styles.field}>
                <label>Evento</label>
                <p className={styles.hint}>
                  {activeEvent
                    ? eventWithDate(activeEvent)
                    : 'Nessun evento attivo: scegline uno dalla barra laterale.'}
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor="ep-product">Prodotto</label>
                <select id="ep-product" value={productForm.productId} onChange={(e) => setProductForm({ ...productForm, productId: e.target.value })} required>
                <option value="">Seleziona prodotto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.price.toFixed(2)} {activeCurrency})</option>
                ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="ep-price">Prezzo personalizzato (opzionale)</label>
                <input id="ep-price" type="number" step="0.01" min="0" value={productForm.priceOverride} placeholder="Lascia vuoto per usare il prezzo standard" onChange={(e) => setProductForm({ ...productForm, priceOverride: e.target.value })} />
              </div>

              <div className={styles.field}>
                <label>Categorie</label>
                <CategorySelect
                  value={productForm.categoryIds}
                  onChange={(categoryIds) => setProductForm({ ...productForm, categoryIds })}
                />
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
            </form>
          </OverlayPanel>

          <div className={styles.productList}>
            {filteredEventProducts.map((ep, index) => (
              <div key={ep.id} className={styles.productCard}>
                <div className={styles.productCardBody}>
                  <strong>{productName(ep.productId)}</strong>
                  <span className={styles.productEvent}>{eventName(ep.eventId)}</span>
                  <span className={styles.productStations}>
                    {stations.filter((s) => ep.stationIds.includes(s.id)).map((s) => s.name).join(', ')}
                  </span>
                  {ep.categoryIds?.length > 0 && ep.categoryIds.map((cat) => (
                    <span key={cat} className={styles.productCategory}>{cat}</span>
                  ))}
                  {ep.priceOverride !== null && (
                    <span className={styles.productPrice}>
                      {(() => {
                        const ev = events.find((e) => e.id === ep.eventId)
                        return ev ? (
                          <>
                            <CurrencyDisplay currencyName={ev.currencyName} currencySymbol={ev.currencySymbol} />
                            &nbsp;{ep.priceOverride.toFixed(2)}
                          </>
                        ) : (
                          <>&euro;{ep.priceOverride.toFixed(2)}</>
                        )
                      })()}
                    </span>
                  )}
                </div>
                <div className={styles.productCardActions}>
                  {selectedEventId && filteredEventProducts.length > 1 && (
                    <div className={styles.reorderBtns}>
                      <button
                        className={styles.reorderBtn}
                        onClick={() => moveProduct(index, -1)}
                        disabled={index === 0}
                        title="Sposta su nel menu"
                      >
                        ▲
                      </button>
                      <button
                        className={styles.reorderBtn}
                        onClick={() => moveProduct(index, 1)}
                        disabled={index === filteredEventProducts.length - 1}
                        title="Sposta giù nel menu"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                  <button
                    className={`${styles.availabilityBtn} ${ep.available ? '' : styles.unavailableBtn}`}
                    onClick={async () => {
                      try {
                        await apiRequest(`/event-products/${ep.id}`, { method: 'PATCH', bodyJson: { available: !ep.available } })
                        setEventProducts((prev) => prev.map((p) => p.id === ep.id ? { ...p, available: !p.available } : p))
                      } catch { /* noop */ }
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

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Link breve</h2>
          <p className={styles.hint}>
            Il link breve dello stand si compone da solo: link breve
            dell&apos;evento + nome dello stand (es.{' '}
            <code>/show/stand/nome-evento/nome-stand</code>). Non si crea qui:
            si imposta il link breve dell&apos;evento nella{' '}
            <Link to="/admin/events">pagina dell&apos;evento</Link>.
          </p>
        </section>
      </div>
    </div>
  )
}
