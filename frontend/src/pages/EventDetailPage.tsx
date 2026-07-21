import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { AliasManager } from '../components/AliasManager'
import { ImageUploader } from '../components/ImageUploader'
import { ConfirmModal } from '../components/ConfirmModal'
import { useAuth } from '../features/auth/auth-context'
import { useEventTheme } from '../features/theme/useEventTheme'
import { QRCodeDownload } from '../components/QRCodeDownload'
import { MapPicker } from '../components/MapPicker'
import { listContestPois, createContestPoi, deleteContestPoi, listContests, createContest, updateContest, deleteContest, getContestPoiQrCodes } from '../lib/contests'
import { fetchFavorites, createFavorite, deleteFavorite } from '../lib/favorites'
import styles from './EventDetailPage.module.scss'

type UploadedImg = {
  url: string
  publicId: string
  width: number
  height: number
  format: string
  bytes: number
}

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
  coverImage: UploadedImg | null
  logo: UploadedImg | null
  gallery: UploadedImg[]
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
  coverImage: UploadedImg | null
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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [hasPhotoPrint, setHasPhotoPrint] = useState(false)
  const [hasContestAdmin, setHasContestAdmin] = useState(false)
  const [hasExchangeAdmin, setHasExchangeAdmin] = useState(false)
  const [cpois, setCpois] = useState<{ id: string; name: string; hint: string | null; groups: string[] }[]>([])
  const [showCpoiForm, setShowCpoiForm] = useState(false)
  const [cpoiForm, setCpoiForm] = useState({ name: '', hint: '', groupsInput: '' })
  const [savingCpoi, setSavingCpoi] = useState(false)
  const [contests, setContests] = useState<{ id: string; name: string; isActive: boolean; orderedPOIIds: string[]; durationMinutes: number; startsAt: string; prizes: { label: string; awarded: boolean }[]; awardedPrizesCount: number; requireSequence: boolean; description: string | null; pickConfig: { groupPicks: { group: string; count: number }[] } | null; autoPickedPOIIds: string[] }[]>([])
  const [showContestForm, setShowContestForm] = useState(false)
  const [editingContestId, setEditingContestId] = useState<string | null>(null)
  const [contestForm, setContestForm] = useState({
    name: '',
    description: '',
    startsAt: '',
    durationMinutes: 30,
    requireSequence: false,
    prizes: [{ label: '' }] as { label: string }[],
    isActive: true,
    orderedPOIIds: [] as string[],
    pickConfig: null as { groupPicks: { group: string; count: number }[] } | null,
  })
  const [savingContest, setSavingContest] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favId, setFavId] = useState<string | null>(null)
  const [favLoading, setFavLoading] = useState(false)
  const [pois, setPois] = useState<PoiItem[]>([])
  const [showPoiForm, setShowPoiForm] = useState(false)
  const [editingPoiId, setEditingPoiId] = useState<string | null>(null)
  const [deleteOrdersTarget, setDeleteOrdersTarget] = useState(false)
  const [deletingOrders, setDeletingOrders] = useState(false)
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
  const [modal, setModal] = useState<{ open: boolean; variant: 'alert' | 'confirm'; title: string; message: string; onConfirm?: () => void; danger?: boolean }>({ open: false, variant: 'alert', title: '', message: '' })
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
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
      .then((data) => {
        const eventRoles = data.roles.filter(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        setHasEventRole(
          eventRoles.some((r) => ['event-admin', 'event-cashier'].includes(r.slug)) || data.isPlatformAdmin
        )
        setIsPlatformAdmin(data.isPlatformAdmin)
        setHasPhotoPrint(data.isPlatformAdmin || eventRoles.some((r) => ['photo-admin', 'photo-print'].includes(r.slug)))
        const isContestAdmin = data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'contest-admin')
        setHasContestAdmin(isContestAdmin)
        setHasExchangeAdmin(data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'exchange-admin'))
        if (isContestAdmin) {
          listContestPois(eventId).then((d) => setCpois(d.items)).catch(() => {})
          listContests(eventId).then((d) => setContests(d.items)).catch(() => {})
        }
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
      if (!poiForm.name.trim()) {
        setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Inserisci un nome.' })
        return
      }
      if (isNaN(lat) || isNaN(lng)) {
        setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Inserisci coordinate valide.' })
        return
      }
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
        setModal({ open: true, variant: 'alert', title: 'Fatto', message: 'POI aggiornato.' })
      } else {
        await apiRequest('/pois', { method: 'POST', bodyJson: body })
        setModal({ open: true, variant: 'alert', title: 'Fatto', message: 'POI creato.' })
      }
      const data = await apiRequest<{ items: PoiItem[] }>(`/pois?eventId=${eventId}`)
      setPois(data.items)
      resetPoiForm()
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Salvataggio POI fallito.' })
    } finally {
      setSavingPoi(false)
    }
  }

  const deletePoi = async (poiId: string) => {
    setModal({
      open: true,
      variant: 'confirm',
      title: 'Eliminare POI?',
      message: 'Questa azione è irreversibile.',
      danger: true,
      onConfirm: async () => {
        try {
          await apiRequest(`/pois/${poiId}`, { method: 'DELETE' })
          setPois((prev) => prev.filter((p) => p.id !== poiId))
        } catch {
          setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Eliminazione POI fallita.' })
        }
        setModal((prev) => ({ ...prev, open: false }))
      },
    })
  }


  if (isLoading || !event) return null

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        {event.coverImage?.url ? (
          <img src={event.coverImage.url} alt="" className={styles.heroCover} />
        ) : (
          <div className={styles.heroPlaceholder} />
        )}
        <div className={styles.heroOverlay}>
          <div className={`page-shell ${styles.heroContent}`}>
            <Link to="/" className={styles.heroBack}>&larr; Tutti gli eventi</Link>
            <div className={styles.heroText}>
              {event.logo?.url && (
                <img src={event.logo.url} alt={`${event.name} logo`} className={styles.heroLogo} />
              )}
              <div className={styles.heroMeta}>
                <span className={styles.heroEyebrow}>Evento gastronomico</span>
                <h1 className={styles.heroTitle}>{event.name}</h1>
                <div className={styles.heroInfo}>
                  <span>
                    {new Date(event.startDate).toLocaleDateString('it-IT', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                    {' — '}
                    {new Date(event.endDate).toLocaleDateString('it-IT', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                  <span>{event.location.label}{event.location.city ? `, ${event.location.city}` : ''}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.heroActionsWrapper}>
          <div className={`page-shell ${styles.heroActions}`}>
            <button
              className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ''}`}
              onClick={toggleFavorite}
              aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            >
              {isFavorite ? '\u2764' : '\u2661'}
              <span>{isFavorite ? 'Preferito' : 'Aggiungi'}</span>
            </button>
            <Link to={`/events/${eventId}/mappa`} className={styles.actionBtn}>
              Mappa
            </Link>
            {event.location.googleMapsUrl && (
              <a href={event.location.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.actionBtnOutline}>
                Google Maps
              </a>
            )}
            {hasEventRole && (
              <>
                <Link to={`/events/${eventId}/cashier`} className={styles.actionBtn}>
                  Cassa unica
                </Link>
                <Link to={`/events/${eventId}/orders`} className={styles.actionBtnOutline}>
                  Gestisci ordini
                </Link>
              </>
            )}
            {hasPhotoPrint && (
              <>
                <Link to={`/events/${eventId}/galleria`} className={styles.actionBtnOutline}>
                  Galleria
                </Link>
                <Link to={`/events/${eventId}/slideshow`} className={styles.actionBtnOutline}>
                  Slideshow
                </Link>
              </>
            )}
            {isAuthenticated && (
              <Link to={`/events/${eventId}/photo-booth`} className={styles.actionBtnOutline}>
                Photo Booth
              </Link>
            )}
            {isPlatformAdmin && (
              <button className={styles.dangerBtn} onClick={() => setDeleteOrdersTarget(true)}>
                Cancella ordini
              </button>
            )}
            <QRCodeDownload apiPath={`/events/${eventId}/qrcode`} fileName={`evento-${event.name}`} />
          </div>
        </div>
      </section>

      <div className="page-shell">
        {/* Info row */}
        <div className={styles.infoRow}>
          {event.currencySymbol && (
            <span className={styles.currencyBadge}>
              {event.currencySymbol} {event.currencyName}
            </span>
          )}
        </div>

        {/* Description */}
        {event.shortDescription && (
          <div className={styles.shortDesc} dangerouslySetInnerHTML={{ __html: event.shortDescription }} />
        )}

        {event.longDescription && (
          <div className={styles.longDesc} dangerouslySetInnerHTML={{ __html: event.longDescription }} />
        )}

        {/* Gallery */}
        {event.gallery && event.gallery.length > 0 && (
          <section className={styles.gallerySection}>
            <h2 className={styles.sectionTitle}>Galleria</h2>
            <div className={styles.galleryGrid}>
              {event.gallery.map((img, i) => (
                <img key={i} src={img.url} alt={`${event.name} ${i + 1}`} className={styles.galleryImage} />
              ))}
            </div>
          </section>
        )}

        {/* Stands */}
        <section className={styles.standsSection}>
          <h2 className={styles.sectionTitle}>
            Stand <span className={styles.count}>{stands.length}</span>
          </h2>

          {stands.length === 0 && (
            <p className={styles.empty}>Nessuno stand associato a questo evento.</p>
          )}

          <div className={styles.standGrid}>
            {stands.map((stand) => (
              <Link
                key={stand.id}
                to={`/events/${eventId}/stands/${stand.id}`}
                className={styles.standCard}
              >
                {stand.coverImage?.url ? (
                  <div className={styles.standCover}>
                    <img src={stand.coverImage.url} alt="" />
                  </div>
                ) : (
                  <div className={styles.standCoverPlaceholder}>
                    <span>🏪</span>
                  </div>
                )}
                <div className={styles.standBody}>
                  <strong className={styles.standName}>{stand.name}</strong>
                  {stand.slogan && <span className={styles.standSlogan}>{stand.slogan}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* POI management (admin) */}
        {hasEventRole && (<>
            <h2 className={styles.sectionTitle}>
              Punti di Interesse <span className={styles.count}>{pois.length}</span>
              <button className={styles.poiToggleBtn} onClick={() => setShowPoiForm((p) => !p)}>
                {showPoiForm ? 'Chiudi' : editingPoiId ? 'Modifica POI' : 'Nuovo POI'}
              </button>
            </h2>

            {showPoiForm && (
              <div className={styles.poiForm}>
                <label className={styles.poiField}>
                  Nome
                  <input type="text" value={poiForm.name} onChange={(e) => setPoiForm((p) => ({ ...p, name: e.target.value }))} />
                </label>
                <label className={styles.poiField}>
                  Descrizione
                  <textarea rows={3} value={poiForm.description} onChange={(e) => setPoiForm((p) => ({ ...p, description: e.target.value }))} />
                </label>
                <div className={styles.poiField}>
                  <label>Posizione (clicca sulla mappa o sposta il marker)</label>
                  <MapPicker lat={poiForm.latitude} lng={poiForm.longitude} onChange={(lat, lng) => setPoiForm((p) => ({ ...p, latitude: lat, longitude: lng }))} height="200px" />
                </div>
                <label className={styles.poiField}>
                  Icona
                  <select value={poiForm.iconType} onChange={(e) => setPoiForm((p) => ({ ...p, iconType: e.target.value }))}>
                    {POI_ICONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.poiField}>
                  <span>Immagine di copertina</span>
                  <ImageUploader mode="single" type="poi" value={poiForm.coverImage} onChange={(data) => setPoiForm((p) => ({ ...p, coverImage: data as UploadedImage | null }))} />
                </div>
                <div className={styles.poiField}>
                  <span>Galleria</span>
                  <ImageUploader mode="multiple" type="poi" value={poiForm.gallery} onChange={(data) => setPoiForm((p) => ({ ...p, gallery: data as UploadedImage[] }))} />
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
                    <span className={styles.poiCoords}>{poi.location.coordinates[1]}, {poi.location.coordinates[0]}</span>
                  </div>
                  <div className={styles.poiCardActions}>
                    <button className={styles.textBtn} onClick={() => openEditPoi(poi)}>Modifica</button>
                    <button className={styles.dangerBtn} onClick={() => deletePoi(poi.id)}>Elimina</button>
                  </div>
                </div>
              ))}
            </div>

          <AliasManager entityType="event" entityRef={eventId!} />

          {isPlatformAdmin && (<>
            <h2 className={styles.sectionTitle}>Cornici</h2>
            <Link to="/frames" className={styles.actionBtn}>
              Gestisci cornici
            </Link>
          </>)}
          </>)}

        {hasContestAdmin && (<>
          <h2 className={styles.sectionTitle}>
            Contest <span className={styles.count}>{contests.length}</span>
          </h2>

          <Link to={`/events/${eventId}/contests`} className={styles.actionBtn} style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
            Vedi contest pubblici
          </Link>

          {/* Contest POI management */}
          <h3 style={{ color: 'var(--color-ink-strong)', fontSize: '1rem', margin: '1rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            POI del contest
            <button className={styles.poiToggleBtn} onClick={() => setShowCpoiForm((p) => !p)}>
              {showCpoiForm ? 'Chiudi' : 'Nuovo POI'}
            </button>
          </h3>

          {showCpoiForm && (
            <div className={styles.poiForm}>
              <label className={styles.poiField}>
                Nome
                <input type="text" value={cpoiForm.name} onChange={(e) => setCpoiForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className={styles.poiField}>
                Indizio
                <input type="text" value={cpoiForm.hint} onChange={(e) => setCpoiForm((p) => ({ ...p, hint: e.target.value }))} />
              </label>
              <label className={styles.poiField}>
                Gruppi (separati da virgola)
                <input type="text" value={cpoiForm.groupsInput} placeholder="es. Cibo, Bevande, Giochi" onChange={(e) => setCpoiForm((p) => ({ ...p, groupsInput: e.target.value }))} />
              </label>
              <div className={styles.poiFormActions}>
                <button className={styles.saveBtn} onClick={async () => {
                  if (!eventId || savingCpoi || !cpoiForm.name.trim()) return
                  setSavingCpoi(true)
                  try {
                    const groups = cpoiForm.groupsInput.split(',').map((g) => g.trim()).filter(Boolean)
                    await createContestPoi({ eventId, name: cpoiForm.name.trim(), hint: cpoiForm.hint.trim() || null, groups: groups.length > 0 ? groups : undefined })
                    const data = await listContestPois(eventId)
                    setCpois(data.items)
                    setCpoiForm({ name: '', hint: '', groupsInput: '' })
                    setShowCpoiForm(false)
                  } catch { /* ignore */ }
                  setSavingCpoi(false)
                }} disabled={savingCpoi}>
                  {savingCpoi ? 'Salvataggio...' : 'Crea POI'}
                </button>
                <button className={styles.cancelBtn} onClick={() => { setShowCpoiForm(false); setCpoiForm({ name: '', hint: '', groupsInput: '' }) }}>Annulla</button>
              </div>
            </div>
          )}

          <div className={styles.poiList}>
            {cpois.map((cpoi) => (
              <div key={cpoi.id} className={styles.poiCard}>
                <div className={styles.poiCardBody}>
                  <strong className={styles.poiCardName}>{cpoi.name}</strong>
                  {cpoi.hint && <span className={styles.poiCardDesc} style={{ fontStyle: 'italic' }}>{cpoi.hint}</span>}
                  {cpoi.groups.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {cpoi.groups.map((g) => (
                        <span key={g} className={styles.poiGroupBadge}>{g}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.poiCardActions}>
                  <button className={styles.dangerBtn} onClick={async () => {
                    try {
                      await deleteContestPoi(cpoi.id)
                      setCpois((prev) => prev.filter((p) => p.id !== cpoi.id))
                    } catch { /* ignore */ }
                  }}>Elimina</button>
                </div>
              </div>
            ))}
          </div>

          {/* Contest list + create */}
          <h3 style={{ color: 'var(--color-ink-strong)', fontSize: '1rem', margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            Contest
            <button className={styles.poiToggleBtn} onClick={() => { setShowContestForm((p) => !p); if (!showContestForm) { setEditingContestId(null); setContestForm({ name: '', description: '', startsAt: '', durationMinutes: 30, requireSequence: false, prizes: [{ label: '' }], isActive: true, orderedPOIIds: cpois.map((p) => p.id), pickConfig: null }) } }}>
              {showContestForm ? 'Chiudi' : editingContestId ? 'Modifica contest' : 'Nuovo contest'}
            </button>
          </h3>

          {showContestForm && (
            <div className={styles.poiForm}>
              <label className={styles.poiField}>
                Nome
                <input type="text" value={contestForm.name} onChange={(e) => setContestForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className={styles.poiField}>
                Descrizione
                <textarea rows={2} value={contestForm.description} onChange={(e) => setContestForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <label className={styles.poiField}>
                Start
                <input type="datetime-local" value={contestForm.startsAt} onChange={(e) => setContestForm((p) => ({ ...p, startsAt: e.target.value }))} />
              </label>
              <label className={styles.poiField}>
                Durata (minuti)
                <input type="number" min={1} value={contestForm.durationMinutes} onChange={(e) => setContestForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))} />
              </label>
                <label className={styles.poiField}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={contestForm.requireSequence} onChange={(e) => setContestForm((p) => ({ ...p, requireSequence: e.target.checked }))} />
                    Sequenza ordinata
                  </label>
                </label>
              <label className={styles.poiField}>
                <span>Premi</span>
                {contestForm.prizes.map((prize, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                    <input
                      type="text" value={prize.label} placeholder={`Premio ${i + 1}`}
                      onChange={(e) => {
                        const arr = [...contestForm.prizes]
                        arr[i] = { label: e.target.value }
                        setContestForm((p) => ({ ...p, prizes: arr }))
                      }}
                      style={{ flex: 1 }}
                    />
                    {contestForm.prizes.length > 1 && (
                      <button type="button" className={styles.textBtn} onClick={() => {
                        setContestForm((p) => ({ ...p, prizes: p.prizes.filter((_, j) => j !== i) }))
                      }}>&times;</button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.textBtn} style={{ marginTop: '0.25rem' }} onClick={() => {
                  setContestForm((p) => ({ ...p, prizes: [...p.prizes, { label: '' }] }))
                }}>+ Aggiungi premio</button>
              </label>
              <label className={styles.poiField}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={contestForm.isActive} onChange={(e) => setContestForm((p) => ({ ...p, isActive: e.target.checked }))} />
                  Attivo
                </label>
              </label>

              {cpois.filter((p) => p.groups.length > 0).length > 0 && (
                <div className={styles.poiField}>
                  <span>Prelievo automatico per gruppi</span>
                  <small style={{ opacity: 0.6, display: 'block', marginBottom: '0.25rem' }}>
                    Se configurato, il backend selezioner&agrave; casualmente N POI da ciascun gruppo.
                  </small>
                  {(contestForm.pickConfig?.groupPicks ?? []).map((gp, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <input type="text" value={gp.group} placeholder="Nome gruppo"
                        onChange={(e) => {
                          const arr = [...(contestForm.pickConfig?.groupPicks ?? [])]
                          arr[i] = { ...arr[i], group: e.target.value }
                          setContestForm((p) => ({ ...p, pickConfig: { groupPicks: arr } }))
                        }}
                        style={{ flex: 1 }}
                      />
                      <input type="number" min={1} value={gp.count}
                        onChange={(e) => {
                          const arr = [...(contestForm.pickConfig?.groupPicks ?? [])]
                          arr[i] = { ...arr[i], count: Number(e.target.value) }
                          setContestForm((p) => ({ ...p, pickConfig: { groupPicks: arr } }))
                        }}
                        style={{ width: '70px' }}
                      />
                      <button type="button" className={styles.textBtn} onClick={() => {
                        const arr = (contestForm.pickConfig?.groupPicks ?? []).filter((_, j) => j !== i)
                        setContestForm((p) => ({ ...p, pickConfig: arr.length > 0 ? { groupPicks: arr } : null }))
                      }}>&times;</button>
                    </div>
                  ))}
                  <button type="button" className={styles.textBtn} style={{ marginTop: '0.25rem' }} onClick={() => {
                    const arr = [...(contestForm.pickConfig?.groupPicks ?? []), { group: '', count: 1 }]
                    setContestForm((p) => ({ ...p, pickConfig: { groupPicks: arr } }))
                  }}>+ Aggiungi gruppo</button>
                </div>
              )}

              <label className={styles.poiField}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <span>POI disponibili <small style={{ opacity: 0.6 }}>(trascina per aggiungere)</small></span>
                    <div className={styles.poiPool}>
                      {cpois.filter((p) => p.groups.length === 0).length > 0 && (
                        <div className={styles.poiGroupHeader}>Senza gruppo</div>
                      )}
                      {cpois.filter((p) => p.groups.length === 0).map((cpoi) => (
                        <div key={cpoi.id}
                          className={styles.poiPoolItem}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/poi-id', cpoi.id)
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                        >
                          {cpoi.name}
                        </div>
                      ))}
                      {[...new Set(cpois.flatMap((p) => p.groups))].map((group) => (
                        <div key={group}>
                          <div className={styles.poiGroupHeader}>{group}</div>
                          {cpois.filter((p) => p.groups.includes(group)).map((cpoi) => (
                            <div key={cpoi.id}
                              className={styles.poiPoolItem}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/poi-id', cpoi.id)
                                e.dataTransfer.effectAllowed = 'copy'
                              }}
                            >
                              {cpoi.name}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <span>Ordine POI <small style={{ opacity: 0.6 }}>(trascina per riordinare, &times; per rimuovere)</small></span>
                    <div
                      className={styles.poiOrderedList}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const poiId = e.dataTransfer.getData('text/poi-id')
                        if (poiId) {
                          setContestForm((p) => ({ ...p, orderedPOIIds: [...p.orderedPOIIds, poiId] }))
                          return
                        }
                        const fromIdx = e.dataTransfer.getData('text/poi-index')
                        if (fromIdx) {
                          const fi = Number(fromIdx)
                          if (isNaN(fi)) return
                          const arr = [...contestForm.orderedPOIIds]
                          const [removed] = arr.splice(fi, 1)
                          arr.splice(contestForm.orderedPOIIds.length, 0, removed)
                          setContestForm((p) => ({ ...p, orderedPOIIds: arr }))
                        }
                      }}
                    >
                      {contestForm.orderedPOIIds.length === 0 && (
                        <div className={styles.poiOrderedEmpty}>
                          Trascina qui i POI
                        </div>
                      )}
                      {contestForm.orderedPOIIds.map((poiId, idx) => {
                        const poi = cpois.find((p) => p.id === poiId)
                        return (
                          <div key={`${poiId}-${idx}`}
                            className={styles.poiOrderedItem}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/poi-index', String(idx))
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              const fromIdx = e.dataTransfer.getData('text/poi-index')
                              if (fromIdx) {
                                const fi = Number(fromIdx)
                                if (isNaN(fi) || fi === idx) return
                                const arr = [...contestForm.orderedPOIIds]
                                const [removed] = arr.splice(fi, 1)
                                arr.splice(idx, 0, removed)
                                setContestForm((p) => ({ ...p, orderedPOIIds: arr }))
                              }
                            }}
                          >
                            <span className={styles.poiOrderedItemLabel}>{idx + 1}. {poi?.name || poiId}</span>
                            <button type="button" className={styles.poiOrderedItemRemove}
                              onClick={() => {
                                setContestForm((p) => ({ ...p, orderedPOIIds: p.orderedPOIIds.filter((_, i) => i !== idx) }))
                              }}
                            >&times;</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </label>
              <div className={styles.poiFormActions}>
                <button className={styles.saveBtn} onClick={async () => {
                  if (!eventId || savingContest || !contestForm.name.trim() || !contestForm.startsAt) return
                  setSavingContest(true)
                  try {
                    const payload: {
                      eventId: string; name: string; description: string | null; startsAt: string;
                      durationMinutes: number; requireSequence: boolean; prizes: { label: string }[];
                      isActive: boolean; orderedPOIIds: string[]; pickConfig: { groupPicks: { group: string; count: number }[] } | null;
                    } = {
                      eventId,
                      name: contestForm.name.trim(),
                      description: contestForm.description.trim() || null,
                      startsAt: new Date(contestForm.startsAt).toISOString(),
                      durationMinutes: contestForm.durationMinutes,
                      prizes: contestForm.prizes.filter((p) => p.label.trim()).map((p) => ({ label: p.label.trim() })),
                      requireSequence: contestForm.requireSequence,
                      isActive: contestForm.isActive,
                      orderedPOIIds: contestForm.orderedPOIIds,
                      pickConfig: contestForm.pickConfig,
                    }
                    if (editingContestId) {
                      await updateContest(editingContestId, payload)
                    } else {
                      await createContest(payload)
                    }
                    const data = await listContests(eventId)
                    setContests(data.items)
                    setShowContestForm(false)
                    setEditingContestId(null)
                  } catch { /* ignore */ }
                  setSavingContest(false)
                }} disabled={savingContest}>
                  {savingContest ? 'Salvataggio...' : editingContestId ? 'Aggiorna contest' : 'Crea contest'}
                </button>
                <button className={styles.cancelBtn} onClick={() => { setShowContestForm(false); setEditingContestId(null) }}>Annulla</button>
              </div>
            </div>
          )}

          <div className={styles.poiList}>
            {contests.map((contest) => (
              <div key={contest.id} className={styles.poiCard}>
                <div className={styles.poiCardBody}>
                  <strong className={styles.poiCardName}>{contest.name}</strong>
                  <span>{contest.isActive ? 'Attivo' : 'Inattivo'} &middot; {contest.durationMinutes} min &middot; {contest.requireSequence ? 'Ordinato' : 'Libero'}</span>
                  {(contest.prizes ?? []).length > 0 && <span className={styles.poiCardDesc}>Premi: {(contest.prizes ?? []).filter((p) => p.awarded).length}/{(contest.prizes ?? []).length}</span>}
                </div>
                <div className={styles.poiCardActions}>
                  <button className={styles.textBtn} onClick={async () => {
                    setEditingContestId(contest.id)
                    setContestForm({
                      name: contest.name,
                      description: contest.description ?? '',
                      startsAt: contest.startsAt.slice(0, 16),
                      durationMinutes: contest.durationMinutes,
                      requireSequence: contest.requireSequence,
                      prizes: (contest.prizes ?? []).length > 0 ? contest.prizes.map((p) => ({ label: p.label })) : [{ label: '' }],
                      isActive: contest.isActive,
                      orderedPOIIds: contest.orderedPOIIds,
                      pickConfig: contest.pickConfig,
                    })
                    setShowContestForm(true)
                  }}>Modifica</button>
                  <button className={styles.dangerBtn} onClick={async () => {
                    try {
                      await deleteContest(contest.id)
                      setContests((prev) => prev.filter((c) => c.id !== contest.id))
                    } catch { /* ignore */ }
                  }}>Elimina</button>
                </div>
              </div>
            ))}
          </div>

          {/* QR print button */}
          {contests.map((contest) => (
            contest.orderedPOIIds.length > 0 && (
              <button key={contest.id} className={styles.actionBtn} style={{ margin: '0.5rem 0', display: 'block' }} onClick={async () => {
                try {
                  const data = await getContestPoiQrCodes(contest.id)
                  const win = window.open('', '_blank')
                  if (!win) return
                  const html = `<!DOCTYPE html>
<html>
<head>
  <title>QR Code POI - ${contest.name}</title>
  <style>
    @page { size: A4; margin: 1cm; }
    body { font-family: sans-serif; margin: 0; padding: 0.5cm; }
    .page-break { page-break-after: always; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5cm; }
    .card { text-align: center; padding: 0.5cm; border: 1px solid #ddd; border-radius: 8px; break-inside: avoid; }
    .card img { width: 200px; height: 200px; image-rendering: pixelated; }
    .card h2 { margin: 0.3rem 0; font-size: 1rem; }
    .card p { margin: 0; font-size: 0.75rem; color: #666; }
  </style>
</head>
<body>
  ${data.items.reduce((acc, item, i) => {
    if (i % 4 === 0) acc += '<div class="grid">'
    acc += `
    <div class="card">
      <h2>${item.poiName}</h2>
      <img src="${item.qrCode}" alt="QR ${item.poiName}" onload="this.style.opacity=1" style="opacity:0;transition:opacity .2s" />
      <p>Inquadra il QR per scansionare il POI</p>
    </div>`
    if (i % 4 === 3 || i === data.items.length - 1) {
      acc += '</div>'
      if (i < data.items.length - 1) acc += '<div class="page-break"></div>'
    }
    return acc
  }, '')}
  <script>
    let loaded = document.querySelectorAll('img').length;
    if (loaded === 0) { window.print(); window.close(); return; }
    let count = 0;
    document.querySelectorAll('img').forEach(img => img.onload = () => { if (++count >= loaded) { window.print(); window.close(); } });
  </script>
</body>
</html>`
                  win.document.write(html)
                  win.document.close()
                } catch { /* ignore */ }
              }}>
                Stampa QR - {contest.name}
              </button>
            )
          ))}
        </>)}

        {hasExchangeAdmin && (<>
          <h2 className={styles.sectionTitle}>Cambio valuta</h2>
          <Link to={`/events/${eventId}/exchange`} className={styles.actionBtn}>
            Gestisci cambio
          </Link>
        </>)}

      </div>

      <ConfirmModal
        open={modal.open}
        variant={modal.variant}
        title={modal.title}
        message={modal.message}
        danger={modal.danger}
        confirmLabel={modal.variant === 'confirm' ? 'Elimina' : 'OK'}
        onConfirm={() => {
          modal.onConfirm?.()
          if (modal.variant === 'alert') setModal((prev) => ({ ...prev, open: false }))
        }}
        onCancel={() => setModal((prev) => ({ ...prev, open: false }))}
      />

      <ConfirmModal
        open={deleteOrdersTarget}
        variant="confirm"
        title="Cancellare tutti gli ordini?"
        message="Tutti gli ordini per questo evento verranno eliminati definitivamente e i contatori degli ordini verranno azzerati. Operazione irreversibile."
        confirmLabel={deletingOrders ? 'Eliminazione...' : 'Cancella tutto'}
        danger
        onConfirm={async () => {
          if (!eventId || deletingOrders) return
          setDeletingOrders(true)
          try {
            await apiRequest(`/orders/event/${eventId}`, { method: 'DELETE' })
            setModal({ open: true, variant: 'alert', title: 'Ordini cancellati', message: 'Tutti gli ordini dell\'evento sono stati cancellati.' })
          } catch {
            setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Impossibile cancellare gli ordini.' })
          } finally {
            setDeletingOrders(false)
            setDeleteOrdersTarget(false)
          }
        }}
        onCancel={() => setDeleteOrdersTarget(false)}
      />
    </div>
  )
}
