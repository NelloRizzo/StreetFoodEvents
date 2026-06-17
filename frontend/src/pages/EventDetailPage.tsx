import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { ImageUploader } from '../components/ImageUploader'
import { useAuth } from '../features/auth/auth-context'
import { useEventTheme } from '../features/theme/useEventTheme'
import { QRCodeDownload } from '../components/QRCodeDownload'
import { fetchFavorites, createFavorite, deleteFavorite } from '../lib/favorites'
import styles from './EventDetailPage.module.scss'

type Event = {
  id: string
  name: string
  location: { label: string; city?: string | null; googleMapsUrl?: string | null }
  startDate: string
  endDate: string
  currencyName: string
  currencySymbol: string | null
  shortDescription: string | null
  longDescription: string | null
  coverImage: unknown | null
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
  eventIds: string[]
  coverImage: unknown | null
}

type PoiItem = {
  id: string
  name: string
  description: string | null
  location: { type: string; coordinates: [number, number] }
  iconType: string | null
  coverImage: UploadedImage | null
  gallery: UploadedImage[]
}

const POI_ICONS = [
  { value: '', label: '📍 Predefinito' },
  { value: 'toilet', label: '🚻 Bagni' },
  { value: 'info', label: 'ℹ️ Info' },
  { value: 'entrance', label: '🚪 Ingresso' },
  { value: 'parking', label: '🅿️ Parcheggio' },
  { value: 'stage', label: '🎵 Palco' },
  { value: 'food', label: '🍽️ Cibo' },
  { value: 'drink', label: '🍺 Bibite' },
]

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [stands, setStands] = useState<Stand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasEventRole, setHasEventRole] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favId, setFavId] = useState<string | null>(null)
  const [favLoading, setFavLoading] = useState(false)
  const [pois, setPois] = useState<PoiItem[]>([])
  const [showPoiForm, setShowPoiForm] = useState(false)
  const [editingPoiId, setEditingPoiId] = useState<string | null>(null)
  const [poiForm, setPoiForm] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    iconType: '',
    coverImage: null as UploadedImage | null,
    gallery: [] as UploadedImage[],
  })
  const [savingPoi, setSavingPoi] = useState(false)

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
    if (!eventId) return

    Promise.all([
      apiRequest<{ item: Event }>(`/events/${eventId}`),
      apiRequest<{ items: Stand[] }>(`/stands?eventId=${eventId}`),
    ])
      .then(([eventData, standsData]) => {
        setEvent(eventData.item)
        setStands(standsData.items)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    fetchFavorites()
      .then((data) => {
        for (const fav of data.items) {
          if (fav.event?.id === eventId) {
            setIsFavorite(true)
            setFavId(fav.id)
            return
          }
        }
        setIsFavorite(false)
        setFavId(null)
      })
      .catch(() => {})
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    apiRequest<{ items: PoiItem[] }>(`/pois?eventId=${eventId}`).then((d) => setPois(d.items)).catch(() => {})
  }, [eventId])

  useEffect(() => {
    if (!eventId || !isAuthenticated) return
    apiRequest<{ roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
      .then((data) => {
        const hasAccess = data.roles.some(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        setHasEventRole(hasAccess)
      })
      .catch(() => {})
  }, [eventId, isAuthenticated])

  const toggleFavorite = async () => {
    if (!eventId || favLoading) return
    setFavLoading(true)
    try {
      if (isFavorite && favId) {
        await deleteFavorite(favId)
        setIsFavorite(false)
        setFavId(null)
      } else {
        const data = await createFavorite({ eventId })
        setIsFavorite(true)
        setFavId(data.item.id)
      }
    } catch { /* not required */ }
    setFavLoading(false)
  }

  const resetPoiForm = () => {
    setPoiForm({ name: '', description: '', latitude: '', longitude: '', iconType: '', coverImage: null, gallery: [] })
    setEditingPoiId(null)
    setShowPoiForm(false)
  }

  const openEditPoi = (poi: PoiItem) => {
    setPoiForm({
      name: poi.name,
      description: poi.description ?? '',
      latitude: String(poi.location.coordinates[1]),
      longitude: String(poi.location.coordinates[0]),
      iconType: poi.iconType ?? '',
      coverImage: poi.coverImage,
      gallery: poi.gallery,
    })
    setEditingPoiId(poi.id)
    setShowPoiForm(true)
  }

  const savePoi = async () => {
    if (!eventId || savingPoi) return
    setSavingPoi(true)
    try {
      const lng = Number(poiForm.longitude.replace(',', '.'))
      const lat = Number(poiForm.latitude.replace(',', '.'))
      if (!poiForm.name.trim()) { window.alert('Inserisci un nome'); return }
      if (isNaN(lat) || isNaN(lng)) { window.alert('Inserisci coordinate valide'); return }
      const body = {
        eventId,
        name: poiForm.name.trim(),
        description: poiForm.description.trim() || null,
        location: { type: 'Point', coordinates: [lng, lat] },
        iconType: poiForm.iconType || null,
        coverImage: poiForm.coverImage,
        gallery: poiForm.gallery,
      }
      if (editingPoiId) {
        await apiRequest(`/pois/${editingPoiId}`, { method: 'PATCH', bodyJson: body })
        window.alert('POI aggiornato')
      } else {
        await apiRequest('/pois', { method: 'POST', bodyJson: body })
        window.alert('POI creato')
      }
      const data = await apiRequest<{ items: PoiItem[] }>(`/pois?eventId=${eventId}`)
      setPois(data.items)
      resetPoiForm()
    } catch { window.alert('Errore salvataggio POI') }
    setSavingPoi(false)
  }

  const deletePoi = async (poiId: string) => {
    if (!window.confirm('Eliminare questo POI?')) return
    try {
      await apiRequest(`/pois/${poiId}`, { method: 'DELETE' })
      setPois((prev) => prev.filter((p) => p.id !== poiId))
    } catch { window.alert('Errore eliminazione POI') }
  }

  if (isLoading || !event) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to="/" className={styles.backLink}>&larr; Torna alla home</Link>

        <div className={styles.header}>
          <div>
            <span className="eyebrow">Evento</span>
            <h1 className={styles.title}>{event.name}</h1>
          </div>
          <div className={styles.headerActions}>
            {event.currencySymbol && (
              <span className={styles.currencyBadge}>
                {event.currencySymbol} {event.currencyName}
              </span>
            )}
            <button
              className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ''}`}
              onClick={toggleFavorite}
              aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            >
              {isFavorite ? '\u2764' : '\u2661'}
            </button>
            <Link to={`/events/${eventId}/mappa`} className={styles.cashierLink}>
              Mappa
            </Link>
            {hasEventRole && (
              <>
                <Link to={`/events/${eventId}/cashier`} className={styles.cashierLink}>
                  Cassa unica
                </Link>
                <Link to={`/events/${eventId}/orders`} className={styles.manageLink}>
                  Gestisci ordini evento
                </Link>
              </>
            )}
            <QRCodeDownload apiPath={`/events/${eventId}/qrcode`} fileName={`evento-${event.name}`} />
          </div>
        </div>

        {event.shortDescription && (
          <div className={styles.shortDesc} dangerouslySetInnerHTML={{ __html: event.shortDescription }} />
        )}

        <div className={styles.meta}>
          <span className={styles.metaItem}>
            {new Date(event.startDate).toLocaleDateString('it-IT', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
            {' — '}
            {new Date(event.endDate).toLocaleDateString('it-IT', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
          <span className={styles.metaItem}>
            {event.location.label}
            {event.location.city ? `, ${event.location.city}` : ''}
          </span>
          {event.location.googleMapsUrl && (
            <a href={event.location.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.metaItem}>
              📍 Apri in Google Maps
            </a>
          )}
        </div>

        {event.longDescription && (
          <div
            className={styles.longDesc}
            dangerouslySetInnerHTML={{ __html: event.longDescription }}
          />
        )}

        <section className={styles.standsSection}>
          <h2 className={styles.sectionTitle}>
            Stand ({stands.length})
          </h2>

          {stands.length === 0 && (
            <p className={styles.empty}>Nessuno stand associato a questo evento.</p>
          )}

          <div className={styles.standGrid}>
            {stands.map((stand) => (
              <div key={stand.id} className={styles.standCard}>
                <Link
                  to={`/events/${eventId}/stands/${stand.id}`}
                  className={styles.standCardLink}
                >
                  <strong className={styles.standName}>{stand.name}</strong>
                  {stand.slogan && (
                    <span className={styles.standSlogan}>{stand.slogan}</span>
                  )}
                </Link>
                {isAuthenticated && (
                  <div className={styles.standActions}>
                    <Link
                      to={`/events/${eventId}/stands/${stand.id}/orders`}
                      className={styles.manageLink}
                    >
                      Gestisci ordini
                    </Link>
                    <Link
                      to={`/events/${eventId}/stands/${stand.id}/order`}
                      className={styles.cashierLink}
                    >
                      Nuovo ordine
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {hasEventRole && (
          <section className={styles.poiSection}>
            <h2 className={styles.sectionTitle}>
              Punti di Interesse ({pois.length})
              <button className={styles.poiToggleBtn} onClick={() => setShowPoiForm((p) => !p)}>
                {showPoiForm ? 'Chiudi' : editingPoiId ? 'Modifica POI' : 'Nuovo POI'}
              </button>
            </h2>

            {showPoiForm && (
              <div className={styles.poiForm}>
                <label className={styles.poiField}>
                  Nome
                  <input
                    type="text"
                    value={poiForm.name}
                    onChange={(e) => setPoiForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label className={styles.poiField}>
                  Descrizione
                  <textarea
                    rows={3}
                    value={poiForm.description}
                    onChange={(e) => setPoiForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </label>
                <div className={styles.poiCoordRow}>
                  <label className={styles.poiField}>
                    Latitudine
                    <input
                      type="text" inputMode="decimal"
                      value={poiForm.latitude}
                      onChange={(e) => setPoiForm((p) => ({ ...p, latitude: e.target.value.replace(',', '.') }))}
                    />
                  </label>
                  <label className={styles.poiField}>
                    Longitudine
                    <input
                      type="text" inputMode="decimal"
                      value={poiForm.longitude}
                      onChange={(e) => setPoiForm((p) => ({ ...p, longitude: e.target.value.replace(',', '.') }))}
                    />
                  </label>
                </div>
                <label className={styles.poiField}>
                  Icona
                  <select
                    value={poiForm.iconType}
                    onChange={(e) => setPoiForm((p) => ({ ...p, iconType: e.target.value }))}
                  >
                    {POI_ICONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.poiField}>
                  <span>Immagine di copertina</span>
                  <ImageUploader
                    mode="single"
                    value={poiForm.coverImage}
                    onChange={(data) => setPoiForm((p) => ({ ...p, coverImage: data as UploadedImage | null }))}
                  />
                </div>
                <div className={styles.poiField}>
                  <span>Galleria</span>
                  <ImageUploader
                    mode="multiple"
                    value={poiForm.gallery}
                    onChange={(data) => setPoiForm((p) => ({ ...p, gallery: data as UploadedImage[] }))}
                  />
                </div>
                <div className={styles.poiFormActions}>
                  <button className={styles.saveBtn} onClick={savePoi} disabled={savingPoi}>
                    {savingPoi ? 'Salvataggio...' : editingPoiId ? 'Aggiorna POI' : 'Crea POI'}
                  </button>
                  <button className={styles.cancelBtn} onClick={resetPoiForm}>Annulla</button>
                </div>
              </div>
            )}

            {pois.length === 0 && !showPoiForm && (
              <p className={styles.empty}>Nessun POI. Clicca "Nuovo POI" per aggiungerne uno.</p>
            )}

            <div className={styles.poiList}>
              {pois.map((poi) => (
                <div key={poi.id} className={styles.poiCard}>
                  <div className={styles.poiCardBody}>
                    <strong className={styles.poiCardName}>{poi.iconType ? POI_ICONS.find((i) => i.value === poi.iconType)?.label.split(' ')[0] : '\u{1F4CD}'} {poi.name}</strong>
                    {poi.description && <span className={styles.poiCardDesc}>{poi.description}</span>}
                    <span className={styles.poiCoords}>
                      {poi.location.coordinates[1]}, {poi.location.coordinates[0]}
                    </span>
                  </div>
                  <div className={styles.poiCardActions}>
                    <button className={styles.textBtn} onClick={() => openEditPoi(poi)}>Modifica</button>
                    <button className={styles.dangerBtn} onClick={() => deletePoi(poi.id)}>Elimina</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
