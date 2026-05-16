import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import styles from '../App.module.scss'
import homeStyles from './HomePage.module.scss'

type EventItem = {
  id: string
  name: string
  location: { label: string; city?: string | null }
  startDate: string
  endDate: string
  shortDescription: string | null
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
    <main>
      <section className={styles.heroSection} id="intro">
        <div className={`page-shell ${styles.heroLayout}`}>
          <div className={styles.heroContent}>
            <span className="eyebrow">Prossimi eventi in programma</span>
            <h1 className={styles.heroTitle}>
              Street food, gestito come si deve.
            </h1>
            <p className={styles.heroCopy}>
              Scopri gli eventi in arrivo, esplora la platform e accedi alla
              dashboard per gestire stand, menu e wallet.
            </p>

            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} to="/platform">
                Scopri la platform
              </Link>
              <Link className={styles.secondaryAction} to="/login">
                Accedi alla dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={homeStyles.eventsSection}>
        <div className="page-shell">
          <h2 className={homeStyles.sectionTitle}>Eventi in programma</h2>

          {isLoading && <p className={homeStyles.empty}>Caricamento...</p>}

          {!isLoading && events.length === 0 && (
            <p className={homeStyles.empty}>Nessun evento in programma al momento.</p>
          )}

          <div className={homeStyles.eventGrid}>
            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className={homeStyles.eventCard}>
                <strong className={homeStyles.eventName}>{event.name}</strong>
                {event.shortDescription && (
                  <span className={homeStyles.eventDesc}>{event.shortDescription}</span>
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
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.loginTeaserSection} id="login">
        <div className={`page-shell ${styles.loginTeaser}`}>
          <div className={styles.loginTeaserCopy}>
            <span className="eyebrow">Accesso protetto</span>
            <h2 className="section-title">Accesso unico per dashboard, stand e wallet.</h2>
            <p className="section-copy">
              La pagina di login collega il frontend al backend auth con sessione sicura,
              redirect su dashboard e navigazione protetta per ruolo.
            </p>
          </div>

          <div className={styles.loginCard}>
            <span className={styles.loginLabel}>Accesso reale</span>
            <strong className={styles.loginTitle}>Apri la pagina login e prova il flusso.</strong>
            <p className={styles.loginHint}>
              Dopo l&apos;autenticazione la navbar cambia stato e l&apos;utente entra nella dashboard protetta.
            </p>
            <Link className={styles.loginAction} to="/login">
              Vai al login
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
