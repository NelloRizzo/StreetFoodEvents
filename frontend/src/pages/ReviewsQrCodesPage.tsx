import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'
import styles from './ReviewsQrCodesPage.module.scss'

type ReviewQrItem = {
  standId: string
  standName: string
  number: number | null
  url: string
  qrCode: string
}

export function ReviewsQrCodesPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [items, setItems] = useState<ReviewQrItem[]>([])

  const load = useCallback(async () => {
    if (!eventId) return
    try {
      const data = await apiRequest<{ items: ReviewQrItem[] }>(`/events/${eventId}/reviews/qrcodes/all`)
      setItems(data.items ?? [])
    } catch {
      /* handled below */
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId || !isAuthenticated) return
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string; eventId: string | null }[] }>(
      '/auth/me/roles',
    )
      .then(async (data) => {
        const eventRoles = data.roles.filter(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId),
        )
        const ok = data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'event-admin')
        if (!ok) {
          setForbidden(true)
          setLoading(false)
          return
        }
        try {
          const ev = await apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
          setEventName(ev.item.name)
        } catch {
          /* ignore */
        }
        await load()
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [eventId, isAuthenticated, load])

  if (forbidden) {
    return (
      <div className={styles.page}>
        <div className="page-shell">
          <p className={styles.empty}>Non hai accesso alla stampa dei QR delle recensioni.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={`${styles.toolbar} no-print`}>
          <Link className={styles.backLink} to={`/admin/events/${eventId}/reviews`}>
            &larr; Torna alle recensioni
          </Link>
          <button
            type="button"
            className={styles.printBtn}
            onClick={() => window.print()}
            disabled={items.length === 0}
          >
            Stampa
          </button>
        </div>

        <header className={styles.header}>
          <h1 className={styles.title}>Recensioni — QR degli stand</h1>
          <p className={styles.subtitle}>{eventName}</p>
        </header>

        {loading ? (
          <p className={styles.empty}>Caricamento…</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>Nessuno stand collegato all&apos;evento.</p>
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <article key={item.standId} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.standName}>{item.standName}</span>
                  {item.number != null && <span className={styles.standNumber}>#{item.number}</span>}
                </div>
                <img src={item.qrCode} alt={`QR recensione ${item.standName}`} className={styles.qr} />
                <span className={styles.target}>Recensione dello stand</span>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}