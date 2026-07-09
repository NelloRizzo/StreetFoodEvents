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
  const [hasPhotoAdmin, setHasPhotoAdmin] = useState(false)
  const [hasPhotoPrint, setHasPhotoPrint] = useState(false)
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
  const [frames, setFrames] = useState<{ id: string; name: string; image: UploadedImage; textPosition: { vertical: string; horizontal: string } }[]>([])
  const [frameName, setFrameName] = useState('')
  const [frameImage, setFrameImage] = useState<UploadedImage | null>(null)
  const [frameTextPosition, setFrameTextPosition] = useState({ vertical: 'bottom', horizontal: 'center' })
  const [savingFrame, setSavingFrame] = useState(false)

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
    if (!eventId) return
    apiRequest<{ items: { id: string; name: string; image: UploadedImage }[] }>(`/frames`).then((d) => setFrames(d.items)).catch(() => {})
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
        setHasPhotoAdmin(data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'photo-admin'))
        setHasPhotoPrint(data.isPlatformAdmin || eventRoles.some((r) => ['photo-admin', 'photo-print'].includes(r.slug)))
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

  const saveFrame = async () => {
    if (!eventId || savingFrame || !frameName.trim() || !frameImage) return
    setSavingFrame(true)
    try {
      await apiRequest(`/frames`, {
        method: 'POST',
        bodyJson: { name: frameName.trim(), image: frameImage, textPosition: frameTextPosition },
      })
      setFrameName('')
      setFrameImage(null)
      setFrameTextPosition({ vertical: 'bottom', horizontal: 'center' })
      const data = await apiRequest<{ items: { id: string; name: string; image: UploadedImage }[] }>(`/frames`)
      setFrames(data.items)
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Salvataggio cornice fallito.' })
    } finally {
      setSavingFrame(false)
    }
  }

  const deleteFrame = async (frameId: string) => {
    try {
      await apiRequest(`/frames/${frameId}`, { method: 'DELETE' })
      setFrames((prev) => prev.filter((f) => f.id !== frameId))
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Eliminazione cornice fallita.' })
    }
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

          {hasPhotoAdmin && (
            <section className={styles.poiSection}>
              <h2 className={styles.sectionTitle}>
                Cornici <span className={styles.count}>{frames.length}</span>
              </h2>

              <div className={styles.poiForm}>
                <label className={styles.poiField}>
                  Nome
                  <input type="text" value={frameName} onChange={(e) => setFrameName(e.target.value)} placeholder="Nome cornice" />
                </label>
                <div className={styles.poiField}>
                  <span>Immagine overlay (PNG trasparente)</span>
                  <ImageUploader mode="single" type="event" value={frameImage} onChange={(data) => setFrameImage(data as UploadedImage | null)} />
                </div>
                <div className={styles.poiField}>
                  <span>Posizione testo (nome evento + data)</span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <select value={frameTextPosition.vertical} onChange={(e) => setFrameTextPosition((p) => ({ ...p, vertical: e.target.value }))} style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}>
                      <option value="top">Alto</option>
                      <option value="center">Centro</option>
                      <option value="bottom">Basso</option>
                    </select>
                    <select value={frameTextPosition.horizontal} onChange={(e) => setFrameTextPosition((p) => ({ ...p, horizontal: e.target.value }))} style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}>
                      <option value="left">Sinistra</option>
                      <option value="center">Centro</option>
                      <option value="right">Destra</option>
                    </select>
                  </div>
                </div>
                <div className={styles.poiFormActions}>
                  <button className={styles.saveBtn} onClick={saveFrame} disabled={savingFrame || !frameName.trim() || !frameImage}>
                    {savingFrame ? 'Salvataggio...' : 'Aggiungi cornice'}
                  </button>
                </div>
              </div>

              {frames.length === 0 && (
                <p className={styles.empty}>Nessuna cornice. Carica un'immagine PNG con trasparenza.</p>
              )}

              <div className={styles.poiList}>
                {frames.map((frame) => (
                  <div key={frame.id} className={styles.poiCard}>
                    <div className={styles.poiCardBody}>
                      <strong className={styles.poiCardName}>{frame.name}</strong>
                      {frame.textPosition && (
                        <span style={{ display: 'block', fontSize: 12, color: '#888', marginTop: 2 }}>
                          Testo: {frame.textPosition.vertical} / {frame.textPosition.horizontal}
                        </span>
                      )}
                      {frame.image.url && (
                        <img src={frame.image.url} alt={frame.name} style={{ maxWidth: 120, borderRadius: 8, marginTop: 4 }} />
                      )}
                    </div>
                    <div className={styles.poiCardActions}>
                      <button className={styles.dangerBtn} onClick={() => deleteFrame(frame.id)}>Elimina</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
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
