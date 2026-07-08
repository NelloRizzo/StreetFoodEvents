import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import { useEventTheme } from '../features/theme/useEventTheme'
import styles from './EventGalleryPage.module.scss'

type EventPhoto = {
  id: string
  image: { url: string; publicId: string; width: number; height: number; format: string; bytes: number }
  sequenceNumber: number
  takenAt: string
  frameId: string | null
}

export function EventGalleryPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()
  const [eventName, setEventName] = useState('')
  const [photos, setPhotos] = useState<EventPhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hasPhotoRole, setHasPhotoRole] = useState(false)
  const [hasPrintRole, setHasPrintRole] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [filterSeq, setFilterSeq] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterTimeFrom, setFilterTimeFrom] = useState('')
  const [filterTimeTo, setFilterTimeTo] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const themeData = eventId
    ? { themeBrand: null, themeText: null, themeSurface: null, themeHighlight: null }
    : null
  useEventTheme(themeData)

  useEffect(() => {
    if (!eventId) return

    Promise.all([
      apiRequest<{ item: { name: string } }>(`/events/${eventId}`),
      apiRequest<{ items: EventPhoto[] }>(`/events/${eventId}/photos`),
    ])
      .then(([ev, ph]) => {
        setEventName(ev.item.name)
        setPhotos(ph.items)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [eventId])

  useEffect(() => {
    if (!eventId || !isAuthenticated) return

    apiRequest<{ roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
      .then((data) => {
        const eventRoles = data.roles.filter(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        setHasPhotoRole(eventRoles.some((r) => r.slug === 'photo-admin' || r.slug === 'platform-admin'))
        setHasPrintRole(eventRoles.some((r) => r.slug === 'photo-print' || r.slug === 'photo-admin' || r.slug === 'platform-admin'))
      })
      .catch(() => {})
  }, [eventId, isAuthenticated])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const html = `
      <html>
        <head>
          <style>
            body { margin: 0; padding: 1cm; font-family: sans-serif; }
            h1 { font-size: 18px; margin-bottom: 0.5cm; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5cm; }
            .grid img { width: 100%; height: auto; border-radius: 4px; page-break-inside: avoid; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>${eventName} — Galleria foto</h1>
          <div class="grid">
            ${photos.filter((p) => selectedIds.size === 0 || selectedIds.has(p.id)).map((p) => `<img src="${p.image.url}" />`).join('')}
          </div>
        </body>
      </html>
    `
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || deleting) return
    setDeleting(true)
    try {
      await Promise.all([...selectedIds].map((id) => apiRequest(`/events/${eventId}/photos/${id}`, { method: 'DELETE' })))
      setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id)))
      setSelectedIds(new Set())
    } catch {
      /* not required */
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await apiRequest(`/events/${eventId}/photos`, { method: 'DELETE' })
      setPhotos([])
      setSelectedIds(new Set())
    } catch {
      /* not required */
    } finally {
      setDeleting(false)
    }
  }

  const displayPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (filterSeq) {
        const seq = Number(filterSeq)
        if (!isNaN(seq) && p.sequenceNumber !== seq) return false
      }
      if (filterDate) {
        const photoDate = new Date(p.takenAt).toISOString().slice(0, 10)
        if (photoDate !== filterDate) return false
      }
      if (filterTimeFrom) {
        const photoTime = new Date(p.takenAt).toTimeString().slice(0, 5)
        if (photoTime < filterTimeFrom) return false
      }
      if (filterTimeTo) {
        const photoTime = new Date(p.takenAt).toTimeString().slice(0, 5)
        if (photoTime > filterTimeTo) return false
      }
      return true
    })
  }, [photos, filterSeq, filterDate, filterTimeFrom, filterTimeTo])

  const handlePrintPhoto = (photo: EventPhoto) => {
    const html = `
      <html>
        <head>
          <style>
            body { margin: 0; padding: 1cm; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
            .wrap { text-align: center; max-width: 100%; }
            .wrap img { max-width: 100%; height: auto; border-radius: 4px; }
            .label { margin-top: 0.5cm; font-size: 14px; color: #333; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <img src="${photo.image.url}" />
            <p class="label">#${photo.sequenceNumber}</p>
          </div>
        </body>
      </html>
    `
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all'evento</Link>

        <h1 className={styles.title}>Galleria foto</h1>
        <p className={styles.subtitle}>{eventName}</p>

        <div className={styles.toolbar}>
          <span className={styles.count}>{displayPhotos.length} foto{selectedIds.size > 0 ? ` (${selectedIds.size} selezionate)` : ''}</span>
          <div className={styles.actions}>
            {hasPrintRole && displayPhotos.length > 0 && (
              <button className={styles.printBtn} onClick={handlePrint}>
                Stampa {selectedIds.size > 0 ? 'selezionate' : 'tutte'}
              </button>
            )}
            {hasPhotoRole && selectedIds.size > 0 && (
              <button className={styles.dangerBtn} onClick={handleDeleteSelected} disabled={deleting}>
                Elimina selezionate
              </button>
            )}
            {hasPhotoRole && displayPhotos.length > 0 && (
              <button className={styles.dangerBtn} onClick={handleDeleteAll} disabled={deleting}>
                Cancella tutto
              </button>
            )}
          </div>
        </div>

        <div className={styles.filters}>
          <input
            type="number"
            placeholder="Filtra n° foto"
            value={filterSeq}
            onChange={(e) => setFilterSeq(e.target.value)}
            className={styles.filterInput}
            min="1"
          />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className={styles.filterInput}
          />
          <input
            type="time"
            value={filterTimeFrom}
            onChange={(e) => setFilterTimeFrom(e.target.value)}
            className={styles.filterInput}
            title="Da ora"
          />
          <span className={styles.filterSep}>—</span>
          <input
            type="time"
            value={filterTimeTo}
            onChange={(e) => setFilterTimeTo(e.target.value)}
            className={styles.filterInput}
            title="A ora"
          />
          {(filterSeq || filterDate || filterTimeFrom || filterTimeTo) && (
            <button
              className={styles.clearFiltersBtn}
              onClick={() => { setFilterSeq(''); setFilterDate(''); setFilterTimeFrom(''); setFilterTimeTo('') }}
            >
              Cancella filtri
            </button>
          )}
        </div>

        <div ref={printRef} className={styles.grid}>
          {displayPhotos.length === 0 && (
            <p className={styles.empty}>Nessuna foto nella galleria.</p>
          )}
          {displayPhotos.map((photo) => (
            <div
              key={photo.id}
              className={`${styles.card} ${selectedIds.has(photo.id) ? styles.selected : ''}`}
              onClick={() => hasPhotoRole && toggleSelect(photo.id)}
            >
              <img src={photo.image.url} alt={`Foto ${photo.sequenceNumber}`} className={styles.image} loading="eager" />
              <span className={styles.seq}>#{photo.sequenceNumber}</span>
              {hasPrintRole && (
                <>
                  <button
                    className={styles.printPhotoBtn}
                    onClick={(e) => { e.stopPropagation(); handlePrintPhoto(photo) }}
                    title={`Stampa #${photo.sequenceNumber}`}
                  >
                    Stampa
                  </button>
                  <button
                    className={styles.emailPhotoBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      const email = prompt('Invia foto via email — inserisci il tuo indirizzo:')
                      if (email) {
                        const subject = encodeURIComponent(`Foto #${photo.sequenceNumber} — ${eventName}`)
                        const body = encodeURIComponent(`Foto #${photo.sequenceNumber}\n\n${photo.image.url}`)
                        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank')
                      }
                    }}
                    title={`Invia #${photo.sequenceNumber} via email`}
                  >
                    Email
                  </button>
                </>
              )}
              {hasPhotoRole && (
                <span className={styles.check}>{selectedIds.has(photo.id) ? '\u2713' : ''}</span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.boothLink}>
          <Link to={`/events/${eventId}/photo-booth`} className={styles.boothLinkBtn}>
            Scatta una foto
          </Link>
        </div>
      </div>
    </div>
  )
}
