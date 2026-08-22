import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import homeStyles from './HomePage.module.scss'

type UploadedImage = {
  url: string
  publicId: string
  width: number
  height: number
  format: string
  bytes: number
}

type EventItem = {
  id: string
  name: string
  location: { label: string; city?: string | null }
  startDate: string
  endDate: string
  shortDescription: string | null
  coverImage: UploadedImage | null
  logo: UploadedImage | null
}

export function HomePage() {
  const { isAuthenticated } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [now] = useState(() => Date.now())

  useEffect(() => {
      apiRequest<{ items: EventItem[] }>('/events?public=true')
      .then((data) => {
        setEvents(data.items)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  const isFinished = (ev: EventItem) => {
    const endOfDay = new Date(ev.endDate)
    endOfDay.setHours(23, 59, 59, 999)
    return endOfDay.getTime() < now
  }

  const upcomingEvents = events.filter((ev) => !isFinished(ev))
  const finishedEvents = events
    .filter(isFinished)
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
    .slice(0, 3)

  return (
    <main className={homeStyles.page}>
      <section className={homeStyles.showcase}>
        <div className="page-shell">
          <div className={homeStyles.showcaseHeader}>
            <span className={homeStyles.eyebrow}>Street Food Events</span>
            <h1 className={homeStyles.showcaseTitle}>Eventi in programma</h1>
            <p className={homeStyles.showcaseCopy}>
              Scopri gli eventi di street food, esplora stand e menu.
            </p>
          </div>

          {isLoading && <p className={homeStyles.empty}>Caricamento...</p>}

          {!isLoading && upcomingEvents.length === 0 && (
            <p className={homeStyles.empty}>Nessun evento in programma al momento.</p>
          )}

          <div className={homeStyles.eventGrid}>
            {upcomingEvents.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className={homeStyles.eventCard}>
                {event.coverImage?.url && (
                  <div className={homeStyles.cardCover}>
                    <img src={event.coverImage.url} alt="" />
                    {event.logo?.url && (
                      <div className={homeStyles.cardLogoBadge}>
                        <img src={event.logo.url} alt={`${event.name} logo`} />
                      </div>
                    )}
                  </div>
                )}
                <div className={homeStyles.cardBody}>
                  {!event.coverImage?.url && event.logo?.url && (
                    <div className={homeStyles.cardLogoInline}>
                      <img src={event.logo.url} alt={`${event.name} logo`} />
                    </div>
                  )}
                  <strong className={homeStyles.eventName}>{event.name}</strong>
                  {event.shortDescription && (
                    <span className={homeStyles.eventDesc} dangerouslySetInnerHTML={{ __html: event.shortDescription }} />
                  )}
                  <div className={homeStyles.eventMeta}>
                    <span className={homeStyles.eventDate}>
                      {new Date(event.startDate).toLocaleDateString('it-IT', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                      {' — '}
                      {new Date(event.endDate).toLocaleDateString('it-IT', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </span>
                    <span className={homeStyles.eventLocation}>
                      {event.location.label}{event.location.city ? `, ${event.location.city}` : ''}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {finishedEvents.length > 0 && (
            <section className={homeStyles.pastSection}>
              <h2 className={homeStyles.pastTitle}>Eventi terminati</h2>
              <div className={homeStyles.pastList}>
                {finishedEvents.map((event) => (
                  <Link key={event.id} to={`/events/${event.id}`} className={homeStyles.pastItem}>
                    {event.logo?.url && (
                      <img className={homeStyles.pastLogo} src={event.logo.url} alt="" />
                    )}
                    <span className={homeStyles.pastName}>{event.name}</span>
                    <span className={homeStyles.pastDate}>
                      {new Date(event.startDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(event.endDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!isAuthenticated && (
            <div className={homeStyles.ctaSection}>
              <Link to="/login" className={homeStyles.ctaPrimary}>Accedi</Link>
              <Link to="/register" className={homeStyles.ctaSecondary}>Registrati</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
