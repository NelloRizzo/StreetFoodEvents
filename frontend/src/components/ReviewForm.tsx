import { useState } from 'react'

import { useAuth } from '../features/auth/auth-context'
import { submitReview } from '../lib/reviews'
import type { Review } from './ReviewCard'
import { RatingStars } from './RatingStars'
import styles from './ReviewForm.module.scss'

type Props = {
  eventId: string
  standId?: string | null
  targetLabel?: string
  onCreated?: (review: Review) => void
}

export function ReviewForm({ eventId, standId = null, targetLabel = 'stand', onCreated }: Props) {
  const { isAuthenticated } = useAuth()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [whatBought, setWhatBought] = useState('')
  const [reviewerName, setReviewerName] = useState('')
  const [reviewerEmail, setReviewerEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isStandReview = standId != null
  const canSubmit = rating >= 1 && (!isAuthenticated ? reviewerName.trim().length > 0 : true)

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitReview(eventId, {
        standId,
        rating,
        comment: comment.trim() || null,
        whatBought: isStandReview && whatBought.trim() ? whatBought.trim() : null,
        reviewerName: reviewerName.trim() || null,
        reviewerEmail: reviewerEmail.trim() || null,
      })
      setRating(0)
      setComment('')
      setWhatBought('')
      setReviewerName('')
      setReviewerEmail('')
      onCreated?.(res.item)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'invio della recensione')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.form}>
      <h3 className={styles.title}>Lascia una recensione</h3>

      <label className={styles.field}>
        <span className={styles.labelText}>La tua valutazione ({targetLabel})</span>
        <RatingStars value={rating} onChange={setRating} size={30} />
      </label>

      <label className={styles.field}>
        <span className={styles.labelText}>Commento (facoltativo)</span>
        <textarea
          className={styles.textarea}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Racconta la tua esperienza…"
        />
      </label>

      {isStandReview && (
        <label className={styles.field}>
          <span className={styles.labelText}>Cosa hai comprato (facoltativo)</span>
          <input
            className={styles.input}
            value={whatBought}
            onChange={(e) => setWhatBought(e.target.value)}
            maxLength={200}
            placeholder="Es. burger + patatine"
          />
        </label>
      )}
        {!isAuthenticated && (
        <>
          <label className={styles.field}>
            <span className={styles.labelText}>Il tuo nome *</span>
            <input
              className={styles.input}
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              maxLength={200}
              placeholder="Come vuoi firmare la recensione"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelText}>Email (facoltativa, resta privata)</span>
            <input
              type="email"
              className={styles.input}
              value={reviewerEmail}
              onChange={(e) => setReviewerEmail(e.target.value)}
              maxLength={300}
              placeholder="La tua email"
            />
          </label>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting ? 'Invio…' : 'Pubblica recensione'}
      </button>
    </div>
  )
}