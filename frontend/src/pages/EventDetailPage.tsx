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
import { CurrencyDisplay } from '../components/CurrencyDisplay'
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
  location: { label: string; city?: string | null; googleMapsUrl?: string | null; coordinates?: { coordinates?: [number, number] } | null }
  startDate: string
  endDate: string
  currencyName: string
  currencySymbol: UploadedImage | null
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
  type: 'food' | 'artigianato' | 'divertimento'
  name: string
  slogan: string | null
  description: string | null
  eventIds: string[]
  numbers: Array<{ eventId: string; number: number; showOnMap?: boolean }>
  coverImage: UploadedImg | null
  logo: UploadedImg | null
}

const STAND_TYPE_LABELS = {
  food: 'Food & Beverage',
  artigianato: 'Artigianato',
  divertimento: 'Divertimento',
} as const

const STAND_TYPE_EMOJIS = {
  food: '🍽️',
  artigianato: '🧶',
  divertimento: '🎡',
} as const

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
  { value: 'entrance', label: '🪧 Ingresso' },
  { value: 'parking', label: '🅿️ Parcheggio' },
  { value: 'stage', label: '🎵 Palco' },
  { value: 'food', label: '🍽️ Cibo' },
  { value: 'drink', label: '🍺 Bibite' },
  { value: 'cassa', label: '💳 Cassa' },
  { value: 'bancomat', label: '🏧 Bancomat' },
  { value: 'cinema', label: '🎬 Cinema' },
  { value: 'relax', label: '🧘 Relax' },
  { value: 'ristoro', label: '🧺 Ristoro' },
  { value: 'divertimento', label: '🎢 Divertimento' },
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
  const [isFavorite, setIsFavorite] = useState(false)
  const [favId, setFavId] = useState<string | null>(null)
  const [favLoading, setFavLoading] = useState(false)
  const [pois, setPois] = useState<PoiItem[]>([])
  const [showPoiForm, setShowPoiForm] = useState(false)
  const [editingPoiId, setEditingPoiId] = useState<string | null>(null)
  const [deleteOrdersTarget, setDeleteOrdersTarget] = useState(false)
  const [confirmResetTarget, setConfirmResetTarget] = useState(false)
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

    localStorage.setItem('lastEventId', eventId)

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

  const standNumber = (stand: Stand) =>
    stand.numbers?.find((n) => n.eventId === eventId)?.number ?? null

  const standShowOnMap = (stand: Stand) =>
    stand.numbers?.find((n) => n.eventId === eventId)?.showOnMap ?? true

  const sortedStands = [...stands].sort((a, b) => {
    const na = standNumber(a)
    const nb = standNumber(b)
    if (na == null && nb == null) return a.name.localeCompare(b.name)
    if (na == null) return 1
    if (nb == null) return -1
    return na - nb
  })

  const handleMoveStand = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (!eventId || target < 0 || target >= sortedStands.length) return
    const next = [...sortedStands]
    const [moving] = next.splice(index, 1)
    next.splice(target, 0, moving)
    const items = next
      .map((s, i) => ({ standId: s.id, number: i + 1, showOnMap: standShowOnMap(s) }))
    try {
      await apiRequest('/stands/reorder', { method: 'PATCH', bodyJson: { eventId, items } })
      setStands((prev) => {
        const numberByStand = new Map(items.map((it) => [it.standId, it.number]))
        return prev.map((s) => ({
          ...s,
          numbers: numberByStand.has(s.id)
            ? [{ eventId, number: numberByStand.get(s.id)!, showOnMap: standShowOnMap(s) }]
            : s.numbers,
        }))
      })
    } catch { /* ignore */ }
  }

  const handleToggleStandMap = async (stand: Stand) => {
    if (!eventId) return
    const next = !standShowOnMap(stand)
    const number = standNumber(stand)
    if (number == null) return
    try {
      await apiRequest('/stands/reorder', {
        method: 'PATCH',
        bodyJson: { eventId, items: [{ standId: stand.id, number, showOnMap: next }] },
      })
      setStands((prev) => prev.map((s) =>
        s.id === stand.id
          ? { ...s, numbers: s.numbers.map((n) => n.eventId === eventId ? { ...n, showOnMap: next } : n) }
          : s,
      ))
    } catch { /* ignore */ }
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
            <Link to={`/events/${eventId}/contests`} className={styles.actionBtnOutline}>
              Contest
            </Link>
            <Link to={`/events/${eventId}/menu`} className={styles.actionBtnOutline}>
              Menù
            </Link>
            {hasEventRole && (
              <>
                <Link to={`/admin/events/${eventId}/cashier`} className={styles.actionBtn}>
                  Cassa unica
                </Link>
                <Link to={`/admin/events/${eventId}/orders`} className={styles.actionBtnOutline}>
                  Gestisci ordini
                </Link>
              </>
            )}
            {hasPhotoPrint && (
              <>
                <Link to={`/admin/events/${eventId}/galleria`} className={styles.actionBtnOutline}>
                  Galleria
                </Link>
                <Link to={`/events/${eventId}/slideshow`} className={styles.actionBtnOutline}>
                  Slideshow
                </Link>
              </>
            )}
            {isAuthenticated && (
              <Link to={`/admin/events/${eventId}/photo-booth`} className={styles.actionBtnOutline}>
                Photo Booth
              </Link>
            )}
            {isPlatformAdmin && (
              <button className={styles.dangerBtn} onClick={() => setDeleteOrdersTarget(true)}>
                Azzera ordini
              </button>
            )}
            <QRCodeDownload apiPath={`/events/${eventId}/qrcode`} fileName={`evento-${event.name}`} label="QR Evento" />
            <QRCodeDownload apiPath={`/events/${eventId}/menu-qrcode`} fileName={`menu-${event.name}`} label="QR Menu" />
          </div>
        </div>
      </section>

      <div className="page-shell">
        {/* Info row */}
        <div className={styles.infoRow}>
          <span className={styles.currencyBadge}>
            <CurrencyDisplay currencyName={event.currencyName} currencySymbol={event.currencySymbol} />
            {event.currencyName}
          </span>
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
        {(['food', 'artigianato', 'divertimento'] as const).map((standType) => {
          const typeStands = sortedStands.filter((s) => (s.type ?? 'food') === standType)
          return (
            <section key={standType} className={styles.standsSection}>
              <h2 className={styles.sectionTitle}>
                {STAND_TYPE_EMOJIS[standType]} {STAND_TYPE_LABELS[standType]}
                <span className={styles.count}>{typeStands.length}</span>
              </h2>

              {typeStands.length === 0 && (
                <p className={styles.empty}>Nessuno stand {STAND_TYPE_LABELS[standType].toLowerCase()}.</p>
              )}

              <div className={styles.standGrid}>
                {typeStands.map((stand) => (
                  <Link
                    key={stand.id}
                    to={`/events/${eventId}/stands/${stand.id}`}
                    className={styles.standCard}
                  >
                    {stand.coverImage?.url || stand.logo?.url ? (
                      <div className={styles.standCover}>
                        <img src={(stand.coverImage ?? stand.logo)!.url} alt="" />
                      </div>
                    ) : (
                      <div className={styles.standCoverPlaceholder}>
                        <span>🏪</span>
                      </div>
                    )}
                    <div className={styles.standBody}>
                      <strong className={styles.standName}>
                        {standNumber(stand) != null && (
                          <span className={styles.standNumberBadge}>{standNumber(stand)}</span>
                        )}
                        {stand.name}
                      </strong>
                      {stand.slogan && <span className={styles.standSlogan}>{stand.slogan}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}

        {/* Stand numbering (admin) */}
        {hasEventRole && (
          <section className={styles.standsSection}>
            <h2 className={styles.sectionTitle}>
              Numerazione stand <span className={styles.count}>{sortedStands.length}</span>
            </h2>
            <p className={styles.empty}>
              I numeri sono globali per evento, senza distinzione di categoria. Usa le frecce per riordinare tutti gli stand in un&apos;unica sequenza.
            </p>
            <div className={styles.standGrid}>
              {sortedStands.map((stand) => {
                const index = sortedStands.indexOf(stand)
                return (
                  <div key={stand.id} className={styles.standCardRow}>
                    <Link
                      to={`/events/${eventId}/stands/${stand.id}`}
                      className={styles.standCard}
                    >
                      <div className={styles.standBody}>
                        <strong className={styles.standName}>
                          <span className={styles.standNumberBadge}>{standNumber(stand) ?? '?'}</span>
                          {stand.name}
                        </strong>
                        <span className={`${styles.standTypeBadge} ${stand.type === 'artigianato' ? styles.standTypeBadgeArtigianato : stand.type === 'divertimento' ? styles.standTypeBadgeDivertimento : ''}`}>
                          {STAND_TYPE_EMOJIS[stand.type ?? 'food']} {STAND_TYPE_LABELS[stand.type ?? 'food']}
                        </span>
                      </div>
                    </Link>
                    <div className={styles.reorderBtns}>
                      <label className={styles.standMapToggle} title="Mostra/nascondi lo stand nella mappa dell'evento">
                        <input
                          type="checkbox"
                          checked={standShowOnMap(stand)}
                          onChange={() => handleToggleStandMap(stand)}
                        />
                        <span>Mappa</span>
                      </label>
                      <button
                        className={styles.reorderBtn}
                        onClick={() => handleMoveStand(index, -1)}
                        disabled={index === 0}
                        title="Sposta su (numero più basso)"
                      >
                        ▲
                      </button>
                      <button
                        className={styles.reorderBtn}
                        onClick={() => handleMoveStand(index, 1)}
                        disabled={index === sortedStands.length - 1}
                        title="Sposta giù (numero più alto)"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

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
                  <MapPicker
                    lat={poiForm.latitude}
                    lng={poiForm.longitude}
                    onChange={(lat, lng) => setPoiForm((p) => ({ ...p, latitude: lat, longitude: lng }))}
                    height="200px"
                    resetCenter={(() => {
                      const coords = event?.location?.coordinates?.coordinates
                      return coords && coords.length === 2 && (coords[0] !== 0 || coords[1] !== 0)
                        ? { lat: coords[1], lng: coords[0] }
                        : undefined
                    })()}
                    resetLabel="Centra sull'evento"
                  />
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
            <Link to="/admin/frames" className={styles.actionBtn}>
              Gestisci cornici
            </Link>
          </>)}
          </>)}

        {hasContestAdmin && (
          <section className={styles.standsSection}>
            <h2 className={styles.sectionTitle}>Contest</h2>
            <Link to={`/admin/events/${eventId}/contest-manage`} className={styles.actionBtn}>
              Gestisci contest
            </Link>
            <Link to={`/events/${eventId}/contests`} className={styles.actionBtnOutline} style={{ marginLeft: '0.5rem' }}>
              Vedi contest pubblici
            </Link>
          </section>
        )}

        {hasExchangeAdmin && (<>
          <h2 className={styles.sectionTitle}>Cambio valuta</h2>
          <Link to={`/admin/events/${eventId}/exchange`} className={styles.actionBtn}>
            Gestisci cambio
          </Link>
          <Link to={`/admin/events/${eventId}/settlements`} className={styles.actionBtn} style={{ marginLeft: '0.5rem' }}>
            Liquidazione stand
          </Link>
          <Link to={`/admin/events/${eventId}/settlements/report`} className={styles.actionBtn} style={{ marginLeft: '0.5rem' }}>
            Resoconto liquidazioni
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
        title="Azzerare l'evento?"
        message="Verranno eliminati definitivamente per questo evento: tutti gli ordini (e i relativi resoconti), tutte le transazioni di cambio (carichi/rimborsi), le liquidazioni stand e i saldi dei portafogli verranno azzerati. I contatori ordini verranno resettati. Operazione irreversibile."
        confirmLabel="Continua"
        danger
        onConfirm={() => {
          setDeleteOrdersTarget(false)
          setConfirmResetTarget(true)
        }}
        onCancel={() => setDeleteOrdersTarget(false)}
      />

      <ConfirmModal
        open={confirmResetTarget}
        variant="prompt"
        title="Conferma definitiva"
        message="Per procedere all'azzeramento completo dell'evento digita AZZERA."
        confirmLabel={deletingOrders ? 'Azzeramento in corso...' : 'Azzera tutto'}
        danger
        onConfirm={async (value) => {
          if (!eventId || deletingOrders) return
          if (value?.trim().toUpperCase() !== 'AZZERA') {
            setConfirmResetTarget(false)
            setModal({ open: true, variant: 'alert', title: 'Conferma annullata', message: 'Digitare AZZERA per procedere all\'azzeramento.' })
            return
          }
          setDeletingOrders(true)
          try {
            const res = await apiRequest<{ message: string }>(`/orders/event/${eventId}/reset`, { method: 'POST' })
            setModal({ open: true, variant: 'alert', title: 'Evento azzerato', message: res.message })
          } catch (err) {
            setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Impossibile azzerare l\'evento.' })
          } finally {
            setDeletingOrders(false)
            setConfirmResetTarget(false)
          }
        }}
        onCancel={() => setConfirmResetTarget(false)}
      />
    </div>
  )
}
