import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

import styles from './QRScanner.module.scss'

type Camera = { id: string; label: string }

type Props = {
  onScan: (result: string) => void
  onClose: () => void
}

export function QRScanner({ onScan, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const startedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(true)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)

  const stopScanner = useCallback(() => {
    const s = scannerRef.current
    if (s) {
      try { s.stop().catch(() => {}) } catch {}
    }
  }, [])

  const startWithCamera = useCallback((cameraId?: string) => {
    const el = containerRef.current
    if (!el) return

    el.innerHTML = ''
    const id = 'qr-scanner-' + Math.random().toString(36).slice(2)
    el.id = id

    const scanner = new Html5Qrcode(id)
    scannerRef.current = scanner

    const config = cameraId
      ? { deviceId: { exact: cameraId } }
      : { facingMode: 'environment' }

    scanner
      .start(
        config,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {})
          setScanning(false)
          onScan(decodedText)
        },
        () => {},
      )
      .catch((err) => {
        setError(err?.toString() ?? 'Errore fotocamera')
      })
  }, [onScan])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const el = containerRef.current
    if (!el) return

    startWithCamera()

    Html5Qrcode.getCameras()
      .then((devices) => {
        const cams = devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 8)}` }))
        setCameras(cams)
        if (cams.length > 0) {
          const preferred = cams.find((c) => /back|environment|trz|posteriore/i.test(c.label)) ?? cams[0]
          setSelectedCamera(preferred.id)
        }
      })
      .catch(() => {})

    return () => {
      stopScanner()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const switchCamera = (cameraId: string) => {
    setSelectedCamera(cameraId)
    setError(null)
    setScanning(true)
    stopScanner()
    startWithCamera(cameraId)
  }

  const handleClose = () => {
    stopScanner()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="Chiudi">
          &times;
        </button>

        <h2 className={styles.title}>Inquadra il QR Code</h2>
        <p className={styles.hint}>Posiziona il QR code dell&apos;utente all&apos;interno del riquadro</p>

        {cameras.length > 1 && (
          <div className={styles.camRow}>
            <label className={styles.camLabel}>Fotocamera:</label>
            <select
              className={styles.camSelect}
              value={selectedCamera ?? ''}
              onChange={(e) => switchCamera(e.target.value)}
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.viewport}>
          <div ref={containerRef} className={styles.reader} />

          {!scanning && !error && (
            <div className={styles.overlayMsg}>Codice rilevato!</div>
          )}

          {error && (
            <div className={styles.overlayMsg}>
              <span className={styles.errorIcon}>&#9888;</span>
              {error}
            </div>
          )}
        </div>

        <button className={styles.cancelBtn} onClick={handleClose}>
          Annulla
        </button>
      </div>
    </div>
  )
}
