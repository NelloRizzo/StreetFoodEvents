import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { CategorySelect, type EventCategory } from '../components/CategorySelect'
import styles from './EventProductsPage.module.scss'

type EventProduct = {
  id: string
  eventId: string
  standId: string
  productId: string
  stationIds: string[]
  priceOverride: number | null
  categoryId: string | null
  available: boolean
  createdAt: string
  updatedAt: string
}

type Event = { id: string; name: string; currencyName: string; categories: EventCategory[] }
type Stand = { id: string; name: string; eventIds: string[] }
type Product = { id: string; name: string; price: number }
type Station = { id: string; name: string }

type FormData = {
  eventId: string
  standId: string
  productId: string
  stationIds: string[]
  priceOverride: string
  categoryId: string
}

const emptyForm: FormData = { eventId: '', standId: '', productId: '', stationIds: [], priceOverride: '', categoryId: '' }

export function EventProductsPage() {
  const [items, setItems] = useState<EventProduct[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [stands, setStands] = useState<Stand[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [filteredStands, setFilteredStands] = useState<Stand[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [filterEventId, setFilterEventId] = useState('')

  const loadItems = async (eventId: string) => {
    try {
      const data = await apiRequest<{ items: EventProduct[] }>(`/event-products${eventId ? `?eventId=${eventId}` : ''}`)
      setItems(data.items)
    } catch { /* ignore */ }
    setIsLoading(false)
  }

  useEffect(() => {
    apiRequest<{ items: EventProduct[] }>('/event-products')
      .then((d) => setItems(d.items))
      .catch(() => { /* ignore */ })
      .finally(() => setIsLoading(false))

    Promise.all([
      apiRequest<{ items: Event[] }>('/events'),
      apiRequest<{ items: Stand[] }>('/stands'),
      apiRequest<{ items: Product[] }>('/products'),
      apiRequest<{ items: Station[] }>('/stations'),
    ])
      .then(([eventsData, standsData, productsData, stationsData]) => {
        setEvents(eventsData.items)
        setStands(standsData.items)
        setProducts(productsData.items)
        setStations(stationsData.items)
      })
      .catch(() => { /* not required */ })
  }, [])

  const handleFilterEventChange = (eventId: string) => {
    setFilterEventId(eventId)
    void loadItems(eventId)
  }

  const handleEventChange = (eventId: string) => {
    setForm({ ...emptyForm, eventId })
    setFilteredStands(stands.filter((s) => s.eventIds?.includes(eventId)))
    setStations([])
  }

  const eventCategories = (eventId: string): EventCategory[] =>
    events.find((e) => e.id === eventId)?.categories ?? []

  const updateEventCategories = (eventId: string, categories: EventCategory[]) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, categories } : e)))
  }

  const currencyInitial = (eventId: string) => {
    const ev = events.find((e) => e.id === eventId)
    return ev?.currencyName ? ev.currencyName.charAt(0).toUpperCase() : '€'
  }

  const handleStandChange = async (standId: string) => {
    setForm({ ...form, standId, stationIds: [] })
    if (standId) {
      const data = await apiRequest<{ items: Station[] }>(`/stations?standId=${standId}`)
      setStations(data.items)
    } else {
      setStations([])
    }
  }

  const openCreate = () => {
    setForm(emptyForm)
    setFilteredStands([])
    setStations([])
    setShowForm(true)
  }

  const toggleStation = (stationId: string) => {
    setForm((prev) => ({
      ...prev,
      stationIds: prev.stationIds.includes(stationId)
        ? prev.stationIds.filter((id) => id !== stationId)
        : [...prev.stationIds, stationId],
    }))
  }

  const handleSubmit = async () => {
    const bodyJson = {
      eventId: form.eventId,
      standId: form.standId,
      productId: form.productId,
      stationIds: form.stationIds,
      priceOverride: form.priceOverride ? Number(form.priceOverride) : null,
      categoryId: form.categoryId || null,
    }

    await apiRequest('/event-products', {
      method: 'POST',
      bodyJson,
    })

    setShowForm(false)
    setForm(emptyForm)
    setFilteredStands([])
    setStations([])
    await loadItems(filterEventId)
  }

  const handleDelete = async (id: string) => {
    setDeleteTarget(id)
  }

  const updateCardCategory = async (ep: EventProduct, categoryId: string) => {
    try {
      await apiRequest(`/event-products/${ep.id}`, { method: 'PATCH', bodyJson: { categoryId: categoryId || null } })
      setItems((prev) => prev.map((p) => (p.id === ep.id ? { ...p, categoryId: categoryId || null } : p)))
    } catch { /* ignore */ }
  }

  const eventName = (id: string) => events.find((e) => e.id === id)?.name ?? id
  const standName = (id: string) => stands.find((s) => s.id === id)?.name ?? id
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id
  const stationName = (id: string) => stations.find((st) => st.id === id)?.name ?? id

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Associazioni</span>
            <h1 className={styles.title}>Prodotti per evento</h1>
          </div>
          <button className={styles.primaryBtn} onClick={openCreate}>
            Associa prodotto
          </button>
        </div>

        <div className={styles.filterBar}>
          <label htmlFor="ep-filter-event">Filtra per evento</label>
          <select id="ep-filter-event" value={filterEventId} onChange={(e) => handleFilterEventChange(e.target.value)}>
            <option value="">Tutti gli eventi</option>
            {[...events]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
          </select>
        </div>

        {showForm && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            <div className={styles.field}>
              <label htmlFor="ep-event">Evento</label>
              <select id="ep-event" value={form.eventId} onChange={(e) => handleEventChange(e.target.value)} required>
                <option value="">Seleziona evento</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="ep-stand">Stand</label>
              <select id="ep-stand" value={form.standId} onChange={(e) => handleStandChange(e.target.value)} required>
                <option value="">Seleziona stand</option>
                {filteredStands.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="ep-product">Prodotto</label>
              <select id="ep-product" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
                <option value="">Seleziona prodotto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.price.toFixed(2)} {form.eventId ? currencyInitial(form.eventId) : '€'})</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="ep-price">Prezzo personalizzato (opzionale)</label>
              <input id="ep-price" type="number" step="0.01" min="0" value={form.priceOverride} placeholder="Lascia vuoto per usare il prezzo standard" onChange={(e) => setForm({ ...form, priceOverride: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="ep-category">Categoria</label>
              <CategorySelect
                id="ep-category"
                eventId={form.eventId}
                categories={eventCategories(form.eventId)}
                value={form.categoryId}
                onChange={(categoryId) => setForm({ ...form, categoryId })}
                onCategoriesChange={(cats) => updateEventCategories(form.eventId, cats)}
              />
            </div>

            <div className={styles.field}>
              <label>Postazioni</label>
              {stations.length === 0 ? (
                <p className={styles.hint}>Seleziona prima evento e stand per vedere le postazioni.</p>
              ) : (
                <div className={styles.checkboxGroup}>
                  {stations.map((st) => (
                    <label key={st.id} className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={form.stationIds.includes(st.id)}
                        onChange={() => toggleStation(st.id)}
                      />
                      {st.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn} disabled={form.stationIds.length === 0}>
                Associa
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                Annulla
              </button>
            </div>
          </form>
        )}

        <div className={styles.list}>
          {items.map((ep) => (
            <article key={ep.id} className={styles.card}>
              <div className={styles.cardBody}>
                <strong className={styles.cardName}>{productName(ep.productId)}</strong>
                <span className={styles.cardEvent}>{eventName(ep.eventId)}</span>
                <span className={styles.cardStand}>{standName(ep.standId)}</span>
                <span className={styles.cardStations}>
                  Postazioni: {ep.stationIds.map((id) => stationName(id) || id).join(', ')}
                </span>
                <div className={styles.cardCategory}>
                  <span className={styles.cardCategoryLabel}>Categoria</span>
                  <CategorySelect
                    id={`ep-cat-${ep.id}`}
                    eventId={ep.eventId}
                    categories={eventCategories(ep.eventId)}
                    value={ep.categoryId ?? ''}
                    onChange={(categoryId) => { void updateCardCategory(ep, categoryId) }}
                    onCategoriesChange={(cats) => updateEventCategories(ep.eventId, cats)}
                  />
                </div>
                {ep.priceOverride !== null && (
                  <span className={styles.cardPrice}>Prezzo: {ep.priceOverride.toFixed(2)} {currencyInitial(ep.eventId)}</span>
                )}
              </div>
              <div className={styles.cardActions}>
                <button
                  className={`${styles.availabilityBtn} ${ep.available ? '' : styles.unavailableBtn}`}
                  onClick={async () => {
                    try {
                      await apiRequest(`/event-products/${ep.id}`, { method: 'PATCH', bodyJson: { available: !ep.available } })
                      setItems((prev) => prev.map((p) => p.id === ep.id ? { ...p, available: !p.available } : p))
                    } catch {}
                  }}
                >
                  {ep.available ? 'Disponibile' : 'Non disp.'}
                </button>
                <button className={styles.dangerBtn} onClick={() => handleDelete(ep.id)}>
                  Rimuovi
                </button>
              </div>
            </article>
          ))}

          {items.length === 0 && (
            <p className={styles.empty}>Nessuna associazione. Creane una nuova.</p>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        variant="confirm"
        title="Rimuovere associazione?"
        message="Questa azione è irreversibile."
        danger
        confirmLabel="Rimuovi"
        onConfirm={async () => {
          if (!deleteTarget) return
          await apiRequest(`/event-products/${deleteTarget}`, { method: 'DELETE' })
          setDeleteTarget(null)
          await loadItems(filterEventId)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
