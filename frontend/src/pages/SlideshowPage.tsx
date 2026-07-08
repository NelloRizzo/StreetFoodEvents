import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import styles from './SlideshowPage.module.scss'

type Photo = {
  id: string
  image: { url: string }
  sequenceNumber: number
}

type EventData = {
  name: string
  logo?: { url: string; publicId: string } | null
  coverImage?: { url: string; publicId: string } | null
}

const ROTATE_MS = 15_000
const POLL_MS = 2 * 60_000
const PHOTOS_PER_PAGE = 4

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

export function SlideshowPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [batch, setBatch] = useState<Photo[]>([])
  const [eventData, setEventData] = useState<EventData | null>(null)
  const allRef = useRef<Photo[]>([])

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    const fetchPhotos = () => {
      apiRequest<{ items: Photo[] }>(`/events/${eventId}/photos`)
        .then((res) => {
          if (cancelled) return
          allRef.current = res.items
          setBatch(
            res.items.length > 0
              ? shuffle(res.items).slice(0, PHOTOS_PER_PAGE)
              : []
          )
        })
        .catch(() => {})
    }

    fetchPhotos()

    const pollId = setInterval(fetchPhotos, POLL_MS)

    const rotateId = setInterval(() => {
      const items = allRef.current
      if (items.length > 0) {
        setBatch(shuffle(items).slice(0, PHOTOS_PER_PAGE))
      }
    }, ROTATE_MS)

    apiRequest<{ item: EventData }>(`/events/${eventId}`)
      .then((res) => { if (!cancelled) setEventData(res.item) })
      .catch(() => {})

    return () => {
      cancelled = true
      clearInterval(pollId)
      clearInterval(rotateId)
    }
  }, [eventId])

  const hasPhotos = batch.length > 0

  return (
    <div className={styles.fullscreen}>
      {hasPhotos ? (
        <div className={styles.grid}>
          {batch.map((p) => (
            <img key={p.id} src={p.image.url} alt="" className={styles.photo} />
          ))}
          {Array.from({ length: PHOTOS_PER_PAGE - batch.length }).map((_, i) => (
            <div key={`empty-${i}`} className={styles.photo} style={{ background: '#222' }} />
          ))}
        </div>
      ) : (
        eventData?.coverImage?.url && (
          <img src={eventData.coverImage.url} alt="" className={styles.cover} />
        )
      )}

      <div className={styles.header}>
        {eventData?.logo?.url && (
          <img src={eventData.logo.url} alt="" className={styles.logo} />
        )}
        <span className={styles.eventName}>
          {eventData?.name ?? 'Street Food Events'}
        </span>
      </div>

      <div className={styles.footer}>
        Se vedi una tua foto puoi recuperarla al Welcome Point
      </div>
    </div>
  )
}
