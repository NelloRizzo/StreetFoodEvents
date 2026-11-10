import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { apiRequest } from '../lib/api'
import styles from './QRCodeDownload.module.scss'

type Props = {
  apiPath: string
  /** Nome file esplicito (ha la precedenza). Mantenuto per backward compat. */
  fileName?: string
  /** Cosa indica il QR (es. 'menu', 'contests', 'recensioni-evento'). */
  purpose?: string
  /** Nome dell'evento associato (per distinguere i file scaricati). */
  eventName?: string
  label?: string
}

/** Compone un nome file sicuro da `purpose` + `eventName`. */
function composeFileName(purpose?: string, eventName?: string): string {
  const parts = [purpose, eventName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .map((p) => p.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-'))
    .filter(Boolean)
  return parts.length > 0 ? parts.join('-') : 'qr-code'
}

export function QRCodeDownload({ apiPath, fileName, purpose, eventName, label }: Props) {
  const resolvedFileName = fileName && fileName.trim() ? fileName.trim() : composeFileName(purpose, eventName)
  const [open, setOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const handleOpen = async () => {
    if (qrDataUrl) {
      setOpen(true)
      return
    }
    setLoading(true)
    try {
      const data = await apiRequest<{ qrCode: string }>(apiPath)
      setQrDataUrl(data.qrCode)
      setOpen(true)
    } catch {
      setLoading(false)
    }
    setLoading(false)
  }

  const handleDownload = () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${resolvedFileName}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button className={styles.qrBtn} onClick={handleOpen} disabled={loading}>
        {loading ? '...' : '\u2318'} {label ?? 'QR'}
      </button>

      {open && qrDataUrl && createPortal(
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Chiudi">
              &times;
            </button>

            <h2 className={styles.title}>{label ?? 'QR Code'}</h2>
            <p className={styles.hint}>Inquadra per aprire la pagina</p>

            <img src={qrDataUrl} alt={`QR ${resolvedFileName}`} className={styles.qrImage} />

            <button className={styles.dlBtn} onClick={handleDownload}>
              Scarica PNG
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
