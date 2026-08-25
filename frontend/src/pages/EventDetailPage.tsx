import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { ConfirmModal } from '../components/ConfirmModal'
import { useEventTheme } from '../features/theme/useEventTheme'
import { QRCodeDownload } from '../components/QRCodeDownload'
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

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [stands, setStands] = useState<Stand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favId, setFavId] = useState<string | null>(null)
  const [favLoading, setFavLoading] = useState(false)
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

  const standNumber = (stand: Stand) =>
    stand.numbers?.find((n) => n.eventId === eventId)?.number ?? null

  const sortedStands = [...stands].sort((a, b) => {
    const na = standNumber(a)
    const nb = standNumber(b)
    if (na == null && nb == null) return a.name.localeCompare(b.name)
    if (na == null) return 1
    if (nb == null) return -1
    return na - nb
  })


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
            <Link to={`/events/${eventId}/menu`} className={styles.actionBtnOutline}>
              Menù
            </Link>
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
    </div>
  )
}
