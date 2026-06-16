import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
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
          <p className={styles.shortDesc}>{event.shortDescription}</p>
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
      </div>
    </div>
  )
}
