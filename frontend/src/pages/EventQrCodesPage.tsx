import { useParams } from 'react-router-dom'

import { QRCodeDownload } from '../components/QRCodeDownload'
import styles from './EventQrCodesPage.module.scss'

export function EventQrCodesPage() {
  const { eventId } = useParams<{ eventId: string }>()

  if (!eventId) return null

  const items = [
    { label: 'QR Evento (pagina evento)', apiPath: `/events/${eventId}/qrcode`, fileName: `evento-${eventId}` },
    { label: 'QR Menu (primo stand visibile)', apiPath: `/events/${eventId}/menu-qrcode`, fileName: `menu-${eventId}` },
    { label: 'QR Galleria foto', apiPath: `/events/${eventId}/gallery-qrcode`, fileName: `gallery-${eventId}` },
    { label: 'QR Scatto foto (photo booth)', apiPath: `/events/${eventId}/photo-booth-qrcode`, fileName: `photo-booth-${eventId}` },
    { label: 'QR Contest evento', apiPath: `/events/${eventId}/contests-qrcode`, fileName: `contests-${eventId}` },
  ]

  return (
    <div className="page-shell">
      <h1 className={styles.title}>QR code dell'evento</h1>
      <p className={styles.hint}>
        Genera e scarica i QR code da stampare. Clicca su un pulsante per visualizzare il QR e scaricarlo in PNG.
      </p>
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.apiPath} className={styles.card}>
            <h2 className={styles.cardTitle}>{item.label}</h2>
            <QRCodeDownload apiPath={item.apiPath} fileName={item.fileName} label="Mostra QR" />
          </div>
        ))}
      </div>
    </div>
  )
}
