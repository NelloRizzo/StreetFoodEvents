import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import type { UploadedImage } from '../lib/upload'
import { useEventTheme } from '../features/theme/useEventTheme'
import styles from './PhotoBoothPage.module.scss'

type EventFrame = {
  id: string
  name: string
  image: UploadedImage
}

export function PhotoBoothPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [eventName, setEventName] = useState('')
  const [frames, setFrames] = useState<EventFrame[]>([])
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const themeData = eventId
    ? { themeBrand: null, themeText: null, themeSurface: null, themeHighlight: null }
    : null
  useEventTheme(themeData)

  useEffect(() => {
    if (!eventId) return

    Promise.all([
      apiRequest<{ item: { name: string } }>(`/events/${eventId}`),
      apiRequest<{ items: EventFrame[] }>(`/events/${eventId}/frames`),
    ])
      .then(([ev, fr]) => {
        setEventName(ev.item.name)
        setFrames(fr.items)
      })
      .catch(() => setError('Errore nel caricamento'))
  }, [eventId])

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
      }
      setCameraReady(true)
    } catch {
      setError('Fotocamera non disponibile')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    setCaptured(canvas.toDataURL('image/jpeg', 0.92))
  }

  const retake = () => {
    setCaptured(null)
  }

  const selectedFrame = frames.find((f) => f.id === selectedFrameId)

  const uploadPhoto = async () => {
    if (!eventId || !captured || uploading) return
    setUploading(true)
    setError(null)

    try {
      const blob = await (await fetch(captured)).blob()
      const formData = new FormData()
      formData.append('image', blob, `photo_${Date.now()}.jpg`)
      if (selectedFrameId) {
        formData.append('frameId', selectedFrameId)
      }

      const res = await fetch(`/api/events/${eventId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload fallito')

      navigate(`/events/${eventId}/galleria`)
    } catch {
      setError('Upload fallito. Riprova.')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [stream])

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all'evento</Link>
        <h1 className={styles.title}>Photo Booth</h1>
        <p className={styles.subtitle}>{eventName}</p>

        {error && <p className={styles.error}>{error}</p>}

        {/* Frame selector */}
        {frames.length > 0 && !captured && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Scegli una cornice</h2>
            <div className={styles.frameGrid}>
              <button
                className={`${styles.frameCard} ${selectedFrameId === null ? styles.frameActive : ''}`}
                onClick={() => setSelectedFrameId(null)}
              >
                <div className={styles.framePreview}>
                  <span style={{ fontSize: '2rem' }}>&#x1F4F7;</span>
                </div>
                <span className={styles.frameName}>Nessuna cornice</span>
              </button>
              {frames.map((frame) => (
                <button
                  key={frame.id}
                  className={`${styles.frameCard} ${selectedFrameId === frame.id ? styles.frameActive : ''}`}
                  onClick={() => setSelectedFrameId(frame.id)}
                >
                  <div className={styles.framePreview}>
                    <img src={frame.image.url} alt={frame.name} />
                  </div>
                  <span className={styles.frameName}>{frame.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Camera */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Scatta una foto</h2>

          {!cameraReady && !captured && (
            <button className={styles.cameraBtn} onClick={startCamera}>
              Attiva fotocamera
            </button>
          )}

          <div className={styles.cameraBox}>
            {!captured && (
              <video ref={videoRef} autoPlay playsInline className={styles.video} />
            )}

            {captured && (
              <div className={styles.previewWrap}>
                <img src={captured} alt="Preview" className={styles.preview} />
                {selectedFrame && (
                  <img src={selectedFrame.image.url} alt="" className={styles.frameOverlay} />
                )}
              </div>
            )}

            {cameraReady && !captured && (
              <button className={styles.shutterBtn} onClick={capturePhoto}>
                Scatta
              </button>
            )}

            {captured && (
              <div className={styles.actions}>
                <button className={styles.retakeBtn} onClick={retake}>
                  Ripeti
                </button>
                <button className={styles.uploadBtn} onClick={uploadPhoto} disabled={uploading}>
                  {uploading ? 'Caricamento...' : 'Salva foto'}
                </button>
              </div>
            )}
          </div>
        </section>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
