import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { useAuth } from '../features/auth/auth-context'
import styles from './EventDetailPage.module.scss'
import cambioStyles from './EventExchangePage.module.scss'

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
  realAmount: number | null
  balanceAfter: number
  description: string | null
  performedByUserId: string | null
  performedByName: string | null
  occurredAt: string
}

type BalanceSummary = {
  totalTopUp: number
  totalRefund: number
  netBalance: number
  topUpCount: number
  refundCount: number
  myTopUp: number
  myRefund: number
  myNetBalance: number
  myTopUpCount: number
  myRefundCount: number
  sinceResetTopUp: number
  sinceResetRefund: number
  netSinceReset: number
  mySinceResetTopUp: number
  mySinceResetRefund: number
  myNetSinceReset: number
  lastResetAt: string | null
  exchangeRate: number
  currencyName: string
  currencySymbol: string | null
}

function CurrencySymbol({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <span className={cambioStyles.currencyCircle} title={name}>
      {initial}
    </span>
  )
}

export function EventExchangePage() {
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
  const [selUserBalance, setSelUserBalance] = useState(0)
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
    let any403 = false
    try {
      const ev = await apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
      setEventName(ev.item.name)
    } catch { /* event name non essenziale */}
    try {
      const [bal, usrs, txs] = await Promise.all([
        apiRequest<BalanceSummary>(`/cambios/${eventId}/balance`),
        apiRequest<{ items: ExchangeUser[] }>(`/cambios/${eventId}/users`),
        apiRequest<{ items: Transaction[]; pagination: { page: number; totalPages: number } }>(`/cambios/${eventId}/transactions?page=${txPage}&limit=20`),
      ])
      setBalance(bal)
      setUsers(usrs.items)
      setTransactions(txs.items)
      setTxTotalPages(txs.pagination.totalPages)
    } catch (err) {
      if ((err as { status?: number }).status === 403) {
        any403 = true
      }
    }
    if (any403) setForbidden(true)
    setLoading(false)
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
      setSelUserBalance(res.newBalance)
      setTopUpAmount('')
      setTopUpDesc('')
      const rate = balance?.exchangeRate ?? 1
      const credits = amount * rate
      setModal({ open: true, variant: 'alert', title: 'Carico completato', message: `Caricati €${amount.toFixed(2)} → ${credits.toFixed(2)} ${balance?.currencyName ?? 'crediti'}. Nuovo saldo: ${res.newBalance}` })
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante il carico' })
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
      setSelUserBalance(res.newBalance)
      setRefundAmount('')
      setRefundDesc('')
      const rate = balance?.exchangeRate ?? 1
      const real = amount / rate
      setModal({ open: true, variant: 'alert', title: 'Rimborso completato', message: `Rimborsati ${amount.toFixed(2)} ${balance?.currencyName ?? 'crediti'} → €${real.toFixed(2)}. Nuovo saldo: ${res.newBalance}` })
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante il rimborso' })
    } finally {
      setSubmitting(null)
    }
  }

  const handleResetCashRegister = async () => {
    if (!eventId) return
    try {
      await apiRequest(`/cambios/${eventId}/reset-cash-register`, { method: 'POST' })
      fetchData()
    } catch { /* ignore */ }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)
  const rate = balance?.exchangeRate ?? 1
  const currencyName = balance?.currencyName ?? 'crediti'

  function fmt(v: number) { return v.toFixed(2) }
  function fmtEur(v: number) { return `€${v.toFixed(2)}` }

  if (forbidden) {
    return (
      <div className={`page-shell ${styles.page}`}>
        <h1 className={styles.pageTitle}>Accesso negato</h1>
        <p>Non hai i permessi per accedere a questa pagina.</p>
        <Link to={`/events/${eventId}`} className={styles.backBtn}>Torna all'evento</Link>
      </div>
    )
  }

  return (
    <div className={`page-shell ${styles.page}`}>
      <Link to={`/events/${eventId}`} className={styles.backBtn}>&larr; Torna all'evento</Link>
      <h1 className={styles.pageTitle}>
        <CurrencySymbol name={currencyName} /> Cambio - {eventName || 'Caricamento...'}
      </h1>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <>
          <section className={cambioStyles.section}>
            <h2 className={styles.sectionTitle}>Riepilogo cassa</h2>
            {balance && (
              <>
                <div className={cambioStyles.cardRow}>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>Tutte le postazioni — Carichi</div>
                    <div className={cambioStyles.statValue}>
                      <span className={cambioStyles.creditValue}>{fmt(balance.totalTopUp)}</span>
                      <span className={cambioStyles.eurValue}> ({fmtEur(balance.totalTopUp / rate)} equival.)</span>
                    </div>
                    <div className={cambioStyles.statSub}>({balance.topUpCount} operazioni)</div>
                  </div>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>Tutte le postazioni — Rimborsi</div>
                    <div className={`${cambioStyles.statValue} ${cambioStyles.statValueNegative}`}>
                      -{fmt(balance.totalRefund)}
                      <span className={cambioStyles.eurValue}> (-{fmtEur(balance.totalRefund / rate)} equival.)</span>
                    </div>
                    <div className={cambioStyles.statSub}>({balance.refundCount} operazioni)</div>
                  </div>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>Tutte le postazioni — Saldo netto</div>
                    <div className={cambioStyles.statValue}>
                      {fmt(balance.netBalance)}
                      <span className={cambioStyles.eurValue}> ({fmtEur(balance.netBalance / rate)})</span>
                    </div>
                  </div>
                </div>
                <div className={cambioStyles.cardRow}>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>Questa postazione — Carichi</div>
                    <div className={cambioStyles.statValue}>
                      {fmt(balance.myTopUp)}
                      <span className={cambioStyles.eurValue}> ({fmtEur(balance.myTopUp / rate)} equival.)</span>
                    </div>
                    <div className={cambioStyles.statSub}>({balance.myTopUpCount} operazioni)</div>
                  </div>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>Questa postazione — Rimborsi</div>
                    <div className={`${cambioStyles.statValue} ${cambioStyles.statValueNegative}`}>
                      -{fmt(balance.myRefund)}
                      <span className={cambioStyles.eurValue}> (-{fmtEur(balance.myRefund / rate)} equival.)</span>
                    </div>
                    <div className={cambioStyles.statSub}>({balance.myRefundCount} operazioni)</div>
                  </div>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>Questa postazione — Saldo netto</div>
                    <div className={cambioStyles.statValue}>
                      {fmt(balance.myNetBalance)}
                      <span className={cambioStyles.eurValue}> ({fmtEur(balance.myNetBalance / rate)})</span>
                    </div>
                  </div>
                </div>
                <div className={cambioStyles.cardRow}>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>Dall'ultimo azzeramento</div>
                    <div className={cambioStyles.statValue}>
                      {fmt(balance.netSinceReset)}
                      <span className={cambioStyles.eurValue}> ({fmtEur(balance.netSinceReset / rate)})</span>
                    </div>
                    <div className={cambioStyles.statSub}>{balance.lastResetAt ? `dal ${new Date(balance.lastResetAt).toLocaleString('it-IT')}` : 'Mai azzerato'}</div>
                  </div>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>&nbsp;</div>
                    <button className={styles.dangerBtn} onClick={handleResetCashRegister}>Azzerra cassa</button>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className={cambioStyles.section}>
            <h2 className={styles.sectionTitle}>Seleziona utente</h2>
            <select
              value={selectedUserId}
              className={cambioStyles.userSelect}
              onChange={(e) => {
                const uid = e.target.value
                setSelectedUserId(uid)
                const u = users.find((x) => x.id === uid)
                setSelUserBalance(u?.balance ?? 0)
              }}
            >
              <option value="">-- Seleziona --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.isAnonymous
                    ? `\u{1F464} Cliente generico (saldo: ${fmt(u.balance)})`
                    : `${u.firstName || ''} ${u.lastName || ''} (${u.email || ''}) - saldo: ${fmt(u.balance)}`}
                </option>
              ))}
            </select>

            {selectedUser && (
              <p className={cambioStyles.userInfo}>
                Saldo: <strong>{fmt(selUserBalance ?? selectedUser.balance)}</strong>
                <span className={cambioStyles.eurValue}> ({fmtEur((selUserBalance ?? selectedUser.balance) / rate)})</span>
                {selectedUser.isAnonymous && ' - Cliente generico'}
              </p>
            )}
          </section>

          <div className={cambioStyles.formGrid}>
            <section>
              <h2 className={styles.sectionTitle}>Carica (Reale &rarr; Virtuale)</h2>
              <div className={cambioStyles.formCard}>
                <label className={cambioStyles.field}>
                  Importo €
                  <input type="number" min="0.01" step="0.01" value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    disabled={!selectedUserId || submitting === 'topup'} />
                </label>
                {topUpAmount && parseFloat(topUpAmount) > 0 && (
                  <p className={cambioStyles.preview}>
                    ≈ {(parseFloat(topUpAmount) * rate).toFixed(2)} {currencyName}
                  </p>
                )}
                <label className={cambioStyles.field}>
                  Note (opzionale)
                  <input type="text" value={topUpDesc}
                    onChange={(e) => setTopUpDesc(e.target.value)}
                    disabled={!selectedUserId || submitting === 'topup'} />
                </label>
                <button className={cambioStyles.btnTopUp} onClick={handleTopUp}
                  disabled={!selectedUserId || !topUpAmount || submitting === 'topup'}>
                  {submitting === 'topup' ? 'Caricamento...' : `Carica €`}
                </button>
              </div>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>Rimborsa (Virtuale &rarr; Reale)</h2>
              <div className={cambioStyles.formCard}>
                <label className={cambioStyles.field}>
                  Importo {currencyName}
                  <input type="number" min="0.01" step="0.01" value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    disabled={!selectedUserId || submitting === 'refund'} />
                </label>
                {refundAmount && parseFloat(refundAmount) > 0 && (
                  <p className={cambioStyles.preview}>
                    ≈ €{(parseFloat(refundAmount) / rate).toFixed(2)}
                  </p>
                )}
                <label className={cambioStyles.field}>
                  Note (opzionale)
                  <input type="text" value={refundDesc}
                    onChange={(e) => setRefundDesc(e.target.value)}
                    disabled={!selectedUserId || submitting === 'refund'} />
                </label>
                <button className={cambioStyles.btnRefund} onClick={handleRefund}
                  disabled={!selectedUserId || !refundAmount || submitting === 'refund'}>
                  {submitting === 'refund' ? 'Rimborso in corso...' : `Rimborsa ${currencyName}`}
                </button>
              </div>
            </section>
          </div>

          <section>
            <h2 className={styles.sectionTitle}>Storico transazioni</h2>
            {transactions.length === 0 ? (
              <p className={styles.empty}>Nessuna transazione di cambio registrata.</p>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Data</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tipo</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Importo {currencyName}</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Equivalente €</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Saldo dopo</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Operatore</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {new Date(tx.occurredAt).toLocaleString('it-IT')}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {tx.type === 'top-up' ? 'Carico' : 'Rimborso'}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: tx.type === 'top-up' ? 'var(--color-green)' : 'var(--color-red)' }}>
                            {tx.type === 'top-up' ? '+' : '-'}{fmt(tx.amount)}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                            {tx.realAmount != null ? fmtEur(tx.realAmount) : '-'}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            {fmt(tx.balanceAfter)}
                          </td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {tx.performedByName || '-'}
                          </td>
                          <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden' }}>
                            {tx.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {txTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className={styles.textBtn} disabled={txPage <= 1} onClick={() => setTxPage((p) => Math.max(1, p - 1))}>
                      Precedente
                    </button>
                    <span style={{ padding: '0.25rem 0.5rem' }}>{txPage} / {txTotalPages}</span>
                    <button className={styles.textBtn} disabled={txPage >= txTotalPages} onClick={() => setTxPage((p) => p + 1)}>
                      Successivo
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