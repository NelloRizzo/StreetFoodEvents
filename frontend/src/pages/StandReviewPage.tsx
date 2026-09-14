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

type StandLite = {
  id: string
  name: string
  slogan?: string | null
}

export function StandReviewPage() {
  const { eventId, standId } = useParams<{ eventId: string; standId: string }>()
  const [event, setEvent] = useState<EventLite | null>(null)
  const [stand, setStand] = useState<StandLite | null>(null)
  const [summary, setSummary] = useState<ReviewsSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [myReviews, setMyReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId || !standId) return
    const [ev, st, sum, list, mine] = await Promise.all([
      apiRequest<{ item: EventLite }>(`/events/${eventId}`),
      apiRequest<{ item: StandLite }>(`/stands/${standId}`),
      fetchReviewsSummary(eventId, standId),
      fetchEventReviews(eventId, { standId }),
      fetchMyReviews(eventId),
    ])
    setEvent(ev.item)
    setStand(st.item)
    setSummary(sum)
    setReviews(list.items)
    setMyReviews(mine.items)
  }, [eventId, standId])

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
  if (error || !event || !stand) return <div className={styles.page}>{error ?? 'Stand non trovato'}</div>

  const standSummary = summary?.stands.find((s) => s.standId === standId) ?? null
  const alreadyReviewed = myReviews.some((r) => r.standId === standId)

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to={`/events/${eventId}/stands/${standId}`}>
        &larr; Torna al menu di {stand.name}
      </Link>

      <header className={styles.hero}>
        <h1 className={styles.title}>{stand.name}</h1>
        <p className={styles.subtitle}>
          Recensioni dello stand — {event.name}
        </p>
        <div className={styles.summary}>
          <RatingStars value={standSummary?.avg ?? null} size={24} />
          <span className={styles.ratingValue}>{standSummary?.avg ?? '–'}</span>
          <span className={styles.ratingCount}>({standSummary?.count ?? 0} recensioni)</span>
        </div>
      </header>

      <div className={styles.cols}>
        <section>
          {alreadyReviewed ? (
            <div className={styles.already}>
              Hai già pubblicato una recensione per questo stand.
            </div>
          ) : (
            <ReviewForm eventId={eventId!} standId={standId} targetLabel="stand" onCreated={handleCreated} />
          )}
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Recensioni stand</h2>
          {reviews.length === 0 ? (
            <p className={styles.empty}>Ancora nessuna recensione per questo stand.</p>
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
  )
}