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
      apiRequest<{ items: EventFrame[] }>(`/events/${eventId}/frames`),
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
      setError(null)
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
    setError(null)
  }

  const selectedFrame = frames.find((f) => f.id === selectedFrameId)
  const isDefaultFrame = selectedFrameId === '__default__'

  const frameUrlForPreview = isDefaultFrame ? DEFAULT_FRAME_DATA_URL : selectedFrame?.image.url

  const uploadPhoto = async () => {
    if (!eventId || !captured || uploading) return
    console.log('[PhotoBooth] uploadPhoto start', { capturedLen: captured.length, selectedFrameId })
    setUploading(true)
    setError(null)

    const compositeWithFrame = async (useFrame: boolean) => {
      console.log('[PhotoBooth] compositeWithFrame', { useFrame })
      const srcImg = new Image()
      srcImg.src = captured
      await new Promise<void>((resolve, reject) => {
        srcImg.onload = () => { console.log('[PhotoBooth] source image loaded'); resolve() }
        srcImg.onerror = () => { console.error('[PhotoBooth] source image load failed'); reject(new Error('Source image load failed')) }
      })

      let frameImg: HTMLImageElement | null = null
      if (useFrame) {
        const isDef = selectedFrameId === '__default__'
        const selF = frames.find((f) => f.id === selectedFrameId)
        const frameUrl = isDef ? DEFAULT_FRAME_DATA_URL : selF?.image.url
        console.log('[PhotoBooth] frame URL', frameUrl?.slice(0, 80))
        if (frameUrl) {
          try {
            const resp = await fetch(frameUrl)
            const frameBlob = await resp.blob()
            console.log('[PhotoBooth] frame fetched', { blobSize: frameBlob.size, blobType: frameBlob.type })
            const url = URL.createObjectURL(frameBlob)
            frameImg = new Image()
            await new Promise<void>((resolve, reject) => {
              frameImg!.onload = () => { console.log('[PhotoBooth] frame image loaded'); resolve() }
              frameImg!.onerror = () => { console.error('[PhotoBooth] frame image load failed'); reject(new Error('Frame load failed')) }
              frameImg!.src = url
            })
          } catch (e) {
            console.warn('[PhotoBooth] frame fetch/load failed, skipping', e)
            frameImg = null
          }
        }
      }

      const outCanvas = document.createElement('canvas')
      outCanvas.width = OUTPUT_SIZE
      outCanvas.height = OUTPUT_SIZE
      const ctx = outCanvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      ctx.drawImage(srcImg, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      if (frameImg) {
        ctx.drawImage(frameImg, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      }

      if (eventDetail) {
        const nameStr = `#${eventDetail.name}`
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

        const nameFontSize = Math.round(OUTPUT_SIZE * 0.038)
        const dateFontSize = Math.round(OUTPUT_SIZE * 0.024)
        const textY = Math.round(OUTPUT_SIZE * 0.045)

        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        ctx.font = `700 ${nameFontSize}px sans-serif`
        ctx.fillStyle = '#333'
        ctx.fillText(nameStr, OUTPUT_SIZE / 2, textY)

        ctx.font = `${dateFontSize}px sans-serif`
        ctx.fillStyle = '#666'
        ctx.fillText(dateStr, OUTPUT_SIZE / 2, textY + nameFontSize + Math.round(OUTPUT_SIZE * 0.012))
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        outCanvas.toBlob((b) => { console.log('[PhotoBooth] toBlob result', !!b); resolve(b) }, 'image/jpeg', 0.9)
      })
      return blob
    }

    try {
      console.log('[PhotoBooth] compositing with frame...')
      let blob = await compositeWithFrame(true)
      if (!blob) {
        console.warn('[PhotoBooth] first composite failed, retrying without frame')
        blob = await compositeWithFrame(false)
      }
      if (!blob) throw new Error('Canvas to blob failed')
      console.log('[PhotoBooth] blob created', { size: blob.size, type: blob.type })

      const formData = new FormData()
      formData.append('image', blob, `photo_${Date.now()}.jpg`)
      if (selectedFrameId && selectedFrameId !== '__default__') {
        formData.append('frameId', selectedFrameId)
      }

      console.log('[PhotoBooth] sending POST...')
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      console.log('[PhotoBooth] POST response', { status: res.status, ok: res.ok })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        console.error('[PhotoBooth] upload error response', errData)
        throw new Error(errData?.message ?? 'Upload fallito')
      }

      console.log('[PhotoBooth] upload success, refreshing recent photos')
      apiRequest<{ items: RecentPhoto[] }>(`/events/${eventId}/photos`)
        .then((ph) => { console.log('[PhotoBooth] recent photos refreshed', ph.items.length); setRecentPhotos(ph.items) })
        .catch(() => {})

      setCaptured(null)
    } catch (err) {
      console.error('[PhotoBooth] upload error', err)
      setError(err instanceof Error ? err.message : 'Upload fallito. Riprova.')
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

        {frames.length > 0 && !captured && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Scegli una cornice</h2>
            <div className={styles.frameGrid}>
              <button
                className={`${styles.frameCard} ${isDefaultFrame ? styles.frameActive : ''}`}
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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={styles.video}
              style={{ display: captured ? 'none' : undefined }}
            />

            {captured && (
              <div className={styles.previewWrap}>
                <img src={captured} alt="Preview" className={styles.preview} />
                {frameUrlForPreview && (
                  <img src={frameUrlForPreview} alt="" className={styles.frameOverlay} />
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
