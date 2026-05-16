import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { fetchFavorites, createFavorite, deleteFavorite } from '../lib/favorites'
import { type UploadedImage } from '../lib/upload'
import { ImageUploader } from '../components/ImageUploader'
import styles from './EventsPage.module.scss'

type EventItem = {
  id: string
  name: string
  location: {
    label: string
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    province: string | null
    region: string | null
    country: string | null
    postalCode: string | null
    coordinates: { type: string; coordinates: [number, number] }
    googleMapsUrl: string | null
  }
  startDate: string
  endDate: string
  currencyName: string
  url: string | null
  shortDescription: string | null
  longDescription: string | null
  coverImage: UploadedImage | null
  logo: UploadedImage | null
  gallery: UploadedImage[]
  themeBrand: string | null
  themeText: string | null
  themeSurface: string | null
  themeHighlight: string | null
  createdAt: string
  updatedAt: string
}

type EventFormData = {
  name: string
  locationLabel: string
  addressLine1: string
  addressLine2: string
  city: string
  province: string
  region: string
  country: string
  postalCode: string
  latitude: string
  longitude: string
  googleMapsUrl: string
  startDate: string
  endDate: string
  currencyName: string
  url: string
  shortDescription: string
  longDescription: string
  coverImage: UploadedImage | null
  logo: UploadedImage | null
  gallery: UploadedImage[]
  themeBrand: string
  themeText: string
  themeSurface: string
  themeHighlight: string
}

const emptyForm: EventFormData = {
  name: '',
  locationLabel: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  province: '',
  region: '',
  country: '',
  postalCode: '',
  latitude: '',
  longitude: '',
  googleMapsUrl: '',
  startDate: '',
  endDate: '',
  currencyName: '',
  url: '',
  shortDescription: '',
  longDescription: '',
  coverImage: null,
  logo: null,
  gallery: [],
  themeBrand: '',
  themeText: '',
  themeSurface: '',
  themeHighlight: '',
}

type StandItem = {
  id: string
  name: string
  eventIds: string[]
}

export function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EventFormData>(emptyForm)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favMap, setFavMap] = useState<Map<string, string>>(new Map())
  const [standList, setStandList] = useState<StandItem[]>([])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [savingStands, setSavingStands] = useState<Set<string>>(new Set())

  const fetchEvents = async () => {
    const data = await apiRequest<{ items: EventItem[] }>('/events')
    setEvents(data.items)
    setIsLoading(false)
  }

  const fetchFavs = async () => {
    try {
      const data = await fetchFavorites()
      const ids = new Set<string>()
      const map = new Map<string, string>()
      for (const fav of data.items) {
        if (fav.event) {
          ids.add(fav.event.id)
          map.set(fav.event.id, fav.id)
        }
      }
      setFavoriteIds(ids)
      setFavMap(map)
    } catch { /* not required */ }
  }

  const fetchStands = async () => {
    try {
      const data = await apiRequest<{ items: StandItem[] }>('/stands')
      setStandList(data.items)
    } catch { /* not required */ }
  }

  useEffect(() => {
    fetchEvents()
    fetchFavs()
    fetchStands()
  }, [])

  const toggleFavorite = async (eventId: string) => {
    if (favoriteIds.has(eventId)) {
      const favId = favMap.get(eventId)
      if (favId) {
        await deleteFavorite(favId)
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(eventId); return next })
        setFavMap((prev) => { const next = new Map(prev); next.delete(eventId); return next })
      }
    } else {
      const data = await createFavorite({ eventId })
      setFavoriteIds((prev) => { const next = new Set(prev); next.add(eventId); return next })
      setFavMap((prev) => { const next = new Map(prev); next.set(eventId, data.item.id); return next })
    }
  }

  const handleToggleStand = async (standId: string, eventId: string, currentlyLinked: boolean) => {
    setSavingStands((prev) => { const next = new Set(prev); next.add(standId); return next })
    try {
      const stand = standList.find((s) => s.id === standId)
      if (!stand) return
      const newEventIds = currentlyLinked
        ? stand.eventIds.filter((id) => id !== eventId)
        : [...stand.eventIds, eventId]
      await apiRequest(`/stands/${standId}`, {
        method: 'PATCH',
        bodyJson: { eventIds: newEventIds },
      })
      setStandList((prev) =>
        prev.map((s) => (s.id === standId ? { ...s, eventIds: newEventIds } : s))
      )
    } catch { /* not required */ }
    finally {
      setSavingStands((prev) => { const next = new Set(prev); next.delete(standId); return next })
    }
  }

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (ev: EventItem) => {
    setForm({
      name: ev.name,
      locationLabel: ev.location.label,
      addressLine1: ev.location.addressLine1 ?? '',
      addressLine2: ev.location.addressLine2 ?? '',
      city: ev.location.city ?? '',
      province: ev.location.province ?? '',
      region: ev.location.region ?? '',
      country: ev.location.country ?? '',
      postalCode: ev.location.postalCode ?? '',
      latitude: String(ev.location.coordinates.coordinates[1] ?? ''),
      longitude: String(ev.location.coordinates.coordinates[0] ?? ''),
      googleMapsUrl: ev.location.googleMapsUrl ?? '',
      startDate: ev.startDate.slice(0, 10),
      endDate: ev.endDate.slice(0, 10),
      currencyName: ev.currencyName,
      url: ev.url ?? '',
      shortDescription: ev.shortDescription ?? '',
      longDescription: ev.longDescription ?? '',
      coverImage: ev.coverImage,
      logo: ev.logo,
      gallery: ev.gallery,
      themeBrand: ev.themeBrand ?? '',
      themeText: ev.themeText ?? '',
      themeSurface: ev.themeSurface ?? '',
      themeHighlight: ev.themeHighlight ?? '',
    })
    setEditingId(ev.id)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    const bodyJson = {
      name: form.name,
      location: {
        label: form.locationLabel,
        addressLine1: form.addressLine1 || null,
        addressLine2: form.addressLine2 || null,
        city: form.city || null,
        province: form.province || null,
        region: form.region || null,
        country: form.country || null,
        postalCode: form.postalCode || null,
        coordinates: {
          type: 'Point',
          coordinates: [
            Number(form.longitude) || 0,
            Number(form.latitude) || 0,
          ],
        },
        googleMapsUrl: form.googleMapsUrl || null,
      },
      startDate: form.startDate,
      endDate: form.endDate,
      currencyName: form.currencyName,
      url: form.url || null,
      shortDescription: form.shortDescription || null,
      longDescription: form.longDescription || null,
      coverImage: form.coverImage,
      logo: form.logo,
      gallery: form.gallery,
      themeBrand: form.themeBrand || null,
      themeText: form.themeText || null,
      themeSurface: form.themeSurface || null,
      themeHighlight: form.themeHighlight || null,
    }

    if (editingId) {
      await apiRequest(`/events/${editingId}`, {
        method: 'PATCH',
        bodyJson,
      })
    } else {
      await apiRequest('/events', {
        method: 'POST',
        bodyJson,
      })
    }

    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    await fetchEvents()
  }

  const handleDelete = async (id: string) => {
    await apiRequest(`/events/${id}`, { method: 'DELETE' })
    await fetchEvents()
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT')

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <a href="/dashboard" className={styles.backLink}>&larr; Dashboard</a>
            <span className="eyebrow">Gestione</span>
            <h1 className={styles.title}>Eventi</h1>
          </div>
          <button className={styles.primaryBtn} onClick={openCreate}>
            Nuovo evento
          </button>
        </div>

        {showForm && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Informazioni base</legend>
              <div className={styles.field}>
                <label htmlFor="ev-name">Nome *</label>
                <input id="ev-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="ev-start">Data inizio *</label>
                  <input id="ev-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="ev-end">Data fine *</label>
                  <input id="ev-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="ev-currency">Nome moneta evento *</label>
                <input id="ev-currency" value={form.currencyName} onChange={(e) => setForm({ ...form, currencyName: e.target.value })} placeholder="es. StreetCoin" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="ev-url">Sito ufficiale</label>
                <input id="ev-url" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Luogo</legend>
              <div className={styles.field}>
                <label htmlFor="ev-loc-label">Etichetta *</label>
                <input id="ev-loc-label" value={form.locationLabel} onChange={(e) => setForm({ ...form, locationLabel: e.target.value })} placeholder="es. Piazza Centrale" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="ev-addr1">Indirizzo</label>
                <input id="ev-addr1" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ev-addr2">Indirizzo (riga 2)</label>
                <input id="ev-addr2" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="ev-city">Città</label>
                  <input id="ev-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="ev-province">Provincia</label>
                  <input id="ev-province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="ev-region">Regione</label>
                  <input id="ev-region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="ev-country">Paese</label>
                  <input id="ev-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="ev-postal">CAP</label>
                <input id="ev-postal" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label htmlFor="ev-lat">Latitudine</label>
                  <input id="ev-lat" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="ev-lng">Longitudine</label>
                  <input id="ev-lng" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="ev-maps">URL Google Maps</label>
                <input id="ev-maps" value={form.googleMapsUrl} onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })} />
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Descrizione</legend>
              <div className={styles.field}>
                <label htmlFor="ev-short">Descrizione breve</label>
                <textarea id="ev-short" maxLength={500} value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="ev-long">Descrizione lunga</label>
                <textarea id="ev-long" rows={6} value={form.longDescription} onChange={(e) => setForm({ ...form, longDescription: e.target.value })} />
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Tema personalizzato</legend>
              <p className={styles.fieldHint}>Lascia vuoto per usare il tema stagionale di default.</p>
              <div className={styles.themeGrid}>
                <div className={styles.field}>
                  <label htmlFor="ev-theme-brand">Colore principale</label>
                  <div className={styles.colorRow}>
                    <input id="ev-theme-brand" type="color" value={form.themeBrand || '#bf5a2a'} onChange={(e) => setForm({ ...form, themeBrand: e.target.value === '#bf5a2a' ? '' : e.target.value })} />
                    <input value={form.themeBrand} onChange={(e) => setForm({ ...form, themeBrand: e.target.value })} placeholder="#bf5a2a" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="ev-theme-text">Colore testo</label>
                  <div className={styles.colorRow}>
                    <input id="ev-theme-text" type="color" value={form.themeText || '#14261f'} onChange={(e) => setForm({ ...form, themeText: e.target.value === '#14261f' ? '' : e.target.value })} />
                    <input value={form.themeText} onChange={(e) => setForm({ ...form, themeText: e.target.value })} placeholder="#14261f" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="ev-theme-surface">Colore sfondo</label>
                  <div className={styles.colorRow}>
                    <input id="ev-theme-surface" type="color" value={form.themeSurface || '#f7f2e8'} onChange={(e) => setForm({ ...form, themeSurface: e.target.value === '#f7f2e8' ? '' : e.target.value })} />
                    <input value={form.themeSurface} onChange={(e) => setForm({ ...form, themeSurface: e.target.value })} placeholder="#f7f2e8" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label htmlFor="ev-theme-highlight">Colore accento</label>
                  <div className={styles.colorRow}>
                    <input id="ev-theme-highlight" type="color" value={form.themeHighlight || '#f4c978'} onChange={(e) => setForm({ ...form, themeHighlight: e.target.value === '#f4c978' ? '' : e.target.value })} />
                    <input value={form.themeHighlight} onChange={(e) => setForm({ ...form, themeHighlight: e.target.value })} placeholder="#f4c978" />
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Immagini</legend>
              <ImageUploader
                mode="single"
                value={form.coverImage}
                onChange={(data) => setForm({ ...form, coverImage: data as UploadedImage | null })}
                label="Immagine di copertina"
              />
              <ImageUploader
                mode="single"
                value={form.logo}
                onChange={(data) => setForm({ ...form, logo: data as UploadedImage | null })}
                label="Logo"
              />
              <ImageUploader
                mode="multiple"
                value={form.gallery}
                onChange={(data) => setForm({ ...form, gallery: data as UploadedImage[] })}
                label="Galleria"
              />
            </fieldset>

            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>
                {editingId ? 'Salva modifiche' : 'Crea evento'}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                Annulla
              </button>
            </div>
          </form>
        )}

        <div className={styles.list}>
          {events.map((ev) => (
            <article key={ev.id} className={styles.card}>
              <div className={styles.cardBody}>
                <strong className={styles.cardName}>{ev.name}</strong>
                <span className={styles.cardDate}>{fmtDate(ev.startDate)} &ndash; {fmtDate(ev.endDate)}</span>
                <span className={styles.cardLocation}>{ev.location.label}</span>
                {ev.shortDescription && <span className={styles.cardDesc}>{ev.shortDescription}</span>}
              </div>
              <div className={styles.cardActions}>
                <Link className={styles.textBtn} to={`/events/${ev.id}`}>
                  Vedi
                </Link>
                <button
                  className={`${styles.favBtn} ${favoriteIds.has(ev.id) ? styles.favBtnActive : ''}`}
                  onClick={() => toggleFavorite(ev.id)}
                  aria-label={favoriteIds.has(ev.id) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                >
                  {favoriteIds.has(ev.id) ? '\u2764' : '\u2661'}
                </button>
                <button className={styles.textBtn} onClick={() => openEdit(ev)}>
                  Modifica
                </button>
                <button className={styles.textBtn} onClick={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)}>
                  {expandedEventId === ev.id ? 'Chiudi stand' : 'Stand'}
                </button>
                <button className={styles.dangerBtn} onClick={() => handleDelete(ev.id)}>
                  Elimina
                </button>
              </div>
              {expandedEventId === ev.id && (
                <div className={styles.standManager}>
                  {standList.length === 0 && <span className={styles.emptyStands}>Nessuno stand disponibile.</span>}
                  {standList.map((stand) => {
                    const isLinked = stand.eventIds.includes(ev.id)
                    const isSaving = savingStands.has(stand.id)
                    return (
                      <label key={stand.id} className={`${styles.standCheckbox} ${isLinked ? styles.standLinked : ''}`}>
                        <input
                          type="checkbox"
                          checked={isLinked}
                          disabled={isSaving}
                          onChange={() => handleToggleStand(stand.id, ev.id, isLinked)}
                        />
                        {stand.name}
                      </label>
                    )
                  })}
                </div>
              )}
            </article>
          ))}

          {events.length === 0 && (
            <p className={styles.empty}>Nessun evento. Creane uno nuovo.</p>
          )}
        </div>
      </div>
    </div>
  )
}
