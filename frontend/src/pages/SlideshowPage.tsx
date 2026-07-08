import { useEffect, useState } from 'react'
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
}

const SHOW_INTERVAL_MS = 15_000
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

  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    apiRequest<{ items: Photo[] }>(`/events/${eventId}/photos`)
      .then((res) => {
        if (cancelled || res.items.length === 0) return
        const all = res.items
        setBatch(shuffle(all).slice(0, PHOTOS_PER_PAGE))

        intervalId = setInterval(() => {
          setBatch(shuffle(all).slice(0, PHOTOS_PER_PAGE))
        }, SHOW_INTERVAL_MS)
      })
      .catch(() => {})

    apiRequest<{ item: EventData }>(`/events/${eventId}`)
      .then((res) => { if (!cancelled) setEventData(res.item) })
      .catch(() => {})

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [eventId])

  const emptyCells = PHOTOS_PER_PAGE - batch.length

  return (
    <div className={styles.fullscreen}>
      <div className={styles.grid}>
        {batch.map((p) => (
          <img key={p.id} src={p.image.url} alt="" className={styles.photo} />
        ))}
        {Array.from({ length: emptyCells }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.photo} style={{ background: '#222' }} />
        ))}
      </div>

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
