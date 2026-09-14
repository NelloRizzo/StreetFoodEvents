import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { QRCodeDownload } from '../components/QRCodeDownload'
import { RatingStars } from '../components/RatingStars'
import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'
import {
  deleteReview,
  fetchManageReviews,
  updateReviewStatus,
  type AdminReview,
} from '../lib/reviews'
import styles from './ReviewsManagePage.module.scss'

type StandLite = { id: string; name: string }

export function ReviewsManagePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [items, setItems] = useState<AdminReview[]>([])
  const [stands, setStands] = useState<StandLite[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState<'' | 'visible' | 'hidden'>('')
  const [standId, setStandId] = useState('')

  const load = useCallback(
    async (p: number) => {
      if (!eventId) return
      const data = await fetchManageReviews(eventId, {
        page: p,
        standId: standId || undefined,
        status: status || undefined,
      })
      setItems(data.items)
      setTotalPages(data.pagination.totalPages)
    },
    [eventId, standId, status],
  )

  useEffect(() => {
    if (!eventId || !isAuthenticated) return
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
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
          const [ev, st] = await Promise.all([
            apiRequest<{ item: { name: string } }>(`/events/${eventId}`),
            apiRequest<{ items: StandLite[] }>(`/stands?eventId=${eventId}`),
          ])
          setEventName(ev.item.name)
          setStands(st.items ?? [])
        } catch {
          /* ignore */
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [eventId, isAuthenticated])

  useEffect(() => {
    setPage(1)
  }, [standId, status])

  useEffect(() => {
    if (!eventId || forbidden) return
    setLoading(true)
    load(page)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [load, page, eventId, forbidden])

  const handleHide = async (id: string) => {
    if (!eventId) return
    await updateReviewStatus(eventId, id, 'hidden')
    await load(page)
  }

  const handleUnhide = async (id: string) => {
    if (!eventId) return
    await updateReviewStatus(eventId, id, 'visible')
    await load(page)
  }

  const handleDelete = async (id: string) => {
    if (!eventId) return
    if (!window.confirm('Eliminare definitivamente questa recensione?')) return
    await deleteReview(eventId, id)
    await load(page)
  }

  if (forbidden) {
    return <div className={styles.page}>Non hai accesso alla moderazione delle recensioni.</div>
  }

  const standName = (id: string | null) => {
    if (!id) return 'Evento'
    return stands.find((s) => s.id === id)?.name ?? id
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Recensioni</h1>
          <p className={styles.subtitle}>{eventName}</p>
        </div>
        <div className={styles.toolbar}>
          <Link className={styles.printAllLink} to={`/admin/events/${eventId}/reviews/qrcodes`}>
            QR recensioni di tutti gli stand
          </Link>
          <QRCodeDownload apiPath={`/events/${eventId}/reviews/qrcode`} fileName="recensioni-evento" label="QR recensioni evento" />
          <QRCodeDownload
            apiPath={standId ? `/events/${eventId}/reviews/qrcode?standId=${standId}` : ''}
            fileName={`recensioni-stand-${standId}`}
            label="QR recensioni stand"
          />
        </div>
      </div>

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={standId}
          onChange={(e) => setStandId(e.target.value)}
          aria-label="Filtra per stand"
        >
          <option value="">Tutti gli stand (solo evento)</option>
          <option value="__event__">Recensioni evento</option>
          {stands.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | 'visible' | 'hidden')}
          aria-label="Filtra per stato"
        >
          <option value="">Tutti gli stati</option>
          <option value="visible">Visibili</option>
          <option value="hidden">Nascoste</option>
        </select>
      </div>

      {loading ? (
        <p className={styles.empty}>Caricamento…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Nessuna recensione trovata.</p>
      ) : (
        <div className={styles.list}>
          {items.map((r) => {
            const isHidden = r.status === 'hidden'
            return (
              <article key={r.id} className={`${styles.card} ${isHidden ? styles.hidden : ''}`}>
                <div className={styles.cardTop}>
                  <span className={styles.name}>{r.reviewerName ?? 'Anonimo'}</span>
                  <span className={styles.target}>{standName(r.standId)}</span>
                </div>

                <div className={styles.meta}>
                  <RatingStars value={r.rating} />
                  {r.isVerified && <span className={styles.badge}>Acquisto verificato</span>}
                  {r.hasGuest && <span className={styles.badge}>Anonimo</span>}
                  {isHidden && <span className={styles.badgeHidden}>Nascosta</span>}
                  <span className={styles.date}>
                    {new Date(r.createdAt).toLocaleDateString('it-IT')}
                  </span>
                </div>

                {r.comment && <p className={styles.comment}>{r.comment}</p>}

                {r.reviewerEmail && (
                  <p className={styles.email}>
                    <a href={`mailto:${r.reviewerEmail}`}>{r.reviewerEmail}</a>
                  </p>
                )}

                <div className={styles.actions}>
                  {isHidden ? (
                    <button className={styles.actionBtn} onClick={() => handleUnhide(r.id)}>
                      Mostra
                    </button>
                  ) : (
                    <button className={styles.actionBtn} onClick={() => handleHide(r.id)}>
                      Nascondi
                    </button>
                  )}
                  <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => handleDelete(r.id)}>
                    Elimina
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            &larr; Precedente
          </button>
          <span className={styles.pageInfo}>
            Pagina {page} di {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Successiva &rarr;
          </button>
        </div>
      )}
    </div>
  )
}