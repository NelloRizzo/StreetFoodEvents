import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '../lib/api'
import styles from './PhotoBoothModal.module.scss'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

const CAMERA_STORAGE_KEY = 'streeteatsPhotoBoothCamera'
const OUTPUT_SIZE = 1380

type EventFrame = {
  id: string
  name: string
  image: { url: string; publicId: string; width: number; height: number }
  textColor?: string
  textPosition: { vertical: 'top' | 'center' | 'bottom'; horizontal: 'left' | 'center' | 'right' }
}

type EventDetail = {
  name: string
  startDate: string
  endDate: string
  location: { label: string; city?: string | null }
  defaultFrameId?: string | null
}

type Props = {
  open: boolean
  eventId: string
  onClose: () => void
}

export function PhotoBoothModal({ open, eventId, onClose }: Props) {
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null)
  const [frame, setFrame] = useState<EventFrame | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [waitingChoice, setWaitingChoice] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCaptured(null)
  }, [])

  const loadEvent = useCallback(async () => {
    try {
      const [ev, fr] = await Promise.all([
        apiRequest<{ item: EventDetail }>(`/events/${eventId}`),
        apiRequest<{ items: EventFrame[] }>(`/frames`),
      ])
      setEventDetail(ev.item)
      const defaultFrame = ev.item.defaultFrameId
        ? fr.items.find((f) => f.id === ev.item.defaultFrameId) ?? null
        : null
      setFrame(defaultFrame)
    } catch {
      setError('Errore nel caricamento')
    }
  }, [eventId])

  const startWithDevice = useCallback(async (deviceId?: string) => {
    setError(null)
    try {
      const video = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: 'environment' as const, width: { ideal: 1920 }, height: { ideal: 1080 } }
      const s = await navigator.mediaDevices.getUserMedia({ video, audio: false })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
      }
      const track = s.getVideoTracks()[0]
      const activeId = track?.getSettings?.().deviceId
      if (activeId) {
        try { localStorage.setItem(CAMERA_STORAGE_KEY, activeId) } catch { /* ignore */ }
      }
      setWaitingChoice(false)
    } catch {
      setError('Fotocamera non disponibile')
    }
  }, [])

  const initCamera = useCallback(async () => {
    let all: MediaDeviceInfo[] = []
    try {
      all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
    } catch { /* ignore */ }
    setDevices(all)

    let savedId: string | null = null
    try { savedId = localStorage.getItem(CAMERA_STORAGE_KEY) } catch { /* ignore */ }

    const stillExists = savedId && all.some((d) => d.deviceId === savedId)
    if (stillExists) {
      await startWithDevice(savedId ?? undefined)
    } else if (all.length <= 1) {
      await startWithDevice()
    } else {
      setWaitingChoice(true)
    }
  }, [startWithDevice])

  useEffect(() => {
    if (!open) return
    setSaved(false)
    setError(null)
    setWaitingChoice(false)
    stopStream()
    loadEvent()
    initCamera()
    return stopStream
  }, [open, eventId, initCamera, loadEvent, stopStream])

  const switchTo = async (deviceId: string) => {
    stopStream()
    await startWithDevice(deviceId)
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const vw = video.videoWidth
    const vh = video.videoHeight

    let outW = OUTPUT_SIZE
    let outH = OUTPUT_SIZE

    if (frame?.image?.width && frame?.image?.height) {
      const ratio = frame.image.width / frame.image.height
      if (ratio >= 1) outH = Math.round(OUTPUT_SIZE / ratio)
      else outW = Math.round(OUTPUT_SIZE * ratio)
    } else if (vw && vh) {
      const ratio = vw / vh
      if (ratio >= 1) outH = Math.round(OUTPUT_SIZE / ratio)
      else outW = Math.round(OUTPUT_SIZE * ratio)
    }

    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, outW, outH)

    const scale = Math.max(outW / vw, outH / vh)
    const sw = vw * scale
    const sh = vh * scale
    ctx.drawImage(video, (outW - sw) / 2, (outH - sh) / 2, sw, sh)

    if (frame?.image?.url) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = frame.image.url
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Frame load failed'))
        })
        ctx.drawImage(img, 0, 0, outW, outH)
      } catch { /* continue without frame */ }
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

      const fmtDate = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
      const endFmt = end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })

      let dateStr = ''
      if (start.toDateString() === end.toDateString()) {
        dateStr = fmtDate(start)
      } else {
        dateStr = `${fmtDate(start)} — ${endFmt}`
      }

      const locLabel = eventDetail.location.city ? eventDetail.location.city : eventDetail.location.label
      if (locLabel) dateStr += `  ${locLabel}`

      const minDim = Math.min(outW, outH)
      const padding = Math.round(minDim * 0.045)
      const nameFontSize = Math.round(minDim * 0.038)
      const dateFontSize = Math.round(minDim * 0.024)
      const tPos = frame?.textPosition ?? { vertical: 'bottom' as const, horizontal: 'center' as const }

      let textX: number
      let textY: number
      let textAlign: CanvasTextAlign
      let textBaseline: CanvasTextBaseline

      switch (tPos.horizontal) {
        case 'left': textAlign = 'left'; textX = padding; break
        case 'right': textAlign = 'right'; textX = outW - padding; break
        default: textAlign = 'center'; textX = outW / 2
      }
      switch (tPos.vertical) {
        case 'top': textBaseline = 'top'; textY = padding; break
        case 'bottom': textBaseline = 'bottom'; textY = outH - padding; break
        default: textBaseline = 'middle'; textY = outH / 2
      }

      ctx.textAlign = textAlign
      ctx.textBaseline = textBaseline
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 4
      const textColor = frame?.textColor || '#ffffff'

      ctx.font = `700 ${nameFontSize}px sans-serif`
      ctx.fillStyle = textColor
      ctx.fillText(nameStr, textX, textY)

      const offsetY = textBaseline === 'top'
        ? nameFontSize + Math.round(minDim * 0.012)
        : textBaseline === 'bottom'
          ? -(nameFontSize + Math.round(minDim * 0.012))
          : nameFontSize + Math.round(minDim * 0.012)
      ctx.font = `${dateFontSize}px sans-serif`
      ctx.fillStyle = textColor
      ctx.fillText(dateStr, textX, textY + offsetY)

      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }

    setCaptured(canvas.toDataURL('image/jpeg', 0.92))
  }

  const uploadPhoto = async () => {
    if (!captured || uploading) return
    setUploading(true)
    setError(null)
    try {
      const resp = await fetch(captured)
      const blob = await resp.blob()
      const formData = new FormData()
      formData.append('image', blob, `photo_${Date.now()}.jpg`)
      if (frame) formData.append('frameId', frame.id)

      const res = await fetch(`${API_BASE_URL}/events/${eventId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.message ?? 'Upload fallito')
      }
      setSaved(true)
      setCaptured(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fallito. Riprova.')
    } finally {
      setUploading(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Photo Booth</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Chiudi">&times;</button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {saved ? (
          <div className={styles.actions}>
            <button className={styles.save} onClick={onClose}>Chiudi</button>
          </div>
        ) : waitingChoice ? (
          <div className={styles.devicePicker}>
            <span className={styles.deviceLabel}>Scegli la fotocamera:</span>
            <select
              className={styles.deviceSelect}
              value=""
              onChange={(e) => switchTo(e.target.value)}
            >
              <option value="" disabled>Seleziona fotocamera</option>
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Fotocamera ${i + 1}`}
                </option>
              ))}
            </select>
            <button className={styles.startBtn} onClick={() => startWithDevice()}>
              Usa quella predefinita
            </button>
          </div>
        ) : !captured ? (
          <>
            {devices.length > 1 && (
              <div className={styles.switchRow}>
                <select
                  className={styles.switchBtn}
                  value=""
                  onChange={(e) => e.target.value && switchTo(e.target.value)}
                  title="Cambia fotocamera"
                >
                  <option value="" disabled>Cambia fotocamera</option>
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Fotocamera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.videoBox}>
              <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
              {frame && (
                <img src={frame.image.url} alt={frame.name} className={styles.frameOverlay} crossOrigin="anonymous" />
              )}
            </div>
            <div className={styles.shutterRow}>
              <button className={styles.shutter} onClick={capturePhoto} aria-label="Scatta" />
            </div>
          </>
        ) : (
          <>
            <div className={styles.previewBox}>
              <img src={captured} alt="Anteprima" className={styles.preview} />
            </div>
            <div className={styles.actions}>
              <button className={styles.retake} onClick={() => setCaptured(null)}>Ripeti</button>
              <button className={styles.save} onClick={uploadPhoto} disabled={uploading}>
                {uploading ? 'Salvataggio...' : 'Salva foto'}
              </button>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
