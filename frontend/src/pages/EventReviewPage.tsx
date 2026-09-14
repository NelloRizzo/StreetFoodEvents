import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ReviewCard, type Review } from '../components/ReviewCard'
import { ReviewForm } from '../components/ReviewForm'
import { RatingStars } from '../components/RatingStars'
import { apiRequest } from '../lib/api'
import { fetchEventReviews, fetchMyReviews, fetchReviewsSummary, type ReviewsSummary } from '../lib/reviews'
import styles from './ReviewPage.module.scss'

type EventLite = {
  id?: string
  name: string
}

export function EventReviewPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<EventLite | null>(null)
  const [summary, setSummary] = useState<ReviewsSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [myReviews, setMyReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) return
    const [ev, sum, list, mine] = await Promise.all([
      apiRequest<{ item: EventLite }>(`/events/${eventId}`),
      fetchReviewsSummary(eventId),
      fetchEventReviews(eventId),
      fetchMyReviews(eventId),
    ])
    setEvent(ev.item)
    setSummary(sum)
    setReviews(list.items)
    setMyReviews(mine.items)
  }, [eventId])

  useEffect(() => {
    setLoading(true)
    load()
      .catch(() => {
        setError('Impossibile caricare le recensioni')
        setLoading(false)
      })
      .then(() => setLoading(false))
  }, [load])

  const handleCreated = useCallback(() => {
    void load()
  }, [load])

  if (loading) return <div className={styles.page}>Caricamento…</div>
  if (error || !event) return <div className={styles.page}>{error ?? 'Evento non trovato'}</div>

  const alreadyReviewed = myReviews.some((r) => r.standId === null)

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link className={styles.backLink} to={`/events/${eventId}`}>
          &larr; Torna all'evento
        </Link>

        <header className={styles.hero}>
          <h1 className={styles.title}>{event.name}</h1>
          <p className={styles.subtitle}>Recensioni dell'evento</p>
          <div className={styles.summary}>
            <RatingStars value={summary?.event.avg ?? null} size={24} />
            <span className={styles.ratingValue}>{summary?.event.avg ?? '–'}</span>
            <span className={styles.ratingCount}>({summary?.event.count ?? 0} recensioni)</span>
          </div>
        </header>

        <div className={styles.cols}>
          <section>
            {alreadyReviewed ? (
              <div className={styles.already}>
                Hai già pubblicato una recensione per questo evento.
              </div>
            ) : (
              <ReviewForm eventId={eventId!} targetLabel="evento" onCreated={handleCreated} />
            )}
          </section>

          <section>
            <h2 className={styles.sectionTitle}>Recensioni evento</h2>
            {reviews.length === 0 ? (
              <p className={styles.empty}>Ancora nessuna recensione per questo evento.</p>
            ) : (
              <div className={styles.list}>
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}