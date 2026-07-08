import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import styles from './SlideshowPage.module.scss'

type Photo = {
  id: string
  image: { url: string }
  sequenceNumber: number
}

const SHOW_INTERVAL_MS = 15_000
const PHOTOS_PER_PAGE = 4

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr]
  const result: T[] = []
  const n = Math.min(count, copy.length)
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    result.push(copy.splice(idx, 1)[0]!)
  }
  return result
}

export function SlideshowPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [batch, setBatch] = useState<Photo[]>([])
  const photosRef = useRef(photos)
  photosRef.current = photos

  useEffect(() => {
    if (!eventId) return
    apiRequest<{ items: Photo[] }>(`/events/${eventId}/photos`)
      .then((res) => {
        setPhotos(res.items)
        setBatch(pickRandom(res.items, PHOTOS_PER_PAGE))
      })
      .catch(() => {})
  }, [eventId])

  useEffect(() => {
    if (photos.length === 0) return
    const id = setInterval(() => {
      setBatch(pickRandom(photosRef.current, PHOTOS_PER_PAGE))
    }, SHOW_INTERVAL_MS)
    return () => clearInterval(id)
  }, [photos.length])

  const grid = batch.slice(0, PHOTOS_PER_PAGE)
  const emptyCells = PHOTOS_PER_PAGE - grid.length

  return (
    <div className={styles.fullscreen}>
      <div className={styles.eventName}>Street Food Events</div>
      <div className={styles.grid}>
        {grid.map((p) => (
          <img key={p.id} src={p.image.url} alt="" className={styles.photo} />
        ))}
        {Array.from({ length: emptyCells }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.photo} style={{ background: '#222' }} />
        ))}
      </div>
    </div>
  )
}
