import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useKeepAlive } from '../hooks/useKeepAlive'
import styles from './SlideshowPage.module.scss'

type Photo = {
  id: string
  type: 'image' | 'video'
  image: { url: string } | null
  video: { url: string } | null
  sequenceNumber: number
}

type EventData = {
  name: string
  coverImage?: { url: string; publicId: string } | null
  slideshowTitle?: string | null
}

type Advertisement = {
  id: string
  name: string | null
  image: { url: string }
  weight: number
}

const POLL_MS = 2 * 60_000
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

function weightedPickIndex(ads: Advertisement[], currentIndex?: number): number {
  if (ads.length <= 1) return 0
  const entries = ads.map((a, i) => ({ a, i }))
  const pool = entries.filter(({ i }) => i !== currentIndex)
  const candidates = pool.length > 0 ? pool : entries
  const total = candidates.reduce((sum, { a }) => sum + a.weight, 0)
  let r = Math.random() * total
  for (const { a, i } of candidates) {
    r -= a.weight
    if (r <= 0) return i
  }
  return candidates[candidates.length - 1]!.i
}

export function SlideshowPage() {
  const { eventId } = useParams<{ eventId: string }>()
  useKeepAlive()

  const [batch, setBatch] = useState<Photo[]>([])
  const [eventData, setEventData] = useState<EventData | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [rotateSec, setRotateSec] = useState<number>(10)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [ads, setAds] = useState<Advertisement[]>([])
  const [adOpen, setAdOpen] = useState(false)
  const [adIndex, setAdIndex] = useState(0)
  const titleRef = useRef<HTMLInputElement>(null)
  const allRef = useRef<Photo[]>([])
  const refreshRef = useRef<() => void>(() => {})

  const closeModal = useCallback(() => setSelectedPhoto(null), [])

  async function saveTitle(value: string) {
    if (!eventId) return
    setEditingTitle(false)
    const trimmed = value.trim()
    if (trimmed === (eventData?.slideshowTitle ?? '')) return
    setEventData((prev) => prev ? { ...prev, slideshowTitle: trimmed || null } : prev)
    try {
      await apiRequest(`/events/${eventId}`, { method: 'PATCH', bodyJson: { slideshowTitle: trimmed || null } })
    } catch { /* ignore */ }
  }

  function startEditing() {
    setTitleDraft(eventData?.slideshowTitle ?? '')
    setEditingTitle(true)
  }

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [editingTitle])

  useEffect(() => {
    if (!selectedPhoto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [selectedPhoto, closeModal])

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

    apiRequest<{ item: EventData }>(`/events/${eventId}`)
      .then((res) => { if (!cancelled) setEventData(res.item) })
      .catch(() => {})

    refreshRef.current = fetchPhotos

    return () => {
      cancelled = true
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

  useEffect(() => {
    let cancelled = false
    apiRequest<{ items: Advertisement[] }>('/advertisements')
      .then((res) => { if (!cancelled) setAds(res.items) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!adOpen || ads.length === 0 || rotateSec <= 0) return
    const rotateId = setInterval(() => {
      setAdIndex(weightedPickIndex(ads, adIndex))
    }, rotateSec * 1000)
    return () => clearInterval(rotateId)
  }, [adOpen, ads, adIndex, rotateSec])

  useEffect(() => {
    if (!adOpen || ads.length === 0) return
    const current = ads[adIndex % ads.length]
    if (current) {
      apiRequest(`/advertisements/${current.id}/appearance`, { method: 'POST' }).catch(() => {})
    }
  }, [adOpen, adIndex, ads])

  const hasPhotos = batch.length > 0
  const currentAd = ads.length > 0 ? ads[adIndex % ads.length]! : null

  return (
    <div className={styles.fullscreen}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          {editingTitle ? (
            <input
              ref={titleRef}
              className={styles.titleInput}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={(e) => saveTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
                if (e.key === 'Escape') { setEditingTitle(false) }
              }}
              placeholder="Titolo slideshow..."
            />
          ) : (
            <span className={styles.slideshowTitle} onClick={startEditing}>
              {eventData?.slideshowTitle || 'Clicca per aggiungere un titolo...'}
            </span>
          )}
          <span className={styles.eventName}>
            {eventData?.name ?? 'Street Food Events'}
          </span>
        </div>
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

      <div className={styles.body}>
        <div className={styles.stage}>
          {hasPhotos ? (
            <div className={styles.grid} style={eventData?.coverImage?.url ? { '--cover': `url(${eventData.coverImage.url})` } as React.CSSProperties : undefined}>
              {batch.map((p) => (
                <div key={p.id} className={styles.photoWrapper} onClick={() => setSelectedPhoto(p)}>
                  {p.type === 'video' && p.video ? (
                    <video
                      src={p.video.url}
                      className={styles.photo}
                      muted
                      loop
                      autoPlay
                      playsInline
                      preload="metadata"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : p.image ? (
                    <img src={p.image.url} alt="" className={styles.photo} />
                  ) : null}
                  <span className={styles.badge}>{p.sequenceNumber}</span>
                </div>
              ))}
              {Array.from({ length: PHOTOS_PER_PAGE - batch.length }).map((_, i) => (
                <div key={`empty-${i}`} className={styles.photo} style={{ background: 'transparent' }} />
              ))}
            </div>
          ) : eventData?.coverImage?.url ? (
            <img src={eventData.coverImage.url} alt="" className={styles.coverFull} />
          ) : null}
        </div>

        {ads.length > 0 && (
          <aside className={`${styles.adPanel} ${adOpen ? styles.adPanelOpen : styles.adPanelClosed}`}>
            {adOpen ? (
              <>
                <button className={styles.adPanelClose} onClick={() => setAdOpen(false)} title="Chiudi">×</button>
                {currentAd ? (
                  <img key={currentAd.id} src={currentAd.image.url} alt={currentAd.name ?? ''} className={styles.adPanelImage} />
                ) : (
                  <span className={styles.adPanelEmpty}>Nessun advertisement</span>
                )}
              </>
            ) : (
              <button className={styles.adPanelTab} onClick={() => setAdOpen(true)}>Advertisement</button>
            )}
          </aside>
        )}
      </div>

      <div className={styles.footer}>
        Se vedi una tua foto segna il suo numero e recati al Welcome Point per ottenerla
      </div>

      {selectedPhoto && (
        <div className={styles.overlay} onClick={closeModal}>
          {selectedPhoto.type === 'video' && selectedPhoto.video ? (
            <video
              src={selectedPhoto.video.url}
              className={styles.modalPhoto}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img src={selectedPhoto.image?.url ?? ''} alt="" className={styles.modalPhoto} />
          )}
        </div>
      )}
    </div>
  )
}
