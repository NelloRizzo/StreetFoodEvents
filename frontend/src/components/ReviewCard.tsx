import { RatingStars } from './RatingStars'
import styles from './ReviewCard.module.scss'

export type Review = {
  id: string
  eventId: string
  standId: string | null
  rating: number
  comment: string | null
  reviewerName: string | null
  isVerified: boolean
  status: 'visible' | 'hidden'
  createdAt: string
}

type Props = {
  review: Review
  admin?: boolean
  onHide?: () => void
  onUnhide?: () => void
  onDelete?: () => void
}

export function ReviewCard({ review, admin = false, onHide, onUnhide, onDelete }: Props) {
  const date = new Date(review.createdAt).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const isHidden = review.status === 'hidden'

  return (
    <article className={`${styles.card} ${isHidden ? styles.hidden : ''}`}>
      <div className={styles.header}>
        <span className={styles.name}>{review.reviewerName ?? 'Anonimo'}</span>
        {review.isVerified && <span className={styles.badge}>Acquisto verificato</span>}
        {isHidden && <span className={styles.badgeHidden}>Nascosta</span>}
      </div>

      <div className={styles.meta}>
        <RatingStars value={review.rating} />
        <span className={styles.date}>{date}</span>
      </div>

      {review.comment && <p className={styles.comment}>{review.comment}</p>}

      {admin && (
        <div className={styles.actions}>
          {isHidden ? (
            onUnhide && (
              <button className={styles.actionBtn} onClick={onUnhide}>
                Mostra
              </button>
            )
          ) : (
            onHide && (
              <button className={styles.actionBtn} onClick={onHide}>
                Nascondi
              </button>
            )
          )}
          {onDelete && (
            <button className={`${styles.actionBtn} ${styles.danger}`} onClick={onDelete}>
              Elimina
            </button>
          )}
        </div>
      )}
    </article>
  )
}