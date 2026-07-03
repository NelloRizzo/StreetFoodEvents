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
  locations: Array<{ eventId: string; location: { type: 'Point'; coordinates: [number, number] } | null }>
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

const eventIcon = L.divIcon({
  className: styles.eventMarker,
  html: '<span>📍</span>',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
})

const standIcon = L.divIcon({
  className: styles.standMarker,
  html: '<span>🏪</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function createPoiIcon(type: string | null) {
  let emoji = '📌'
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
  const markersGroupRef = useRef<L.FeatureGroup | null>(null)
  const [event, setEvent] = useState<EventData | null>(null)
  const [stands, setStands] = useState<StandData[]>([])
  const [pois, setPois] = useState<PoiData[]>([])
  const [selectedStandId, setSelectedStandId] = useState('')

  useEffect(() => {
    if (!eventId) return
    apiRequest<{ item: EventData }>(`/events/${eventId}`).then((d) => setEvent(d.item)).catch(() => {})
    apiRequest<{ items: StandData[] }>(`/stands?eventId=${eventId}`).then((d) => setStands(d.items)).catch(() => {})
    apiRequest<{ items: PoiData[] }>(`/pois?eventId=${eventId}`).then((d) => setPois(d.items)).catch(() => {})
  }, [eventId])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [45.0700, 7.6860],
      zoom: 14,
      zoomControl: true,
      maxZoom: 20,
    })
    mapRef.current = map

    const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      maxNativeZoom: 19,
    })

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 20,
      maxNativeZoom: 20,
    })

    satelliteLayer.addTo(map)

    L.control.layers({
      'Satellite': satelliteLayer,
      'Mappa': streetLayer,
    }, undefined, { position: 'bottomleft' }).addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers: L.Layer[] = []

    if (event?.location?.coordinates?.coordinates) {
      const [lng, lat] = event.location.coordinates.coordinates
      const marker = L.marker([lat, lng], { icon: eventIcon })
        .bindPopup(`<strong>${event.name}</strong><br/>${event.location.label}`)
      markers.push(marker)
    }

    function getStandLocation(s: StandData): { type: 'Point'; coordinates: [number, number] } | null {
      const entry = s.locations.find((l) => l.eventId === eventId)
      return entry?.location ?? null
    }

    stands.forEach((s) => {
      const loc = getStandLocation(s)
      if (!loc?.coordinates) return
      const [lng, lat] = loc.coordinates
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
    markersGroupRef.current = group

    if (markers.length > 0) {
      map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 18 })
    }

    return () => {
      group.remove()
      markersGroupRef.current = null
    }
  }, [event, stands, pois, eventId])

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all'evento</Link>
        <h1 className={styles.title}>{event?.name ?? 'Caricamento...'} — Mappa</h1>
      </div>

      <div className={styles.toolbar}>
        <select
          className={styles.toolbarSelect}
          value={selectedStandId}
          onChange={(e) => {
            const id = e.target.value
            setSelectedStandId(id)
            const map = mapRef.current
            if (!map) return
            if (!id) {
              const g = markersGroupRef.current
              if (g) map.fitBounds(g.getBounds().pad(0.15), { maxZoom: 18 })
              return
            }
            const stand = stands.find((s) => s.id === id)
            if (!stand) return
            const entry = stand.locations.find((l) => l.eventId === eventId)
            if (!entry?.location?.coordinates) return
            const [lng, lat] = entry.location.coordinates
            map.setView([lat, lng], 18)
            markersGroupRef.current?.eachLayer((layer) => {
              if (layer instanceof L.Marker) {
                const ll = layer.getLatLng()
                if (ll.lat === lat && ll.lng === lng) layer.openPopup()
              }
            })
          }}
        >
          <option value="">Tutti gli stand</option>
          {stands.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <button
          className={styles.toolbarBtn}
          onClick={() => {
            setSelectedStandId('')
            const map = mapRef.current
            const g = markersGroupRef.current
            if (map && g) map.fitBounds(g.getBounds().pad(0.15), { maxZoom: 18 })
          }}
        >
          🔄 Reset zoom
        </button>

        {selectedStandId && (() => {
          const stand = stands.find((s) => s.id === selectedStandId)
          if (!stand) return null
          const entry = stand.locations.find((l) => l.eventId === eventId)
          if (!entry?.location?.coordinates) return null
          const [lng, lat] = entry.location.coordinates
          return (
            <a
              className={styles.toolbarLink}
              href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              🗺️ Google Maps
            </a>
          )
        })()}
      </div>

      <div ref={mapContainerRef} className={styles.mapContainer} />

      <div className="page-shell">
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.eventMarkerSmall}>📍</span> Evento</span>
          <span className={styles.legendItem}><span className={styles.standMarkerSmall}>🏪</span> Stand</span>
          <span className={styles.legendItem}><span className={styles.poiMarkerSmall}>📌</span> Punto di interesse</span>
        </div>
      </div>
    </div>
  )
}
