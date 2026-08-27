import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import styles from './EventDetailPage.module.scss'

type Stand = {
  id: string
  type: 'food' | 'artigianato' | 'divertimento'
  name: string
  slogan: string | null
  numbers: Array<{ eventId: string; number: number; showOnMap?: boolean }>
}

const STAND_TYPE_LABELS = {
  food: 'Food & Beverage',
  artigianato: 'Artigianato',
  divertimento: 'Divertimento',
} as const

const STAND_TYPE_EMOJIS = {
  food: '🍽️',
  artigianato: '🧶',
  divertimento: '🎡',
} as const

export function StandNumberingPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [stands, setStands] = useState<Stand[]>([])

  useEffect(() => {
    if (!eventId || !isAuthenticated) return
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
      .then((data) => {
        const eventRoles = data.roles.filter(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        const ok = data.isPlatformAdmin || eventRoles.some((r) => ['event-admin', 'event-cashier'].includes(r.slug))
        if (!ok) {
          setForbidden(true)
          setLoading(false)
          return
        }
        Promise.all([
          apiRequest<{ item: { name: string } }>(`/events/${eventId}`),
          apiRequest<{ items: Stand[] }>(`/stands?eventId=${eventId}`),
        ])
          .then(([ev, st]) => {
            setEventName(ev.item.name)
            setStands(st.items)
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      })
      .catch(() => setLoading(false))
  }, [eventId, isAuthenticated])

  const standNumber = (stand: Stand) =>
    stand.numbers?.find((n) => n.eventId === eventId)?.number ?? null

  const sortedStands = [...stands].sort((a, b) => {
    const na = standNumber(a)
    const nb = standNumber(b)
    if (na == null && nb == null) return a.name.localeCompare(b.name)
    if (na == null) return 1
    if (nb == null) return -1
    return na - nb
  })

  const standShowOnMap = (stand: Stand) =>
    stand.numbers?.find((n) => n.eventId === eventId)?.showOnMap ?? true

  const handleMoveStand = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (!eventId || target < 0 || target >= sortedStands.length) return
    const next = [...sortedStands]
    const [moving] = next.splice(index, 1)
    next.splice(target, 0, moving)
    const items = next.map((s, i) => ({ standId: s.id, number: i + 1, showOnMap: standShowOnMap(s) }))
    try {
      await apiRequest('/stands/reorder', { method: 'PATCH', bodyJson: { eventId, items } })
      setStands((prev) => {
        const numberByStand = new Map(items.map((it) => [it.standId, it.number]))
        return prev.map((s) => ({
          ...s,
          numbers: numberByStand.has(s.id)
            ? [{ eventId, number: numberByStand.get(s.id)!, showOnMap: standShowOnMap(s) }]
            : s.numbers,
        }))
      })
    } catch { /* ignore */ }
  }

  const handleToggleStandMap = async (stand: Stand) => {
    if (!eventId) return
    const next = !standShowOnMap(stand)
    const number = standNumber(stand)
    if (number == null) return
    try {
      await apiRequest('/stands/reorder', {
        method: 'PATCH',
        bodyJson: { eventId, items: [{ standId: stand.id, number, showOnMap: next }] },
      })
      setStands((prev) => prev.map((s) =>
        s.id === stand.id
          ? { ...s, numbers: s.numbers.map((n) => n.eventId === eventId ? { ...n, showOnMap: next } : n) }
          : s,
      ))
    } catch { /* ignore */ }
  }

  if (forbidden) {
    return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  }
  if (loading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <h1 className={styles.pageTitle}>Numerazione stand &mdash; {eventName || 'Caricamento...'}</h1>

        <section className={styles.standsSection}>
          <h2 className={styles.sectionTitle}>
            Numerazione stand <span className={styles.count}>{sortedStands.length}</span>
          </h2>
          <p className={styles.empty}>
            I numeri sono globali per evento, senza distinzione di categoria. Usa le frecce per riordinare tutti gli stand in un&apos;unica sequenza.
          </p>
          <div className={styles.standGrid}>
            {sortedStands.map((stand) => {
              const index = sortedStands.indexOf(stand)
              return (
                <div key={stand.id} className={styles.standCardRow}>
                  <Link
                    to={`/events/${eventId}/stands/${stand.id}`}
                    className={styles.standCard}
                  >
                    <div className={styles.standBody}>
                      <strong className={styles.standName}>
                        <span className={styles.standNumberBadge}>{standNumber(stand) ?? '?'}</span>
                        {stand.name}
                      </strong>
                      <span className={`${styles.standTypeBadge} ${stand.type === 'artigianato' ? styles.standTypeBadgeArtigianato : stand.type === 'divertimento' ? styles.standTypeBadgeDivertimento : ''}`}>
                        {STAND_TYPE_EMOJIS[stand.type ?? 'food']} {STAND_TYPE_LABELS[stand.type ?? 'food']}
                      </span>
                    </div>
                  </Link>
                  <div className={styles.reorderBtns}>
                    <label className={styles.standMapToggle} title="Mostra/nascondi lo stand nella mappa dell'evento">
                      <input
                        type="checkbox"
                        checked={standShowOnMap(stand)}
                        onChange={() => handleToggleStandMap(stand)}
                      />
                      <span>Mappa</span>
                    </label>
                    <button
                      className={styles.reorderBtn}
                      onClick={() => handleMoveStand(index, -1)}
                      disabled={index === 0}
                      title="Sposta su (numero più basso)"
                    >
                      ▲
                    </button>
                    <button
                      className={styles.reorderBtn}
                      onClick={() => handleMoveStand(index, 1)}
                      disabled={index === sortedStands.length - 1}
                      title="Sposta giù (numero più alto)"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
