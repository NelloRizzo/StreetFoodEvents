import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './MapPicker.module.scss'

type MapPickerProps = {
  lat: string
  lng: string
  onChange: (lat: string, lng: string) => void
  height?: string
  resetCenter?: { lat: number; lng: number } | null
  resetLabel?: string
}

const defaultCenter: [number, number] = [41.9028, 12.4964] // Roma

const markerIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path fill="#bf5a2a" d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/><circle fill="#fff" cx="12.5" cy="12.5" r="5"/></svg>`,
  className: '',
  iconSize: [25, 41],
  iconAnchor: [12.5, 41],
})

export function MapPicker({ lat, lng, onChange, height = '240px', resetCenter, resetLabel = 'Centra' }: MapPickerProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentLat = Number(lat.replace(',', '.'))
  const currentLng = Number(lng.replace(',', '.'))
  const hasValidCoords = !isNaN(currentLat) && !isNaN(currentLng) && currentLat !== 0 && currentLng !== 0
  const center: [number, number] = hasValidCoords ? [currentLat, currentLng] : defaultCenter

  const handleReset = () => {
    if (!mapRef.current || !markerRef.current || !resetCenter) return
    const { lat: rLat, lng: rLng } = resetCenter
    markerRef.current.setLatLng([rLat, rLng])
    mapRef.current.setView([rLat, rLng], 16)
    onChange(rLat.toFixed(6), rLng.toFixed(6))
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center,
      zoom: 14,
      zoomControl: true,
      maxZoom: 22,
    })

    const streetLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 20,
      maxNativeZoom: 20,
    })

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 23,
      maxNativeZoom: 23,
    })

    satelliteLayer.addTo(map)

    L.control.layers({
      'Satellite': satelliteLayer,
      'Mappa': streetLayer,
    }, undefined, { position: 'bottomleft' }).addTo(map)

    const marker = L.marker(center, { draggable: true, icon: markerIcon }).addTo(map)

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
      <div className={styles.actions}>
        <input type="text" readOnly value={hasValidCoords ? `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}` : 'Clicca sulla mappa per selezionare la posizione'} className={styles.coordInput} />
        {resetCenter && (
          <button type="button" className={styles.resetBtn} onClick={handleReset}>
            {resetLabel}
          </button>
        )}
      </div>
    </div>
  )
}
