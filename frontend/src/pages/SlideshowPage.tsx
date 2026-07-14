import { useCallback, useEffect, useRef, useState } from 'react'
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

type ConnStatus = 'online' | 'waking' | 'offline'

const POLL_MS = 2 * 60_000
const FETCH_TIMEOUT_MS = 30_000
const WAKING_THRESHOLD_MS = 5_000
const PHOTOS_PER_PAGE = 8
const ROTATE_OPTIONS = [5, 10, 15, 20, 30] as const

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
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [rotateSec, setRotateSec] = useState<number>(10)
  const [connStatus, setConnStatus] = useState<ConnStatus>('online')
  const allRef = useRef<Photo[]>([])
  const refreshRef = useRef<() => void>(() => {})

  const closeModal = useCallback(() => setSelectedPhoto(null), [])

  useEffect(() => {
    if (!selectedPhoto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [selectedPhoto, closeModal])

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    const API_URL = import.meta.env.VITE_API_URL ?? '/api'
    const HEALTH_URL = API_URL.replace(/\/api\/?$/, '') + '/health'

    const checkConnection = () => {
      const start = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => {
        if (!cancelled) setConnStatus('offline')
        controller.abort()
      }, FETCH_TIMEOUT_MS)

      fetch(`${HEALTH_URL}?_t=${start}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then((r) => {
          if (!r.ok) throw new Error('not ok')
          return r.json()
        })
        .then((data) => {
          if (cancelled) return
          const elapsed = Date.now() - start
          if (data?.status === 'ok') {
            setConnStatus(elapsed > WAKING_THRESHOLD_MS ? 'waking' : 'online')
          } else {
            setConnStatus('offline')
          }
        })
        .catch(() => {
          if (!cancelled) setConnStatus('offline')
        })
        .finally(() => clearTimeout(timer))
    }

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

    checkConnection()
    fetchPhotos()

    const healthId = setInterval(checkConnection, POLL_MS)
    const pollId = setInterval(fetchPhotos, POLL_MS)

    apiRequest<{ item: EventData }>(`/events/${eventId}`)
      .then((res) => { if (!cancelled) setEventData(res.item) })
      .catch(() => {})

    refreshRef.current = fetchPhotos

    return () => {
      cancelled = true
      clearInterval(healthId)
      clearInterval(pollId)
    }
  }, [eventId])

  useEffect(() => {
    if (rotateSec <= 0) return
    const rotateId = setInterval(() => {
      const items = allRef.current
      if (items.length > 0) {
        setBatch(shuffle(items).slice(0, PHOTOS_PER_PAGE))
      }
    }, rotateSec * 1000)
    return () => clearInterval(rotateId)
  }, [rotateSec])

  const hasPhotos = batch.length > 0

  return (
    <div className={styles.fullscreen}>
      {eventData?.coverImage?.url && (
        <img src={eventData.coverImage.url} alt="" className={styles.coverBg} />
      )}

      <div className={styles.header}>
        {eventData?.logo?.url && (
          <img src={eventData.logo.url} alt="" className={styles.logo} />
        )}
        <span className={styles.eventName}>
          {eventData?.name ?? 'Street Food Events'}
        </span>
        <span className={`${styles.statusDot} ${connStatus === 'online' ? styles.statusOnline : connStatus === 'waking' ? styles.statusWaking : styles.statusOffline}`} title={connStatus === 'online' ? 'Connesso' : connStatus === 'waking' ? 'Risveglio in corso...' : 'Disconnesso'} />
        <button className={styles.refreshBtn} onClick={() => refreshRef.current()} title="Aggiorna">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
        <div className={styles.speedControl}>
          {ROTATE_OPTIONS.map((s) => (
            <button
              key={s}
              className={`${styles.speedBtn} ${rotateSec === s ? styles.speedActive : ''}`}
              onClick={() => setRotateSec(s)}
            >
              {s}s
            </button>
          ))}
        </div>
      </div>

      {hasPhotos ? (
        <div className={styles.grid}>
          {batch.map((p) => (
            <div key={p.id} className={styles.photoWrapper} onClick={() => setSelectedPhoto(p)}>
              <img src={p.image.url} alt="" className={styles.photo} />
              <span className={styles.badge}>{p.sequenceNumber}</span>
            </div>
          ))}
          {Array.from({ length: PHOTOS_PER_PAGE - batch.length }).map((_, i) => (
            <div key={`empty-${i}`} className={styles.photo} style={{ background: 'transparent' }} />
          ))}
        </div>
      ) : (
        eventData?.coverImage?.url && (
          <img src={eventData.coverImage.url} alt="" className={styles.coverFull} />
        )
      )}

      <div className={styles.footer}>
        Se vedi una tua foto segna il suo numero e recati al Welcome Point per ottenerla
      </div>

      {selectedPhoto && (
        <div className={styles.overlay} onClick={closeModal}>
          <img src={selectedPhoto.image.url} alt="" className={styles.modalPhoto} />
        </div>
      )}
    </div>
  )
}
