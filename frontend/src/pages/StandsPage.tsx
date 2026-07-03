import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'
import { fetchFavorites, createFavorite, deleteFavorite } from '../lib/favorites'
import { type UploadedImage } from '../lib/upload'
import { ImageUploader } from '../components/ImageUploader'
import { MapPicker } from '../components/MapPicker'
import styles from './StandsPage.module.scss'

type Stand = {
  id: string
  name: string
  slogan: string | null
  description: string | null
  eventIds: string[]
  locations: Array<{ eventId: string; location: { type: 'Point'; coordinates: [number, number] } | null }>
  coverImage: unknown | null
  gallery: unknown[]
  createdAt: string
  updatedAt: string
}

type EventLocation = { eventId: string; latitude: string; longitude: string }

type StandFormData = {
  name: string
  slogan: string
  description: string
  eventIds: string[]
  locations: EventLocation[]
  coverImage: UploadedImage | null
  gallery: UploadedImage[]
}

const emptyForm: StandFormData = { name: '', slogan: '', description: '', eventIds: [], locations: [], coverImage: null, gallery: [] }

export function StandsPage() {
  const { user } = useAuth()
  const [stands, setStands] = useState<Stand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<StandFormData>(emptyForm)
  const [events, setEvents] = useState<{ id: string; name: string }[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favMap, setFavMap] = useState<Map<string, string>>(new Map())

  const fetchStands = async () => {
    const data = await apiRequest<{ items: Stand[] }>('/stands')
    let items = data.items
    if (user?.isPlatformAdmin === false && user?.adminEventIds && user.adminEventIds.length > 0) {
      const adminSet = new Set(user.adminEventIds)
      items = items.filter((s) => s.eventIds.some((eid) => adminSet.has(eid)))
    }
    setStands(items)
    setIsLoading(false)
  }

  const fetchEvents = async () => {
    try {
      const data = await apiRequest<{ items: { id: string; name: string }[] }>('/events')
      setEvents(data.items)
    } catch { /* not required */ }
  }

  const fetchFavs = async () => {
    try {
      const data = await fetchFavorites()
      const ids = new Set<string>()
      const map = new Map<string, string>()
      for (const fav of data.items) {
        if (fav.stand) {
          ids.add(fav.stand.id)
          map.set(fav.stand.id, fav.id)
        }
      }
      setFavoriteIds(ids)
      setFavMap(map)
    } catch { /* not required */ }
  }

  useEffect(() => {
    fetchStands()
    fetchEvents()
    fetchFavs()
  }, [])

  const toggleFavorite = async (standId: string) => {
    if (favoriteIds.has(standId)) {
      const favId = favMap.get(standId)
      if (favId) {
        await deleteFavorite(favId)
        setFavoriteIds((prev) => { const next = new Set(prev); next.delete(standId); return next })
        setFavMap((prev) => { const next = new Map(prev); next.delete(standId); return next })
      }
    } else {
      const data = await createFavorite({ standId })
      setFavoriteIds((prev) => { const next = new Set(prev); next.add(standId); return next })
      setFavMap((prev) => { const next = new Map(prev); next.set(standId, data.item.id); return next })
    }
  }

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (stand: Stand) => {
    setForm({
      name: stand.name,
      slogan: stand.slogan ?? '',
      description: stand.description ?? '',
      eventIds: stand.eventIds,
      locations: stand.eventIds.map((eid) => {
        const entry = stand.locations.find((l) => l.eventId === eid)
        return {
          eventId: eid,
          latitude: entry?.location?.coordinates?.[1] != null ? String(entry.location.coordinates[1]) : '',
          longitude: entry?.location?.coordinates?.[0] != null ? String(entry.location.coordinates[0]) : '',
        }
      }),
      coverImage: stand.coverImage as UploadedImage | null,
      gallery: stand.gallery as UploadedImage[],
    })
    setEditingId(stand.id)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    const body = {
      ...form,
      locations: form.locations.map((el) => {
        const lat = Number(el.latitude.replace(',', '.'))
        const lng = Number(el.longitude.replace(',', '.'))
        const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
        return {
          eventId: el.eventId,
          location: hasCoords ? { type: 'Point' as const, coordinates: [lng, lat] } : null,
        }
      }),
    }
    if (editingId) {
      await apiRequest(`/stands/${editingId}`, {
        method: 'PATCH',
        bodyJson: body,
      })
    } else {
      await apiRequest('/stands', {
        method: 'POST',
        bodyJson: body,
      })
    }

    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    await fetchStands()
  }

  const handleDelete = async (id: string) => {
    await apiRequest(`/stands/${id}`, { method: 'DELETE' })
    await fetchStands()
  }

  const toggleEvent = (eventId: string) => {
    setForm((prev) => {
      const isLinked = prev.eventIds.includes(eventId)
      return {
        ...prev,
        eventIds: isLinked
          ? prev.eventIds.filter((id) => id !== eventId)
          : [...prev.eventIds, eventId],
        locations: isLinked
          ? prev.locations.filter((l) => l.eventId !== eventId)
          : [...prev.locations, { eventId, latitude: '', longitude: '' }],
      }
    })
  }

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Gestione</span>
            <h1 className={styles.title}>Stand</h1>
          </div>
          <button className={styles.primaryBtn} onClick={openCreate}>
            Nuovo stand
          </button>
        </div>

        {showForm && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            <div className={styles.field}>
              <label htmlFor="stand-name">Nome</label>
              <input id="stand-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>

            <div className={styles.field}>
              <label htmlFor="stand-slogan">Slogan</label>
              <input id="stand-slogan" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="stand-desc">Descrizione</label>
              <textarea id="stand-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label>Eventi collegati</label>
              <div className={styles.checkboxGroup}>
                {events.map((event) => (
                  <label key={event.id} className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={form.eventIds.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                    />
                    {event.name}
                  </label>
                ))}
              </div>
            </div>

            {form.locations.map((el) => {
              const evName = events.find((e) => e.id === el.eventId)?.name ?? el.eventId
              return (
                <div key={el.eventId} className={styles.coordRow}>
                  <label className={styles.coordLabel}>{evName} — posizione (clicca sulla mappa o sposta il marker)</label>
                  <MapPicker
                    lat={el.latitude}
                    lng={el.longitude}
                    onChange={(lat, lng) =>
                      setForm((prev) => ({
                        ...prev,
                        locations: prev.locations.map((l) =>
                          l.eventId === el.eventId ? { ...l, latitude: lat, longitude: lng } : l
                        ),
                      }))
                    }
                  />
                </div>
              )
            })}

            <ImageUploader
                mode="single"
                type="stand"
                value={form.coverImage}
                onChange={(data) => setForm({ ...form, coverImage: data as UploadedImage | null })}
                label="Immagine di copertina"
              />

            <ImageUploader
                mode="multiple"
                type="stand"
                value={form.gallery}
                onChange={(data) => setForm({ ...form, gallery: data as UploadedImage[] })}
                label="Galleria"
              />

            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>
                {editingId ? 'Salva modifiche' : 'Crea stand'}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                Annulla
              </button>
            </div>
          </form>
        )}

        <div className={styles.list}>
          {stands.map((stand) => (
            <article key={stand.id} className={styles.card}>
              <div className={styles.cardBody}>
                <strong className={styles.cardName}>{stand.name}</strong>
                {stand.slogan && <span className={styles.cardSlogan}>{stand.slogan}</span>}
                <span className={styles.cardEvents}>
                  {stand.eventIds.length} eventi collegati
                </span>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={`${styles.favBtn} ${favoriteIds.has(stand.id) ? styles.favBtnActive : ''}`}
                  onClick={() => toggleFavorite(stand.id)}
                  aria-label={favoriteIds.has(stand.id) ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                >
                  {favoriteIds.has(stand.id) ? '\u2764' : '\u2661'}
                </button>
                <Link className={styles.textBtn} to={`/stands/${stand.id}`}>
                  Postazioni
                </Link>
                <Link className={styles.textBtn} to={`/stands/${stand.id}#prodotti`}>
                  Prodotti
                </Link>
                <button className={styles.textBtn} onClick={() => openEdit(stand)}>
                  Modifica
                </button>
                <button className={styles.dangerBtn} onClick={() => handleDelete(stand.id)}>
                  Elimina
                </button>
              </div>
            </article>
          ))}

          {stands.length === 0 && (
            <p className={styles.empty}>Nessuno stand. Creane uno nuovo.</p>
          )}
        </div>
      </div>
    </div>
  )
}
