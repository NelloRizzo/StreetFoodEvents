import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { useAuth } from '../features/auth/auth-context'
import styles from './EventDetailPage.module.scss'

type ExchangeUser = {
  id: string
  eventId: string
  userId: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  balance: number
  isAnonymous: boolean
  isActive: boolean
  joinedAt: string
}

type Transaction = {
  id: string
  eventUserId: string
  eventId: string
  userId: string | null
  type: string
  direction: string
  amount: number
  balanceAfter: number
  description: string | null
  performedByUserId: string | null
  occurredAt: string
}

type BalanceSummary = {
  totalTopUp: number
  totalRefund: number
  netBalance: number
  topUpCount: number
  refundCount: number
  currencyName: string
  currencySymbol: string | null
}

export function EventCambioPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [balance, setBalance] = useState<BalanceSummary | null>(null)
  const [users, setUsers] = useState<ExchangeUser[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txPage, setTxPage] = useState(1)
  const [txTotalPages, setTxTotalPages] = useState(1)

  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUserBalance, setSelectedUserBalance] = useState(0)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpDesc, setTopUpDesc] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDesc, setRefundDesc] = useState('')
  const [submitting, setSubmitting] = useState<'topup' | 'refund' | null>(null)
  const [modal, setModal] = useState<{ open: boolean; variant: 'confirm' | 'alert'; title: string; message: string }>({
    open: false, variant: 'alert', title: '', message: ''
  })

  const fetchData = useCallback(async () => {
    if (!eventId || !isAuthenticated) return
    setLoading(true)
    try {
      const [ev, bal, usrs, txs] = await Promise.all([
        apiRequest<{ name: string }>(`/events/${eventId}`),
        apiRequest<BalanceSummary>(`/cambios/${eventId}/balance`),
        apiRequest<{ items: ExchangeUser[] }>(`/cambios/${eventId}/users`),
        apiRequest<{ items: Transaction[]; pagination: { page: number; totalPages: number } }>(`/cambios/${eventId}/transactions?page=${txPage}&limit=20`),
      ])
      setEventName(ev.name)
      setBalance(bal)
      setUsers(usrs.items)
      setTransactions(txs.items)
      setTxTotalPages(txs.pagination.totalPages)
    } catch (err) {
      if ((err as { status?: number }).status === 403) {
        setForbidden(true)
      }
    } finally {
      setLoading(false)
    }
  }, [eventId, isAuthenticated, txPage])

  useEffect(() => { fetchData() }, [fetchData])

  const handleTopUp = async () => {
    if (!eventId || !selectedUserId || !topUpAmount) return
    const amount = parseFloat(topUpAmount)
    if (!amount || amount <= 0) return
    setSubmitting('topup')
    try {
      const res = await apiRequest<{ newBalance: number }>(`/cambios/${eventId}/top-up`, {
        method: 'POST',
        bodyJson: { eventUserId: selectedUserId, amount, description: topUpDesc.trim() || undefined }
      })
      setSelectedUserBalance(res.newBalance)
      setTopUpAmount('')
      setTopUpDesc('')
      setModal({ open: true, variant: 'alert', title: 'Top-up effettuato', message: `Caricati ${amount} crediti. Nuovo saldo: ${res.newBalance}` })
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante il top-up' })
    } finally {
      setSubmitting(null)
    }
  }

  const handleRefund = async () => {
    if (!eventId || !selectedUserId || !refundAmount) return
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) return
    setSubmitting('refund')
    try {
      const res = await apiRequest<{ newBalance: number }>(`/cambios/${eventId}/refund`, {
        method: 'POST',
        bodyJson: { eventUserId: selectedUserId, amount, description: refundDesc.trim() || undefined }
      })
      setSelectedUserBalance(res.newBalance)
      setRefundAmount('')
      setRefundDesc('')
      setModal({ open: true, variant: 'alert', title: 'Rimborso effettuato', message: `Rimborsati ${amount} crediti. Nuovo saldo: ${res.newBalance}` })
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante il rimborso' })
    } finally {
      setSubmitting(null)
    }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)
  const symbol = balance?.currencySymbol || ''

  if (forbidden) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Accesso negato</h1>
        <p>Non hai i permessi per accedere a questa pagina.</p>
        <Link to={`/events/${eventId}`} className={styles.backBtn}>Torna all'evento</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Link to={`/events/${eventId}`} className={styles.backBtn}>&larr; Torna all'evento</Link>
      <h1 className={styles.pageTitle}>Cambio - {eventName || 'Caricamento...'}</h1>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <>
          <section style={{ marginBottom: '2rem' }}>
            <h2 className={styles.sectionTitle}>Riepilogo cassa</h2>
            {balance && (
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: '8px', minWidth: '160px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-weak)' }}>Totale carichi</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-green)' }}>{symbol}{balance.totalTopUp.toFixed(2)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-weak)' }}>({balance.topUpCount} operazioni)</div>
                </div>
                <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: '8px', minWidth: '160px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-weak)' }}>Totale rimborsi</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-red)' }}>-{symbol}{balance.totalRefund.toFixed(2)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-weak)' }}>({balance.refundCount} operazioni)</div>
                </div>
                <div style={{ background: 'var(--color-surface)', padding: '1rem', borderRadius: '8px', minWidth: '160px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-weak)' }}>Saldo netto cassa</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: balance.netBalance >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{symbol}{balance.netBalance.toFixed(2)}</div>
                </div>
              </div>
            )}
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 className={styles.sectionTitle}>Seleziona utente</h2>
            <select
              value={selectedUserId}
              onChange={(e) => {
                const uid = e.target.value
                setSelectedUserId(uid)
                const u = users.find((x) => x.id === uid)
                setSelectedUserBalance(u?.balance ?? 0)
              }}
              style={{ width: '100%', maxWidth: '400px', padding: '0.5rem', fontSize: '1rem' }}
            >
              <option value="">-- Seleziona --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.isAnonymous
                    ? `\u{1F464} Cliente generico (saldo: ${symbol}${u.balance})`
                    : `${u.firstName || ''} ${u.lastName || ''} (${u.email || ''}) - saldo: ${symbol}${u.balance}`}
                </option>
              ))}
            </select>

            {selectedUser && (
              <p style={{ marginTop: '0.5rem', color: 'var(--color-ink-weak)' }}>
                Saldo corrente: <strong>{symbol}{(selectedUserBalance ?? selectedUser.balance).toFixed(2)}</strong>
                {selectedUser.isAnonymous && ' - Cliente generico'}
              </p>
            )}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <section>
              <h2 className={styles.sectionTitle}>Carica crediti (Reale &rarr; Virtuale)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--color-surface)', padding: '1rem', borderRadius: '8px' }}>
                <label>
                  Importo
                  <input type="number" min="0.01" step="0.01" value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    disabled={!selectedUserId || submitting === 'topup'}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', marginTop: '0.25rem' }} />
                </label>
                <label>
                  Causale (opzionale)
                  <input type="text" value={topUpDesc}
                    onChange={(e) => setTopUpDesc(e.target.value)}
                    disabled={!selectedUserId || submitting === 'topup'}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', marginTop: '0.25rem' }} />
                </label>
                <button className={styles.saveBtn} onClick={handleTopUp}
                  disabled={!selectedUserId || !topUpAmount || submitting === 'topup'}>
                  {submitting === 'topup' ? 'Caricamento...' : `Carica ${symbol}`}
                </button>
              </div>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Rimborsa crediti (Virtuale &rarr; Reale)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--color-surface)', padding: '1rem', borderRadius: '8px' }}>
                <label>
                  Importo
                  <input type="number" min="0.01" step="0.01" value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    disabled={!selectedUserId || submitting === 'refund'}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', marginTop: '0.25rem' }} />
                </label>
                <label>
                  Causale (opzionale)
                  <input type="text" value={refundDesc}
                    onChange={(e) => setRefundDesc(e.target.value)}
                    disabled={!selectedUserId || submitting === 'refund'}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', marginTop: '0.25rem' }} />
                </label>
                <button className={styles.dangerBtn} onClick={handleRefund}
                  disabled={!selectedUserId || !refundAmount || submitting === 'refund'}>
                  {submitting === 'refund' ? 'Rimborso...' : `Rimborsa ${symbol}`}
                </button>
              </div>
            </section>
          </div>

          <section>
            <h2 className={styles.sectionTitle}>Storico operazioni</h2>
            {transactions.length === 0 ? (
              <p className={styles.empty}>Nessuna operazione di cambio effettuata.</p>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Data</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tipo</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Importo</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Saldo dopo</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Causale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                          {new Date(tx.occurredAt).toLocaleString('it-IT')}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {tx.type === 'top-up' ? 'Carica' : 'Rimborso'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: tx.type === 'top-up' ? 'var(--color-green)' : 'var(--color-red)' }}>
                          {tx.type === 'top-up' ? '+' : '-'}{symbol}{tx.amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          {symbol}{tx.balanceAfter.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {txTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className={styles.textBtn} disabled={txPage <= 1} onClick={() => setTxPage((p) => Math.max(1, p - 1))}>
                      Precedente
                    </button>
                    <span style={{ padding: '0.25rem 0.5rem' }}>{txPage} / {txTotalPages}</span>
                    <button className={styles.textBtn} disabled={txPage >= txTotalPages} onClick={() => setTxPage((p) => p + 1)}>
                      Successiva
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      <ConfirmModal
        open={modal.open}
        variant={modal.variant}
        title={modal.title}
        message={modal.message}
        confirmLabel="OK"
        onConfirm={() => setModal((prev) => ({ ...prev, open: false }))}
        onCancel={() => setModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
