import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import { ConfirmModal } from '../components/ConfirmModal'
import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import { useEventTheme } from '../features/theme/useEventTheme'
import styles from './EventGalleryPage.module.scss'

type EventPhoto = {
  id: string
  type: 'image' | 'video'
  image: { url: string; publicId: string; width: number; height: number; format: string; bytes: number } | null
  video: { url: string; publicId: string; width: number; height: number; format: string; bytes: number; duration: number } | null
  sequenceNumber: number
  takenAt: string
  frameId: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

type SocialPlatform = 'facebook' | 'instagram'

type SocialPostStatusInfo = {
  id: string
  platform: SocialPlatform
  status: string
  permalink: string | null
  lastError: string | null
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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [filterSeq, setFilterSeq] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterTimeFrom, setFilterTimeFrom] = useState('')
  const [filterTimeTo, setFilterTimeTo] = useState('')
  const printRef = useRef<HTMLDivElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [emailModalPhoto, setEmailModalPhoto] = useState<EventPhoto | null>(null)
  const [bulkEmailIds, setBulkEmailIds] = useState<string[] | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')

  const [lightboxPhoto, setLightboxPhoto] = useState<EventPhoto | null>(null)

  const [marketingConsent, setMarketingConsent] = useState(false)

  const [socialConfig, setSocialConfig] = useState<{ facebook: boolean; instagram: boolean } | null>(null)
  const [socialOpen, setSocialOpen] = useState(false)
  const [socialPlatforms, setSocialPlatforms] = useState<{ facebook: boolean; instagram: boolean }>({ facebook: true, instagram: true })
  const [socialCaption, setSocialCaption] = useState('')
  const [socialSubmitting, setSocialSubmitting] = useState(false)
  const [socialError, setSocialError] = useState('')
  const [socialPosts, setSocialPosts] = useState<SocialPostStatusInfo[] | null>(null)

  const [eventDefaultFrameId, setEventDefaultFrameId] = useState<string | null>(null)
  const [frameOptions, setFrameOptions] = useState<{ id: string; name: string }[]>([])
  const [savingFrame, setSavingFrame] = useState(false)

  const handleSendEmail = useCallback(async (to: string, consent?: boolean) => {
    if (!eventId || emailSending) return
    const isBulk = bulkEmailIds !== null
    if (!isBulk && !emailModalPhoto) return
    setEmailSending(true)
    setEmailError('')
    const hasConsent = consent ?? marketingConsent
    setMarketingConsent(hasConsent)
    try {
      if (isBulk && bulkEmailIds) {
        await apiRequest(`/events/${eventId}/photos/send-email`, {
          method: 'POST',
          body: JSON.stringify({ email: to, photoIds: bulkEmailIds, marketingConsent: hasConsent }),
          headers: { 'Content-Type': 'application/json' },
        })
      } else if (emailModalPhoto) {
        await apiRequest(`/events/${eventId}/photos/${emailModalPhoto.id}/send-email`, {
          method: 'POST',
          body: JSON.stringify({ email: to, marketingConsent: hasConsent }),
          headers: { 'Content-Type': 'application/json' },
        })
      }
      setEmailSent(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invio fallito'
      setEmailError(msg)
      setEmailSent(false)
    } finally {
      setEmailSending(false)
    }
  }, [eventId, emailModalPhoto, bulkEmailIds, emailSending, marketingConsent])

  const selectedSocialPhotos = useMemo(
    () => photos.filter((p) => selectedIds.has(p.id) && p.type === 'image' && p.image),
    [photos, selectedIds]
  )

  const openSocialModal = () => {
    setSocialCaption(eventName)
    setSocialError('')
    setSocialPosts(null)
    setSocialOpen(true)
    if (!socialConfig && eventId) {
      apiRequest<{ facebook: boolean; instagram: boolean }>(`/events/${eventId}/social/config`)
        .then((cfg) => {
          setSocialConfig(cfg)
          setSocialPlatforms({ facebook: cfg.facebook, instagram: cfg.instagram })
        })
        .catch(() => setSocialConfig({ facebook: false, instagram: false }))
    }
  }

  const handlePublish = async () => {
    if (!eventId || socialSubmitting) return
    const platforms = (['facebook', 'instagram'] as const).filter((p) => socialPlatforms[p])
    if (platforms.length === 0) {
      setSocialError('Seleziona almeno una piattaforma')
      return
    }
    setSocialSubmitting(true)
    setSocialError('')
    try {
      const res = await apiRequest<{ items: SocialPostStatusInfo[] }>(`/events/${eventId}/social/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoIds: selectedSocialPhotos.map((p) => p.id),
          platforms,
          caption: socialCaption,
        }),
      })
      setSocialPosts(res.items)
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : 'Pubblicazione fallita')
    } finally {
      setSocialSubmitting(false)
    }
  }

  useEffect(() => {
    if (!socialOpen || !socialPosts || !eventId) return
    if (!socialPosts.some((p) => p.status === 'pending' || p.status === 'processing')) return

    const ids = socialPosts.map((p) => p.id).join(',')
    const timer = setInterval(() => {
      apiRequest<{ items: SocialPostStatusInfo[] }>(`/events/${eventId}/social/posts?ids=${ids}`)
        .then((data) => setSocialPosts(data.items))
        .catch(() => {})
    }, 3000)

    return () => clearInterval(timer)
  }, [socialOpen, socialPosts, eventId])

  const themeData = eventId
    ? { themeBrand: null, themeText: null, themeSurface: null, themeHighlight: null }
    : null
  useEventTheme(themeData)

  useEffect(() => {
    if (!eventId) return

    Promise.all([
      apiRequest<{ item: { name: string; defaultFrameId: string | null } }>(`/events/${eventId}`),
      apiRequest<{ items: EventPhoto[] }>(`/events/${eventId}/photos`),
    ])
      .then(([ev, ph]) => {
        setEventName(ev.item.name)
        setEventDefaultFrameId(ev.item.defaultFrameId ?? null)
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
        const isPhotoAdmin = eventRoles.some((r) => r.slug === 'photo-admin' || r.slug === 'platform-admin')
        setHasPhotoRole(isPhotoAdmin)
        setHasPrintRole(eventRoles.some((r) => r.slug === 'photo-print' || r.slug === 'photo-admin' || r.slug === 'platform-admin'))
        if (isPhotoAdmin) {
          apiRequest<{ items: { id: string; name: string }[] }>('/frames')
            .then((d) => setFrameOptions(d.items))
            .catch(() => {})
        }
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

  const handleChangeDefaultFrame = (value: string) => {
    if (!eventId || savingFrame) return
    setSavingFrame(true)
    apiRequest<{ item: { defaultFrameId: string | null } }>(`/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultFrameId: value || null }),
    })
      .then((res) => {
        setEventDefaultFrameId(res.item.defaultFrameId ?? null)
        setUploadError('')
      })
      .catch(() => setUploadError('Salvataggio cornice evento fallito'))
      .finally(() => setSavingFrame(false))
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const selected = photos
      .filter((p) => selectedIds.size === 0 || selectedIds.has(p.id))
      .filter((p) => p.type === 'image' && p.image)
    const pages = selected.map((p) => `
      <div class="page">
        <img src="${p.image!.url}" />
      </div>
    `).join('')
    const html = `
      <html>
        <head>
          <style>
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; }
            .page {
              width: 100vw;
              height: 100vh;
              overflow: hidden;
              page-break-after: always;
              break-after: page;
            }
            .page img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            }
            .page:last-child {
              page-break-after: avoid;
              break-after: avoid;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${pages}
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

  const handleBulkEmail = () => {
    const imageIds = photos
      .filter((p) => selectedIds.has(p.id) && p.type === 'image' && p.image)
      .map((p) => p.id)
    if (imageIds.length === 0) return
    setEmailModalPhoto(null)
    setEmailSent(false)
    setEmailError('')
    setBulkEmailIds(imageIds)
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
    if (photo.type !== 'image' || !photo.image) return
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

  const handleUploadVideo = async (file: File) => {
    if (!eventId || !file || uploading) return
    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('video', file)

      const res = await fetch(`${API_BASE_URL}/events/${eventId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.message ?? 'Upload fallito')
      }

      const data = await apiRequest<{ items: EventPhoto[] }>(`/events/${eventId}/photos`)
      setPhotos(data.items)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload video fallito. Riprova.')
    } finally {
      setUploading(false)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <h1 className={styles.title}>Galleria media</h1>
        <p className={styles.subtitle}>{eventName}</p>

        <div className={styles.toolbar}>
          <span className={styles.count}>
            {displayPhotos.length} elementi{selectedIds.size > 0 ? ` (${selectedIds.size} selezionati)` : ''}
          </span>
          <div className={styles.actions}>
            {hasPhotoRole && (
              <label className={styles.frameSelectWrap}>
                Cornice evento
                <select
                  value={eventDefaultFrameId ?? ''}
                  onChange={(e) => handleChangeDefaultFrame(e.target.value)}
                  className={styles.frameSelect}
                  disabled={savingFrame}
                >
                  <option value="">Nessuna</option>
                  {frameOptions.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </label>
            )}
            {hasPhotoRole && (
              <>
                <button
                  className={styles.printBtn}
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Caricamento...' : 'Carica video'}
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/x-matroska"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUploadVideo(f)
                  }}
                />
              </>
            )}
            {uploadError && <span className={styles.uploadError}>{uploadError}</span>}
            {hasPrintRole && displayPhotos.length > 0 && (
              <button className={styles.printBtn} onClick={handlePrint}>
                Stampa {selectedIds.size > 0 ? 'selezionate' : 'tutte'}
              </button>
            )}
            {hasPrintRole && selectedIds.size > 0 && (
              <button className={styles.printBtn} onClick={handleBulkEmail}>
                Invia selezionate via email
              </button>
            )}
            {hasPhotoRole && selectedSocialPhotos.length > 0 && (
              <button className={styles.printBtn} onClick={openSocialModal}>
                Pubblica sui social ({selectedSocialPhotos.length})
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
              onClick={() => setLightboxPhoto(photo)}
            >
              {photo.type === 'video' && photo.video ? (
                <video
                  src={photo.video.url}
                  className={styles.image}
                  preload="metadata"
                  controls
                  onClick={(e) => { e.stopPropagation(); setLightboxPhoto(photo) }}
                />
              ) : photo.image ? (
                <img src={photo.image.url} alt={`Foto ${photo.sequenceNumber}`} className={styles.image} loading="eager" />
              ) : null}
              <span className={styles.seq}>#{photo.sequenceNumber}</span>
              {photo.type === 'video' && (
                <span className={styles.videoBadge}>&#127916;</span>
              )}
              {hasPrintRole && photo.type === 'image' && (
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
                      setBulkEmailIds(null)
                      setEmailSent(false)
                      setEmailError('')
                      setEmailModalPhoto(photo)
                    }}
                    title={`Invia #${photo.sequenceNumber} via email`}
                  >
                    Email
                  </button>
                </>
              )}
              {hasPrintRole && (
                <button
                  className={`${styles.check} ${selectedIds.has(photo.id) ? styles.checkOn : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id) }}
                  title={selectedIds.has(photo.id) ? 'Deseleziona' : 'Seleziona'}
                >
                  {selectedIds.has(photo.id) ? '\u2713' : ''}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className={styles.boothLink}>
          <Link to={`/admin/events/${eventId}/photo-booth`} className={styles.boothLinkBtn}>
            Scatta una foto
          </Link>
        </div>
      </div>

      {lightboxPhoto && (
        <div
          className={styles.lightbox}
          onClick={() => setLightboxPhoto(null)}
        >
          {lightboxPhoto.type === 'video' && lightboxPhoto.video ? (
            <video
              src={lightboxPhoto.video.url}
              className={styles.lightboxMedia}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxPhoto.image?.url ?? ''}
              alt={`Foto ${lightboxPhoto.sequenceNumber}`}
              className={styles.lightboxMedia}
            />
          )}
          <span className={styles.lightboxSeq}>#{lightboxPhoto.sequenceNumber}</span>
        </div>
      )}

      <ConfirmModal
        open={emailModalPhoto !== null || bulkEmailIds !== null}
        title={emailSent ? 'Email inviata' : bulkEmailIds ? 'Invia foto selezionate via email' : 'Invia foto via email'}
        message={emailSent
          ? bulkEmailIds
            ? `${bulkEmailIds.length} foto selezionate sono state inviate.`
            : `La foto #${emailModalPhoto?.sequenceNumber} è stata inviata.`
          : emailError
            ? emailError
            : bulkEmailIds
              ? `Inserisci l'indirizzo email per ricevere le ${bulkEmailIds.length} foto selezionate:`
              : 'Inserisci il tuo indirizzo email per ricevere la foto:'}
        variant={emailSent ? 'alert' : 'prompt'}
        confirmLabel={emailSent ? 'OK' : emailSending ? 'Invio...' : 'Invia'}
        cancelLabel="Annulla"
        showConsent={!emailSent}
        consentLabel="Acconsento al trattamento dei miei dati per ricevere comunicazioni promozionali e aggiornamenti sugli eventi. Informativa privacy disponibile nella sezione dedicata."
        onConfirm={(to, consent) => {
          if (emailSent) {
            setEmailModalPhoto(null)
            setBulkEmailIds(null)
          } else if (to) {
            handleSendEmail(to, consent)
          }
        }}
        onCancel={() => {
          if (!emailSending) {
            setEmailModalPhoto(null)
            setBulkEmailIds(null)
          }
        }}
      />

      {socialOpen && (
        <div className={styles.socialOverlay} onClick={() => { if (!socialSubmitting) setSocialOpen(false) }}>
          <div className={styles.socialModal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.socialTitle}>Pubblica sui social</h2>
            {!socialPosts ? (
              <>
                <p className={styles.socialInfo}>{selectedSocialPhotos.length} foto selezionate</p>
                <div className={styles.socialPlatforms}>
                  {(['facebook', 'instagram'] as const).map((p) => (
                    <label key={p} className={styles.socialPlatform}>
                      <input
                        type="checkbox"
                        checked={socialPlatforms[p]}
                        disabled={!socialConfig?.[p]}
                        onChange={() => setSocialPlatforms((prev) => ({ ...prev, [p]: !prev[p] }))}
                      />
                      {p === 'facebook' ? 'Facebook' : 'Instagram'}
                      {socialConfig && !socialConfig[p] && ' (non configurata)'}
                    </label>
                  ))}
                </div>
                <textarea
                  value={socialCaption}
                  onChange={(e) => setSocialCaption(e.target.value)}
                  placeholder="Didascalia"
                  rows={3}
                  className={styles.socialCaption}
                />
                {socialError && <p className={styles.uploadError}>{socialError}</p>}
                <div className={styles.socialActions}>
                  <button className={styles.clearFiltersBtn} onClick={() => setSocialOpen(false)} disabled={socialSubmitting}>
                    Annulla
                  </button>
                  <button className={styles.printBtn} onClick={handlePublish} disabled={socialSubmitting}>
                    {socialSubmitting ? 'Pubblicazione...' : 'Pubblica'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <ul className={styles.socialResults}>
                  {socialPosts.map((p) => (
                    <li key={p.id} className={`${styles.socialResultItem} ${p.status === 'published' ? styles.socialOk : p.status === 'failed' ? styles.socialKo : ''}`}>
                      <span>{p.platform === 'facebook' ? 'Facebook' : 'Instagram'}:</span>
                      {p.status === 'published' && p.permalink ? (
                        <a href={p.permalink} target="_blank" rel="noreferrer">Visualizza post</a>
                      ) : (
                        <span>
                          {p.status === 'published'
                            ? 'Pubblicato'
                            : p.status === 'failed'
                              ? `Errore: ${p.lastError ?? 'sconosciuto'}`
                              : 'In pubblicazione...'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className={styles.socialActions}>
                  <button className={styles.printBtn} onClick={() => setSocialOpen(false)}>Chiudi</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
