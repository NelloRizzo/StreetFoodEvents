import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
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
}

export function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiRequest<{ items: EventItem[] }>('/events')
      .then((data) => {
        const upcoming = data.items.filter(
          (e) => new Date(e.endDate) >= new Date(),
        )
        setEvents(upcoming)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

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

          {!isLoading && events.length === 0 && (
            <p className={homeStyles.empty}>Nessun evento in programma al momento.</p>
          )}

          <div className={homeStyles.eventGrid}>
            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className={homeStyles.eventCard}>
                {event.coverImage?.url && (
                  <div className={homeStyles.cardCover}>
                    <img src={event.coverImage.url} alt="" />
                  </div>
                )}
                <div className={homeStyles.cardBody}>
                  <strong className={homeStyles.eventName}>{event.name}</strong>
                  {event.shortDescription && (
                    <span className={homeStyles.eventDesc} dangerouslySetInnerHTML={{ __html: event.shortDescription }} />
                  )}
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
              </Link>
            ))}
          </div>

          <div className={homeStyles.ctaSection}>
            <Link to="/login" className={homeStyles.ctaPrimary}>Accedi</Link>
            <Link to="/register" className={homeStyles.ctaSecondary}>Registrati</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
