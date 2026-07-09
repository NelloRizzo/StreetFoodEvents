import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
import { useEventTheme } from '../features/theme/useEventTheme'
import styles from './PhotoBoothPage.module.scss'

type EventFrame = {
  id: string
  name: string
  image: { url: string; publicId: string; width: number; height: number }
  textPosition: { vertical: 'top' | 'center' | 'bottom'; horizontal: 'left' | 'center' | 'right' }
}

type EventDetail = {
  name: string
  startDate: string
  endDate: string
  location: { label: string; city?: string | null }
}

const OUTPUT_SIZE = 1380

function generateDefaultFrameDataUrl(size: number): string {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!

  const margin = Math.round(size * 0.065)
  const radius = Math.round(size * 0.025)

  ctx.fillStyle = '#2c2b28'
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, radius)
  ctx.fill()

  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.roundRect(margin, margin, size - margin * 2, size - margin * 2, radius)
  ctx.fill()

  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#13294b'
  ctx.font = `600 ${Math.round(size * 0.028)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Street Food Events', size / 2, Math.round(size * 0.06))

  return c.toDataURL('image/png')
}

const DEFAULT_FRAME_DATA_URL = generateDefaultFrameDataUrl(OUTPUT_SIZE)

type RecentPhoto = {
  id: string
  image: { url: string }
  sequenceNumber: number
}

export function PhotoBoothPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [eventName, setEventName] = useState('')
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null)
  const [frames, setFrames] = useState<EventFrame[]>([])
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>('__default__')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([])
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [zoomSupported, setZoomSupported] = useState(false)
  const [zoomMin, setZoomMin] = useState(1)
  const [zoomMax, setZoomMax] = useState(10)
  const [zoomStep, setZoomStep] = useState(0.5)
  const [timerOption, setTimerOption] = useState(0) // 0 | 3 | 5 | 10
  const [countingDown, setCountingDown] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const themeData = eventId
    ? { themeBrand: null, themeText: null, themeSurface: null, themeHighlight: null }
    : null
  useEventTheme(themeData)

  useEffect(() => {
    if (!eventId) return

    Promise.all([
      apiRequest<{ item: EventDetail }>(`/events/${eventId}`),
      apiRequest<{ items: EventFrame[] }>(`/frames`),
      apiRequest<{ items: RecentPhoto[] }>(`/events/${eventId}/photos`),
    ])
      .then(([ev, fr, ph]) => {
        setEventName(ev.item.name)
        setEventDetail(ev.item)
        setFrames(fr.items)
        setRecentPhotos(ph.items)
      })
      .catch(() => setError('Errore nel caricamento'))
  }, [eventId])

  const checkCapabilities = (track: MediaStreamTrack) => {
    try {
      const caps = track.getCapabilities?.() as Record<string, unknown> | undefined
      const torchCap = caps?.torch as boolean | undefined
      const zoomCap = caps?.zoom as { min?: number; max?: number; step?: number } | undefined
      setTorchSupported(!!torchCap)
      if (zoomCap) {
        setZoomSupported(true)
        setZoomMin(zoomCap.min ?? 1)
        setZoomMax(zoomCap.max ?? 10)
        setZoomStep(zoomCap.step ?? 0.5)
        setZoomLevel(zoomCap.min ?? 1)
      } else {
        setZoomSupported(false)
      }
      if (!torchCap) setTorchOn(false)
    } catch {
      setTorchSupported(false)
      setZoomSupported(false)
    }
  }

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      setStream(s)
      setTorchOn(false)
      if (videoRef.current) {
        videoRef.current.srcObject = s
      }
      const track = s.getVideoTracks()[0]
      if (track) checkCapabilities(track)
      setCameraReady(true)
      setError(null)
    } catch {
      setError('Fotocamera non disponibile')
    }
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    const size = OUTPUT_SIZE
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size, size)

    const scale = Math.max(size / vw, size / vh)
    const sw = vw * scale
    const sh = vh * scale
    ctx.drawImage(video, (size - sw) / 2, (size - sh) / 2, sw, sh)

    try {
      const isDef = selectedFrameId === '__default__'
      const selF = isDef ? null : frames.find((f) => f.id === selectedFrameId)
      const frameUrl = isDef ? DEFAULT_FRAME_DATA_URL
        : selF ? `${API_BASE_URL}/frames/${selF.id}/image`
          : null

      if (frameUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = frameUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Frame load failed'))
        })
        ctx.drawImage(img, 0, 0, size, size)
      }
    } catch {
      // frame not available — continue without
    }

    if (eventDetail) {
      const nameStr = '#' + eventDetail.name
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-Z0-9\u00C0-\u00FF]/g, ''))
        .filter(Boolean)
        .map((w) => w.toLowerCase())
        .join('')
      const start = new Date(eventDetail.startDate)
      const end = new Date(eventDetail.endDate)

      const fmtDate = (d: Date) =>
        d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
      const endFmt = end.toLocaleDateString('it-IT', {
        day: 'numeric', month: 'short', year: 'numeric',
      })

      let dateStr = ''
      if (start.toDateString() === end.toDateString()) {
        dateStr = fmtDate(start)
      } else {
        dateStr = `${fmtDate(start)} — ${endFmt}`
      }

      const locLabel = eventDetail.location.city
        ? eventDetail.location.city
        : eventDetail.location.label
      if (locLabel) {
        dateStr += `  ${locLabel}`
      }

      const padding = Math.round(size * 0.045)
      const nameFontSize = Math.round(size * 0.038)
      const dateFontSize = Math.round(size * 0.024)

      const isDef = selectedFrameId === '__default__'
      const selF = isDef ? null : frames.find((f) => f.id === selectedFrameId)
      const tPos = (isDef || !selF)
        ? { vertical: 'bottom' as const, horizontal: 'center' as const }
        : selF.textPosition

      let textX: number
      let textY: number
      let textAlign: CanvasTextAlign
      let textBaseline: CanvasTextBaseline

      switch (tPos.horizontal) {
        case 'left': textAlign = 'left'; textX = padding; break
        case 'right': textAlign = 'right'; textX = size - padding; break
        default: textAlign = 'center'; textX = size / 2
      }

      switch (tPos.vertical) {
        case 'top': textBaseline = 'top'; textY = padding; break
        case 'bottom': textBaseline = 'bottom'; textY = size - padding; break
        default: textBaseline = 'middle'; textY = size / 2
      }

      ctx.textAlign = textAlign
      ctx.textBaseline = textBaseline

      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 4

      ctx.font = `700 ${nameFontSize}px sans-serif`
      ctx.fillStyle = '#fff'
      ctx.fillText(nameStr, textX, textY)

      const offsetY = textBaseline === 'top'
        ? nameFontSize + Math.round(size * 0.012)
        : textBaseline === 'bottom'
          ? -(nameFontSize + Math.round(size * 0.012))
          : nameFontSize + Math.round(size * 0.012)

      ctx.font = `${dateFontSize}px sans-serif`
      ctx.fillStyle = '#fff'
      ctx.fillText(dateStr, textX, textY + offsetY)

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }

    setCaptured(canvas.toDataURL('image/jpeg', 0.92))
  }

  const retake = () => {
    setCaptured(null)
    setError(null)
  }

  const uploadPhoto = async () => {
    if (!eventId || !captured || uploading) return
    setUploading(true)
    setError(null)

    try {
      const resp = await fetch(captured)
      const blob = await resp.blob()

      const formData = new FormData()
      formData.append('image', blob, `photo_${Date.now()}.jpg`)
      if (selectedFrameId && selectedFrameId !== '__default__') {
        formData.append('frameId', selectedFrameId)
      }

      const res = await fetch(`${API_BASE_URL}/events/${eventId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.message ?? 'Upload fallito')
      }

      apiRequest<{ items: RecentPhoto[] }>(`/events/${eventId}/photos`)
        .then((ph) => setRecentPhotos(ph.items))
        .catch(() => {})

      setCaptured(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fallito. Riprova.')
    } finally {
      setUploading(false)
    }
  }

  const toggleFacingMode = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    setCameraReady(false)
    setFacingMode(next)
    setTorchOn(false)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      const track = s.getVideoTracks()[0]
      if (track) checkCapabilities(track)
      setCameraReady(true)
      setError(null)
    } catch {
      setError('Impossibile cambiare fotocamera')
    }
  }

  const toggleTorch = async () => {
    const track = stream?.getVideoTracks()[0]
    if (!track || !torchSupported) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as never)
      setTorchOn(!torchOn)
    } catch {
      // not supported — ignore
    }
  }

  const adjustZoom = async (delta: number) => {
    const track = stream?.getVideoTracks()[0]
    if (!track || !zoomSupported) return
    const next = Math.min(zoomMax, Math.max(zoomMin, +(zoomLevel + delta).toFixed(1)))
    try {
      await track.applyConstraints({ advanced: [{ zoom: next }] } as never)
      setZoomLevel(next)
    } catch {
      // not supported — ignore
    }
  }

  const TIMER_OPTIONS = [0, 3, 5, 10] as const

  const cycleTimer = () => {
    setTimerOption(TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(timerOption as never) + 1) % TIMER_OPTIONS.length])
  }

  const handleShutter = async () => {
    if (timerOption > 0) {
      setCountingDown(timerOption)
      for (let i = timerOption; i > 0; i--) {
        await new Promise((r) => setTimeout(r, 1000))
        setCountingDown(i - 1)
      }
    }
    await capturePhoto()
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

        {frames.length > 0 && !captured && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Scegli una cornice</h2>
            <div className={styles.frameGrid}>
              <button
                className={`${styles.frameCard} ${selectedFrameId === '__default__' ? styles.frameActive : ''}`}
                onClick={() => setSelectedFrameId('__default__')}
              >
                <div className={styles.framePreview}>
                  <img src={DEFAULT_FRAME_DATA_URL} alt="Default" />
                </div>
                <span className={styles.frameName}>Diapositiva</span>
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

        {frames.length === 0 && !captured && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Cornice predefinita</h2>
            <p className={styles.frameName}>
              Verr&agrave; utilizzata la cornice Diapositiva standard.
            </p>
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Scatta una foto</h2>

          {!cameraReady && !captured && (
            <button className={styles.cameraBtn} onClick={startCamera}>
              Attiva fotocamera
            </button>
          )}

          <div className={styles.cameraBox}>
            <div
              className={styles.videoWrap}
              style={{ display: captured || !cameraReady ? 'none' : undefined }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={styles.video}
              />
              {showGrid && (
                <div className={styles.gridOverlay}>
                  <div className={styles.gridLine} style={{ left: '33.33%', top: 0, width: 1, height: '100%' }} />
                  <div className={styles.gridLine} style={{ left: '66.67%', top: 0, width: 1, height: '100%' }} />
                  <div className={styles.gridLine} style={{ top: '33.33%', left: 0, height: 1, width: '100%' }} />
                  <div className={styles.gridLine} style={{ top: '66.67%', left: 0, height: 1, width: '100%' }} />
                </div>
              )}
              {countingDown > 0 && (
                <div className={styles.countdown}>{countingDown}</div>
              )}
            </div>

            {captured && (
              <div className={styles.previewWrap}>
                <img src={captured} alt="Preview" className={styles.preview} />
              </div>
            )}

            {cameraReady && !captured && (
              <div className={styles.toolbar}>
                <button className={styles.toolBtn} onClick={toggleFacingMode} title={facingMode === 'environment' ? 'Anteriore' : 'Posteriore'}>
                  <span className={styles.toolIcon}>⟳</span>
                  <span className={styles.toolLabel}>{facingMode === 'environment' ? 'Posteriore' : 'Anteriore'}</span>
                </button>
                <button className={`${styles.toolBtn} ${torchOn ? styles.toolActive : ''}`} onClick={toggleTorch} disabled={!torchSupported} title="Torcia">
                  <span className={styles.toolIcon}>💡</span>
                  <span className={styles.toolLabel}>Torcia</span>
                </button>
                <div className={styles.zoomControl}>
                  <button className={styles.zoomBtn} onClick={() => adjustZoom(-zoomStep)} disabled={!zoomSupported || zoomLevel <= zoomMin}>−</button>
                  <span className={styles.zoomValue}>{zoomSupported ? `${zoomLevel}x` : '–'}</span>
                  <button className={styles.zoomBtn} onClick={() => adjustZoom(zoomStep)} disabled={!zoomSupported || zoomLevel >= zoomMax}>+</button>
                </div>
                <button className={`${styles.toolBtn} ${timerOption > 0 ? styles.toolActive : ''}`} onClick={cycleTimer} title="Timer">
                  <span className={styles.toolIcon}>⏱</span>
                  <span className={styles.toolLabel}>{timerOption > 0 ? `${timerOption}s` : 'Diretto'}</span>
                </button>
                <button className={`${styles.toolBtn} ${showGrid ? styles.toolActive : ''}`} onClick={() => setShowGrid(!showGrid)} title="Griglia">
                  <span className={styles.toolIcon}>⊞</span>
                  <span className={styles.toolLabel}>Griglia</span>
                </button>
              </div>
            )}

            {cameraReady && !captured && (
              <button className={styles.shutterBtn} onClick={handleShutter}>
                {timerOption > 0 ? `Scatta (${timerOption}s)` : 'Scatta'}
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

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Galleria</h2>
          {recentPhotos.length > 0 ? (
            <div className={styles.recentStrip}>
              {recentPhotos.map((p) => (
                <div key={p.id} className={styles.recentCard}>
                  <img src={p.image.url} alt={`Foto #${p.sequenceNumber}`} className={styles.recentImg} />
                  <span className={styles.recentSeq}>#{p.sequenceNumber}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyGallery}>Nessuna foto ancora. Scatta la prima!</p>
          )}
          <Link to={`/events/${eventId}/galleria`} className={styles.galleryLink}>
            Vai alla galleria completa &rarr;
          </Link>
        </section>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
