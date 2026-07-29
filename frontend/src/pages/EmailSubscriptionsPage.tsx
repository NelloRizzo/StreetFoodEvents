import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import styles from './EmailSubscriptionsPage.module.scss'

type Subscription = {
  id: string
  email: string
  eventId: string | null
  displayName: string | null
  source: string
  marketingConsent: boolean
  consentTimestamp: string
  isActive: boolean
  unsubscribedAt: string | null
  createdAt: string
  updatedAt: string
}

export function EmailSubscriptionsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Subscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterActive, setFilterActive] = useState('')
  const [filterConsent, setFilterConsent] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (filterActive) params.set('isActive', filterActive)
    if (filterConsent) params.set('marketingConsent', filterConsent)
    if (search) params.set('search', search)
    try {
      const data = await apiRequest<{ items: Subscription[]; pagination: { page: number; totalPages: number; total: number } }>(
        `/email-subscriptions?${params.toString()}`
      )
      setItems(data.items)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch { /* ignore */ }
  }, [page, filterActive, filterConsent, search])

  useEffect(() => { setIsLoading(false) }, [])
  useEffect(() => { void load() }, [load])

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filterActive) params.set('isActive', filterActive)
    if (filterConsent) params.set('marketingConsent', filterConsent)
    if (search) params.set('search', search)
    const qs = params.toString()
    window.open(`/api/email-subscriptions/export/csv${qs ? `?${qs}` : ''}`, '_blank')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa iscrizione?')) return
    try {
      await apiRequest(`/email-subscriptions/${id}`, { method: 'DELETE' })
      void load()
    } catch { /* ignore */ }
  }

  if (!user?.isAdmin) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <h1 className={styles.title}>Iscrizioni email</h1>
          <button className={styles.exportBtn} onClick={handleExport}>
            Scarica CSV
          </button>
        </div>

        <div className={styles.filterBar}>
          <input
            type="text"
            placeholder="Cerca email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className={styles.searchInput}
          />
          <select value={filterActive} onChange={(e) => { setFilterActive(e.target.value); setPage(1) }}>
            <option value="">Tutti gli stati</option>
            <option value="true">Attive</option>
            <option value="false">Disattive</option>
          </select>
          <select value={filterConsent} onChange={(e) => { setFilterConsent(e.target.value); setPage(1) }}>
            <option value="">Tutti i consensi</option>
            <option value="true">Consenso marketing</option>
            <option value="false">Nessun consenso</option>
          </select>
          <span className={styles.count}>{total} iscrizioni</span>
        </div>

        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span className={styles.colEmail}>Email</span>
            <span className={styles.colSource}>Origine</span>
            <span className={styles.colConsent}>Consenso</span>
            <span className={styles.colActive}>Stato</span>
            <span className={styles.colDate}>Data</span>
            <span className={styles.colActions}></span>
          </div>
          {items.length === 0 && <p className={styles.empty}>Nessuna iscrizione trovata.</p>}
          {items.map((s) => (
            <div key={s.id} className={styles.row}>
              <span className={styles.colEmail}>{s.email}</span>
              <span className={styles.colSource}>{s.source}</span>
              <span className={styles.colConsent}>
                <span className={`${styles.badge} ${s.marketingConsent ? styles.badgeYes : styles.badgeNo}`}>
                  {s.marketingConsent ? 'Sì' : 'No'}
                </span>
              </span>
              <span className={styles.colActive}>
                <span className={`${styles.badge} ${s.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                  {s.isActive ? 'Attiva' : 'Disattiva'}
                </span>
              </span>
              <span className={styles.colDate}>{new Date(s.createdAt).toLocaleDateString('it-IT')}</span>
              <span className={styles.colActions}>
                <button className={styles.deleteBtn} onClick={() => handleDelete(s.id)} title="Elimina">
                  &#10005;
                </button>
              </span>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Precedente</button>
            <span>{page} di {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Successiva</button>
          </div>
        )}
      </div>
    </div>
  )
}
