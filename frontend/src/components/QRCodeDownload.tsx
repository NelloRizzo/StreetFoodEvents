import { useState } from 'react'

import { apiRequest } from '../lib/api'
import styles from './QRCodeDownload.module.scss'

type Props = {
  apiPath: string
  fileName: string
}

export function QRCodeDownload({ apiPath, fileName }: Props) {
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
    link.download = `${fileName}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <button className={styles.qrBtn} onClick={handleOpen} disabled={loading}>
        {loading ? '...' : '\u2318'} QR
      </button>

      {open && qrDataUrl && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Chiudi">
              &times;
            </button>

            <h2 className={styles.title}>QR Code</h2>
            <p className={styles.hint}>Inquadra per aprire la pagina</p>

            <img src={qrDataUrl} alt={`QR ${fileName}`} className={styles.qrImage} />

            <button className={styles.dlBtn} onClick={handleDownload}>
              Scarica PNG
            </button>
          </div>
        </div>
      )}
    </>
  )
}
