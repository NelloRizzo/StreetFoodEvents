import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import styles from './EventDetailPage.module.scss'

export function EventFramesPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [defaultFrameId, setDefaultFrameId] = useState<string | null>(null)
  const [frameOptions, setFrameOptions] = useState<{ id: string; name: string }[]>([])
  const [frameName, setFrameName] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!eventId || !isAuthenticated) return
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
      .then((data) => {
        const eventRoles = data.roles.filter(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        const ok = data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'photo-admin')
        if (!ok) {
          setForbidden(true)
          setLoading(false)
          return
        }
        Promise.all([
          apiRequest<{ item: { name: string; defaultFrameId: string | null } }>(`/events/${eventId}`),
          apiRequest<{ items: { id: string; name: string }[] }>('/frames'),
        ])
          .then(([ev, fr]) => {
            setEventName(ev.item.name)
            setDefaultFrameId(ev.item.defaultFrameId ?? null)
            const frames = fr.items ?? []
            setFrameOptions(frames)
            const current = frames.find((f) => f.id === ev.item.defaultFrameId)
            setFrameName(current?.name ?? (ev.item.defaultFrameId ? 'Cornice non più disponibile' : ''))
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      })
      .catch(() => setLoading(false))
  }, [eventId, isAuthenticated])

  const handleChange = async (value: string) => {
    if (!eventId || saving) return
    const next = value || null
    setSaving(true)
    try {
      const res = await apiRequest<{ item: { defaultFrameId: string | null } }>(`/events/${eventId}`, {
        method: 'PATCH',
        bodyJson: { defaultFrameId: next },
      })
      setDefaultFrameId(res.item.defaultFrameId ?? null)
      setFrameName(frameOptions.find((f) => f.id === res.item.defaultFrameId)?.name ?? '')
    } catch { /* ignore */ }
    setSaving(false)
  }

  if (forbidden) {
    return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  }
  if (loading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <p className={styles.empty}>{eventName}</p>

        <section className={styles.standsSection}>
          <h2 className={styles.sectionTitle}>Cornice Photo Booth</h2>
          <p className={styles.empty}>
            Cornice applicata automaticamente nel photo booth pubblico dell&apos;evento.
          </p>
          <div className={styles.frameField}>
            <label className={styles.frameLabel} htmlFor="event-default-frame">
              Cornice di default
            </label>
            <select
              id="event-default-frame"
              className={styles.frameSelect}
              value={defaultFrameId ?? ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={saving}
            >
              <option value="">Nessuna cornice</option>
              {frameOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {frameName && defaultFrameId && (
              <p className={styles.empty}>Cornice selezionata: <strong>{frameName}</strong></p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
