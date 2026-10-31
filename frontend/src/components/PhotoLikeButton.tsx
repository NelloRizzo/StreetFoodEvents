import { useState, type MouseEvent } from 'react'

import { getDeviceId } from '../lib/device'
import { togglePhotoLike } from '../lib/photoLikes'
import styles from './PhotoLikeButton.module.scss'

type PhotoLikeButtonProps = {
  eventId: string
  photoId: string
  likeCount: number
  liked: boolean
  /* La card ricarica la lista dopo il toggle: conteggi e medaglie arrivano dal
     server (un like nuovo puo' cambiare l'ordine delle prime tre posizioni),
     quindi non si aggiornano solo in locale. */
  onChange: () => void
}

export function PhotoLikeButton({ eventId, photoId, likeCount, liked, onChange }: PhotoLikeButtonProps) {
  const [busy, setBusy] = useState(false)

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    /* La card apre il lightbox al click: senza stopPropagation mettere un
       «mi piace» aprirebbe anche la foto a schermo intero. */
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      await togglePhotoLike(eventId, photoId, getDeviceId())
      onChange()
    } catch {
      /* niente banner in una griglia: lo stato torna dal prossimo caricamento */
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`${styles.like} ${liked ? styles.liked : ''}`}
      onClick={handleClick}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? 'Togli il «mi piace»' : 'Metti «mi piace»'}
      title={liked ? 'Togli il «mi piace»' : 'Metti «mi piace»'}
    >
      <span className={styles.heart} aria-hidden="true">{liked ? '\u2665' : '\u2661'}</span>
      <span className={styles.count}>{likeCount}</span>
    </button>
  )
}
