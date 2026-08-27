import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { ConfirmModal } from '../components/ConfirmModal'
import { useAuth } from '../features/auth/auth-context'
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
  defaultFrameId: string | null
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
  const { isAuthenticated } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [stands, setStands] = useState<Stand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favId, setFavId] = useState<string | null>(null)
  const [favLoading, setFavLoading] = useState(false)
  const [hasContestAdmin, setHasContestAdmin] = useState(false)
  const [hasPhotoAdmin, setHasPhotoAdmin] = useState(false)
  const [hasEventAdmin, setHasEventAdmin] = useState(false)
  const [frameOptions, setFrameOptions] = useState<{ id: string; name: string }[]>([])
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
    if (!eventId || !isAuthenticated) return
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
      .then((data) => {
        const eventRoles = data.roles.filter(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        setHasContestAdmin(data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'contest-admin'))
        setHasEventAdmin(data.isPlatformAdmin || eventRoles.some((r) => ['event-admin', 'event-cashier'].includes(r.slug)))
        const isPhotoAdmin = data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'photo-admin')
        setHasPhotoAdmin(isPhotoAdmin)
        if (isPhotoAdmin) {
          apiRequest<{ items: { id: string; name: string }[] }>('/frames')
            .then((d) => setFrameOptions(d.items ?? []))
            .catch(() => {})
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

  const standShowOnMap = (stand: Stand) =>
    stand.numbers?.find((n) => n.eventId === eventId)?.showOnMap ?? true

  const handleMoveStand = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (!eventId || target < 0 || target >= sortedStands.length) return
    const next = [...sortedStands]
    const [moving] = next.splice(index, 1)
    next.splice(target, 0, moving)
    const items = next.map((s, i) => ({ standId: s.id, number: i + 1, showOnMap: standShowOnMap(s) }))
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
            <Link to={`/events/${eventId}/menu`} className={styles.actionBtnOutline}>
              Menù
            </Link>
            <Link to={`/events/${eventId}/galleria`} className={styles.actionBtnOutline}>
              Galleria
            </Link>
            <Link to={`/events/${eventId}/photo-booth`} className={styles.actionBtnOutline}>
              Scatta foto
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

        {/* Stand numbering (admin) */}
        {hasEventAdmin && (
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

        {/* Frame admin */}
        {hasPhotoAdmin && (
          <section className={styles.standsSection}>
            <h2 className={styles.sectionTitle}>Cornice Photo Booth</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)', margin: '0 0 0.5rem' }}>
              Cornice applicata automaticamente nel photo booth pubblico dell&apos;evento.
            </p>
            <select
              value={event?.defaultFrameId ?? ''}
              onChange={(e) => {
                const value = e.target.value || null
                if (!eventId) return
                apiRequest(`/events/${eventId}`, {
                  method: 'PATCH',
                  bodyJson: { defaultFrameId: value },
                })
                  .then(() => setEvent((prev) => prev ? { ...prev, defaultFrameId: value } : prev))
                  .catch(() => {})
              }}
            >
              <option value="">Nessuna cornice</option>
              {frameOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </section>
        )}

        {/* Contest admin link */}
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
