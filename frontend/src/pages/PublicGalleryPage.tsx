import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { PhotoLikeButton } from '../components/PhotoLikeButton'
import { apiRequest } from '../lib/api'
import { getDeviceId } from '../lib/device'
import { medalForRank } from '../lib/photoLikes'
import styles from './EventGalleryPage.module.scss'

type EventPhoto = {
  id: string
  type: 'image' | 'video'
  image: { url: string; publicId: string; width: number; height: number; format: string; bytes: number } | null
  video: { url: string; publicId: string; width: number; height: number; format: string; bytes: number; duration: number } | null
  sequenceNumber: number
  takenAt: string
  frameId: string | null
  likeCount: number
  liked: boolean
  rank: number | null
}

export function PublicGalleryPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [eventName, setEventName] = useState('')
  const [photos, setPhotos] = useState<EventPhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lightboxPhoto, setLightboxPhoto] = useState<EventPhoto | null>(null)

  /* Il deviceId nella query accende il cuore «mio»; conteggi e medaglie sono
     pubblici e arrivano comunque. Ricaricare dopo un toggle serve perche' un
     like nuovo puo' spostare il podio. */
  const loadPhotos = useCallback(async () => {
    if (!eventId) return
    const res = await apiRequest<{ items: EventPhoto[] }>(
      `/events/${eventId}/photos?deviceId=${encodeURIComponent(getDeviceId())}`
    )
    setPhotos(res.items)
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    Promise.all([
      apiRequest<{ item: { name: string } }>(`/events/${eventId}`),
      loadPhotos(),
    ])
      .then(([ev]) => {
        setEventName(ev.item.name)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [eventId, loadPhotos])

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to={`/events/${eventId}`} className="back-link">&larr; Torna all'evento</Link>

        <h1 className={styles.title}>Galleria media</h1>
        <p className={styles.subtitle}>{eventName}</p>

        <div className={styles.grid}>
          {photos.length === 0 && (
            <p className={styles.empty}>Nessuna foto nella galleria.</p>
          )}
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={styles.card}
              onClick={() => setLightboxPhoto(photo)}
            >
              {photo.type === 'video' && photo.video ? (
                <video
                  src={photo.video.url}
                  className={styles.image}
                  preload="metadata"
                  onClick={(e) => { e.stopPropagation(); setLightboxPhoto(photo) }}
                />
              ) : photo.image ? (
                <img src={photo.image.url} alt={`Foto ${photo.sequenceNumber}`} className={styles.image} loading="lazy" />
              ) : null}
              <span className={styles.seq}>#{photo.sequenceNumber}</span>
              {photo.type === 'video' && (
                <span className={styles.videoBadge}>&#127916;</span>
              )}
              {photo.type === 'image' && photo.rank !== null && (
                <span
                  className={styles.medal}
                  title={`${photo.rank}\u00ba posto per «mi piace»`}
                  aria-label={`${photo.rank}\u00ba posto per «mi piace»`}
                >
                  {medalForRank(photo.rank)}
                </span>
              )}
              {photo.type === 'image' && eventId && (
                <PhotoLikeButton
                  eventId={eventId}
                  photoId={photo.id}
                  likeCount={photo.likeCount}
                  liked={photo.liked}
                  onChange={() => { void loadPhotos() }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {lightboxPhoto && (
        <div
          className={styles.lightbox}
          onClick={() => setLightboxPhoto(null)}
        >
          {lightboxPhoto.type === 'video' && lightboxPhoto.video ? (
            <video
              src={lightboxPhoto.video.url}
              className={styles.lightboxMedia}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxPhoto.image?.url ?? ''}
              alt={`Foto ${lightboxPhoto.sequenceNumber}`}
              className={styles.lightboxMedia}
            />
          )}
          <span className={styles.lightboxSeq}>#{lightboxPhoto.sequenceNumber}</span>
        </div>
      )}
    </div>
  )
}
