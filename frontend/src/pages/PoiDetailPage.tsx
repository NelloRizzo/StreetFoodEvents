import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import styles from './PoiDetailPage.module.scss'

type PoiData = {
  id: string
  eventId: string
  name: string
  description: string | null
  location: { type: 'Point'; coordinates: [number, number] }
  iconType: string | null
  iconImage: { url: string } | null
  coverImage: { url: string } | null
  gallery: { url: string }[]
}

type EventData = {
  id: string
  name: string
}

export function PoiDetailPage() {
  const { eventId, poiId } = useParams<{ eventId: string; poiId: string }>()
  const [poi, setPoi] = useState<PoiData | null>(null)
  const [eventName, setEventName] = useState('')

  useEffect(() => {
    if (!poiId) return
    apiRequest<{ item: PoiData }>(`/pois/${poiId}`)
      .then((d) => {
        setPoi(d.item)
        if (eventId && !eventName) {
          apiRequest<{ item: EventData }>(`/events/${eventId}`)
            .then((e) => setEventName(e.item.name))
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [poiId, eventId, eventName])

  if (!poi) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to={`/events/${eventId}/mappa`} className={styles.backLink}>&larr; Torna alla mappa</Link>
        <Link to={`/events/${eventId}`} className={styles.backLink} style={{ marginLeft: '1rem' }}>
          &larr; Torna all'evento
        </Link>
      </div>

      {poi.coverImage && (
        <div className={styles.cover}>
          <img src={poi.coverImage.url} alt={poi.name} />
        </div>
      )}

      <div className={`page-shell ${styles.content}`}>
        <h1 className={styles.title}>{poi.name}</h1>

        {poi.iconType && (
          <span className={styles.iconType}>{poi.iconType}</span>
        )}

        {poi.description && (
          <p className={styles.description}>{poi.description}</p>
        )}

        {poi.gallery.length > 0 && (
          <section className={styles.gallerySection}>
            <h2 className={styles.sectionTitle}>Galleria</h2>
            <div className={styles.gallery}>
              {poi.gallery.map((img, i) => (
                <img key={i} src={img.url} alt={`${poi.name} ${i + 1}`} className={styles.galleryImage} />
              ))}
            </div>
          </section>
        )}

        <div className={styles.coords}>
          Coordinate: {poi.location.coordinates[1].toFixed(4)}, {poi.location.coordinates[0].toFixed(4)}
        </div>
      </div>
    </div>
  )
}
