import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import styles from './EventContestsPage.module.scss'

type ContestItem = {
  id: string
  name: string
  description: string | null
  startsAt: string
  endsAt: string
  durationMinutes: number
  requireSequence: boolean
  prize: string | null
  isActive: boolean
}

export function EventContestsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [contests, setContests] = useState<ContestItem[]>([])
  const [eventName, setEventName] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!eventId) return

    Promise.all([
      apiRequest<{ item: { name: string } }>(`/events/${eventId}`),
      apiRequest<{ items: ContestItem[] }>(`/contests?eventId=${eventId}`),
    ])
      .then(([ev, data]) => {
        setEventName(ev.item.name)
        const now = new Date()
        setContests(data.items.filter((c) => c.isActive && new Date(c.endsAt) > now))
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [eventId])

  if (isLoading) return null

  return (
    <div className={`page-shell ${styles.page}`}>
      <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; {eventName}</Link>
      <h1 className={styles.title}>Contest</h1>

      {contests.length === 0 && (
        <p className={styles.empty}>Nessun contest attivo al momento.</p>
      )}

      <div className={styles.grid}>
        {contests.map((contest) => (
          <Link key={contest.id} to={`/contest/${contest.id}`} className={styles.card}>
            <div className={styles.cardBody}>
              <h2 className={styles.cardName}>{contest.name}</h2>
              {contest.description && <p className={styles.cardDesc}>{contest.description}</p>}
              {contest.prize && (
                <span className={styles.prize}>Premio: {contest.prize}</span>
              )}
              <div className={styles.cardMeta}>
                <span>Durata: {contest.durationMinutes} min</span>
                <span>Ordine {contest.requireSequence ? 'preciso' : 'libero'}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
