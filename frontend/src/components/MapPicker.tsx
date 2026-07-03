import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './MapPicker.module.scss'

type MapPickerProps = {
  lat: string
  lng: string
  onChange: (lat: string, lng: string) => void
  height?: string
}

const defaultCenter: [number, number] = [41.9028, 12.4964] // Roma

export function MapPicker({ lat, lng, onChange, height = '240px' }: MapPickerProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentLat = Number(lat.replace(',', '.'))
  const currentLng = Number(lng.replace(',', '.'))
  const hasValidCoords = !isNaN(currentLat) && !isNaN(currentLng) && currentLat !== 0 && currentLng !== 0
  const center: [number, number] = hasValidCoords ? [currentLat, currentLng] : defaultCenter

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center,
      zoom: 14,
      zoomControl: true,
      maxZoom: 20,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      maxNativeZoom: 19,
    }).addTo(map)

    const marker = L.marker(center, { draggable: true }).addTo(map)

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      onChange(pos.lat.toFixed(6), pos.lng.toFixed(6))
    })

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      onChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6))
    })

    if (hasValidCoords) {
      map.setView(center, 16)
    }

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return
    const valid = !isNaN(currentLat) && !isNaN(currentLng) && currentLat !== 0 && currentLng !== 0
    if (valid) {
      markerRef.current.setLatLng([currentLat, currentLng])
      mapRef.current.setView([currentLat, currentLng], mapRef.current.getZoom())
    }
  }, [lat, lng])

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.map} style={{ height }} />
      <div className={styles.coords}>
        <input type="text" readOnly value={hasValidCoords ? `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}` : 'Clicca sulla mappa per selezionare la posizione'} className={styles.coordInput} />
      </div>
    </div>
  )
}
