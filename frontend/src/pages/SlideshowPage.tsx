import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
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
  logo?: { url: string; publicId: string } | null
  coverImage?: { url: string; publicId: string } | null
  slideshowTitle?: string | null
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

export function SlideshowPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [batch, setBatch] = useState<Photo[]>([])
  const [eventData, setEventData] = useState<EventData | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [rotateSec, setRotateSec] = useState<number>(10)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [announceImageUrl, setAnnounceImageUrl] = useState<string | null>(null)
  const [announceText, setAnnounceText] = useState('')
  const [announceVisible, setAnnounceVisible] = useState(true)
  const [announceColor, setAnnounceColor] = useState('#000000')
  const [announceTextColor, setAnnounceTextColor] = useState('#ffffff')
  const titleRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const announceUrlRef = useRef<string | null>(null)
  const allRef = useRef<Photo[]>([])
  const refreshRef = useRef<() => void>(() => {})

  const closeModal = useCallback(() => setSelectedPhoto(null), [])

  useEffect(() => {
    return () => {
      if (announceUrlRef.current) URL.revokeObjectURL(announceUrlRef.current)
    }
  }, [])

  const handleAnnounceImage = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    if (announceUrlRef.current) URL.revokeObjectURL(announceUrlRef.current)
    announceUrlRef.current = url
    setAnnounceImageUrl(url)
    setAnnounceVisible(true)
  }

  const removeAnnounceImage = () => {
    if (announceUrlRef.current) {
      URL.revokeObjectURL(announceUrlRef.current)
      announceUrlRef.current = null
    }
    setAnnounceImageUrl(null)
  }

  const clearAnnounce = () => {
    removeAnnounceImage()
    setAnnounceText('')
    setAnnounceVisible(false)
  }

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
    if (!selectedPhoto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [selectedPhoto, closeModal])

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [editingTitle])

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

  const hasPhotos = batch.length > 0

  return (
    <div className={styles.fullscreen}>
      <div className={styles.header}>
        {eventData?.logo?.url && (
          <img src={eventData.logo.url} alt="" className={styles.logo} />
        )}
        <div className={styles.titleGroup}>
          <span className={styles.eventName}>
            {eventData?.name ?? 'Street Food Events'}
          </span>
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
        <button
          className={`${styles.panelToggleBtn} ${panelOpen ? styles.panelToggleActive : ''}`}
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? 'Nascondi pannello' : 'Annuncio personalizzato'}
        >
          {panelOpen ? 'Chiudi' : 'Annuncio'}
        </button>
      </div>

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

      {announceVisible && (announceImageUrl || announceText.trim()) && (
        <div
          className={styles.announceCard}
          style={{
            background: announceColor,
            color: announceTextColor,
          }}
        >
          {announceImageUrl && (
            <img src={announceImageUrl} alt="" className={styles.announceImage} />
          )}
          {announceText.trim() && (
            <p className={styles.announceText}>{announceText}</p>
          )}
        </div>
      )}

      {panelOpen && (
        <div className={styles.panelBackdrop} onClick={() => setPanelOpen(false)} />
      )}
      <aside className={`${styles.panel} ${panelOpen ? styles.panelOpen : ''}`}>
        {panelOpen && (
          <div className={styles.panelBody}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Annuncio personalizzato</span>
              <button className={styles.panelCloseBtn} onClick={() => setPanelOpen(false)}>
                &times;
              </button>
            </div>

            <label className={styles.panelLabel}>Immagine</label>
            {announceImageUrl ? (
              <div className={styles.panelThumbWrap}>
                <img src={announceImageUrl} alt="Anteprima annuncio" className={styles.panelThumb} />
              </div>
            ) : (
              <button
                type="button"
                className={styles.panelDrop}
                onClick={() => imageInputRef.current?.click()}
              >
                Scegli un&apos;immagine
              </button>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleAnnounceImage(file)
                e.target.value = ''
              }}
            />
            {announceImageUrl && (
              <div className={styles.panelRowActions}>
                <button
                  type="button"
                  className={styles.panelSmallBtn}
                  onClick={() => imageInputRef.current?.click()}
                >
                  Cambia
                </button>
                <button
                  type="button"
                  className={`${styles.panelSmallBtn} ${styles.panelSmallBtnDanger}`}
                  onClick={removeAnnounceImage}
                >
                  Rimuovi immagine
                </button>
              </div>
            )}

            <label className={styles.panelLabel} htmlFor="announceText">Testo</label>
            <textarea
              id="announceText"
              className={styles.panelTextarea}
              rows={4}
              maxLength={300}
              value={announceText}
              onChange={(e) => setAnnounceText(e.target.value)}
              placeholder="Scrivi il testo dell'annuncio..."
            />

            <div className={styles.panelColorRow}>
              <label className={styles.panelLabel} htmlFor="announceColor" style={{ marginTop: 0 }}>
                Colore sfondo
              </label>
              <input
                id="announceColor"
                type="color"
                className={styles.panelColorInput}
                value={announceColor}
                onChange={(e) => setAnnounceColor(e.target.value)}
              />
            </div>
            <div className={styles.panelColorRow}>
              <label className={styles.panelLabel} htmlFor="announceTextColor" style={{ marginTop: 0 }}>
                Colore testo
              </label>
              <input
                id="announceTextColor"
                type="color"
                className={styles.panelColorInput}
                value={announceTextColor}
                onChange={(e) => setAnnounceTextColor(e.target.value)}
              />
            </div>

            <label className={styles.panelToggle}>
              <input
                type="checkbox"
                checked={announceVisible}
                onChange={(e) => setAnnounceVisible(e.target.checked)}
              />
              <span>Mostra sul display</span>
            </label>

            <div className={styles.panelActions}>
              <button
                type="button"
                className={styles.panelBtn}
                onClick={() => setPanelOpen(false)}
              >
                Chiudi
              </button>
              <button
                type="button"
                className={`${styles.panelBtn} ${styles.panelBtnDanger}`}
                onClick={clearAnnounce}
                disabled={!announceImageUrl && !announceText}
              >
                Pulisci
              </button>
            </div>
          </div>
        )}
      </aside>

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
