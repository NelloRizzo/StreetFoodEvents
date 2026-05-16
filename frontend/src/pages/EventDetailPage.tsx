import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useEventTheme } from '../features/theme/useEventTheme'
import { QRCodeDownload } from '../components/QRCodeDownload'
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
  const [event, setEvent] = useState<Event | null>(null)
  const [stands, setStands] = useState<Stand[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
              <Link
                key={stand.id}
                to={`/events/${eventId}/stands/${stand.id}`}
                className={styles.standCard}
              >
                <strong className={styles.standName}>{stand.name}</strong>
                {stand.slogan && (
                  <span className={styles.standSlogan}>{stand.slogan}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
