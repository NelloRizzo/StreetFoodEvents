import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { QRCodeDownload } from '../components/QRCodeDownload'
import styles from './EventQrCodesPage.module.scss'

export function EventQrCodesPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [eventName, setEventName] = useState('')

  useEffect(() => {
    if (!eventId) return
    apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
      .then((data) => setEventName(data.item.name))
      .catch(() => {})
  }, [eventId])

  if (!eventId) return null

  const items = [
    { label: 'QR Evento (pagina evento)', apiPath: `/events/${eventId}/qrcode`, purpose: 'qr-evento' },
    { label: 'QR Menu (primo stand visibile)', apiPath: `/events/${eventId}/menu-qrcode`, purpose: 'qr-menu' },
    { label: 'QR Galleria foto', apiPath: `/events/${eventId}/gallery-qrcode`, purpose: 'qr-galleria' },
    { label: 'QR Scatto foto (photo booth)', apiPath: `/events/${eventId}/photo-booth-qrcode`, purpose: 'qr-photo-booth' },
    { label: 'QR Contest evento', apiPath: `/events/${eventId}/contests-qrcode`, purpose: 'qr-contest' },
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
            <QRCodeDownload apiPath={item.apiPath} purpose={item.purpose} eventName={eventName} eventId={eventId} label="Mostra QR" />
          </div>
        ))}
      </div>
    </div>
  )
}
