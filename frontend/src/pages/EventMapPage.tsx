import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { apiRequest } from '../lib/api'
import styles from './EventMapPage.module.scss'

type EventData = {
  id: string
  name: string
  location: {
    label: string
    coordinates?: { coordinates: [number, number] } | null
  }
}

type StandData = {
  id: string
  name: string
  location?: { type: 'Point'; coordinates: [number, number] } | null
}

type PoiData = {
  id: string
  name: string
  description: string | null
  location: { type: 'Point'; coordinates: [number, number] }
  iconType: string | null
  iconImage: unknown | null
  coverImage: unknown | null
}

const standIcon = L.divIcon({
  className: styles.standMarker,
  html: '<span>🏪</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function createPoiIcon(type: string | null) {
  let emoji = '📍'
  switch (type) {
    case 'toilet': emoji = '🚻'; break
    case 'info': emoji = 'ℹ️'; break
    case 'entrance': emoji = '🚪'; break
    case 'parking': emoji = '🅿️'; break
    case 'stage': emoji = '🎵'; break
    case 'food': emoji = '🍽️'; break
    case 'drink': emoji = '🍺'; break
  }
  return L.divIcon({
    className: styles.poiMarker,
    html: `<span>${emoji}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
}

export function EventMapPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [stands, setStands] = useState<StandData[]>([])
  const [pois, setPois] = useState<PoiData[]>([])

  useEffect(() => {
    if (!eventId) return
    apiRequest<{ item: EventData }>(`/events/${eventId}`).then((d) => setEvent(d.item)).catch(() => {})
    apiRequest<{ items: StandData[] }>(`/stands?eventId=${eventId}`).then((d) => setStands(d.items)).catch(() => {})
    apiRequest<{ items: PoiData[] }>(`/pois?eventId=${eventId}`).then((d) => setPois(d.items)).catch(() => {})
  }, [eventId])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    mapRef.current = L.map(mapContainerRef.current, {
      center: [45.0700, 7.6860],
      zoom: 16,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current)

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers: L.Layer[] = []

    stands.forEach((s) => {
      if (!s.location?.coordinates) return
      const [lng, lat] = s.location.coordinates
      const marker = L.marker([lat, lng], { icon: standIcon })
        .bindPopup(`<strong>${s.name}</strong><br/><a href="/events/${eventId}/stands/${s.id}">Vai allo stand</a>`)
      markers.push(marker)
    })

    pois.forEach((p) => {
      const [lng, lat] = p.location.coordinates
      const popupHtml = p.description
        ? `<strong>${p.name}</strong><br/>${p.description}<br/><a href="/events/${eventId}/pois/${p.id}">Dettaglio</a>`
        : `<strong>${p.name}</strong><br/><a href="/events/${eventId}/pois/${p.id}">Dettaglio</a>`
      const marker = L.marker([lat, lng], { icon: createPoiIcon(p.iconType) })
        .bindPopup(popupHtml)
      markers.push(marker)
    })

    const group = L.featureGroup(markers)
    group.addTo(map)

    if (markers.length > 0) {
      map.fitBounds(group.getBounds().pad(0.15))
    }

    return () => {
      group.remove()
    }
  }, [stands, pois, eventId])

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all'evento</Link>
        <h1 className={styles.title}>{event?.name ?? 'Caricamento...'} — Mappa</h1>
      </div>

      <div ref={mapContainerRef} className={styles.mapContainer} />

      <div className="page-shell">
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.standMarkerSmall}>🏪</span> Stand</span>
          <span className={styles.legendItem}><span className={styles.poiMarkerSmall}>📍</span> Punto di interesse</span>
        </div>
      </div>
    </div>
  )
}
