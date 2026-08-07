import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import { useAuth } from '../features/auth/auth-context'
import type { UploadedImage } from '../lib/upload'
import styles from './EventDetailPage.module.scss'
import cambioStyles from './EventExchangePage.module.scss'
import settlementStyles from './StandSettlementsPage.module.scss'

type SettlementStand = {
  standId: string
  standName: string
  earnedCredits: number
  settledCredits: number
}

type SettlementSummary = {
  eventId: string
  exchangeRate: number
  currencyName: string
  currencySymbol: UploadedImage | null
  stands: SettlementStand[]
}

type Settlement = {
  id: string
  eventId: string
  standId: string
  standName: string
  amount: number
  exchangeRate: number
  feePercent: number
  grossEuro: number
  feeEuro: number
  payoutEuro: number
  description: string | null
  performedByUserId: string | null
  performedByName: string | null
  occurredAt: string
}

type SettlementListResponse = {
  items: Settlement[]
  totals: { credits: number; payoutEuro: number; count: number }
  pagination: { page: number; totalPages: number; total: number; limit: number }
}

export function StandSettlementsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [summary, setSummary] = useState<SettlementSummary | null>(null)

  const [selectedStandId, setSelectedStandId] = useState('')
  const [amount, setAmount] = useState('')
  const [feePercent, setFeePercent] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [totals, setTotals] = useState<{ credits: number; payoutEuro: number; count: number }>({ credits: 0, payoutEuro: 0, count: 0 })
  const [txPage, setTxPage] = useState(1)
  const [txTotalPages, setTxTotalPages] = useState(1)

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
      const [sum, list] = await Promise.all([
        apiRequest<SettlementSummary>(`/exchange/${eventId}/settlements/summary`),
        apiRequest<SettlementListResponse>(`/exchange/${eventId}/settlements?page=${txPage}&limit=20`),
      ])
      setSummary(sum)
      setSettlements(list.items)
      setTotals(list.totals)
      setTxTotalPages(list.pagination.totalPages)
    } catch (err) {
      if ((err as { status?: number }).status === 403) {
        any403 = true
      }
    }
    if (any403) setForbidden(true)
    setLoading(false)
  }, [eventId, isAuthenticated, txPage])

  useEffect(() => { void fetchData() }, [fetchData])

  const rate = summary?.exchangeRate ?? 1
  const currencyName = summary?.currencyName ?? 'crediti'

  const selectedStand = summary?.stands.find((s) => s.standId === selectedStandId) ?? null
  const creditsNum = parseFloat(amount)
  const validAmount = Number.isFinite(creditsNum) && creditsNum > 0
  const feeNum = Number.isFinite(parseFloat(feePercent)) ? parseFloat(feePercent) : 0
  const grossEuro = validAmount ? Math.round(creditsNum / rate * 100) / 100 : 0
  const feeEuro = validAmount ? Math.round(grossEuro * (feeNum / 100) * 100) / 100 : 0
  const payoutEuro = validAmount ? Math.round((grossEuro - feeEuro) * 100) / 100 : 0

  const handleSelectStand = (standId: string) => {
    setSelectedStandId(standId)
    const stand = summary?.stands.find((s) => s.standId === standId)
    if (stand) {
      setAmount(String(stand.earnedCredits > 0 ? stand.earnedCredits : ''))
    } else {
      setAmount('')
    }
  }

  const handleSubmit = async () => {
    if (!eventId || !selectedStandId || !validAmount) return
    setSubmitting(true)
    try {
      const res = await apiRequest<{ item: Settlement }>(`/exchange/${eventId}/settlements`, {
        method: 'POST',
        bodyJson: {
          standId: selectedStandId,
          amount: creditsNum,
          feePercent: feeNum,
          description: description.trim() || undefined,
        }
      })
      setAmount('')
      setDescription('')
      setModal({
        open: true,
        variant: 'alert',
        title: 'Liquidazione completata',
        message: `${res.item.standName}: ${res.item.amount.toFixed(2)} ${currencyName} → €${res.item.payoutEuro.toFixed(2)} da corrispondere (€${res.item.grossEuro.toFixed(2)} lordi, ${res.item.feePercent}% trattenuta = €${res.item.feeEuro.toFixed(2)}).`
      })
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante la liquidazione' })
    } finally {
      setSubmitting(false)
    }
  }

  if (forbidden) {
    return (
      <div className={`page-shell ${styles.page}`}>
        <h1 className={styles.pageTitle}>Accesso negato</h1>
        <p>Non hai i permessi per accedere a questa pagina.</p>
        <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all'evento</Link>
      </div>
    )
  }

  return (
    <div className={`page-shell ${styles.page}`}>
      <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all'evento</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className={styles.pageTitle}>
          <CurrencyDisplay currencyName={currencyName} currencySymbol={summary?.currencySymbol ?? null} /> Liquidazione stand - {eventName || 'Caricamento...'}
        </h1>
        <Link to={`/events/${eventId}/settlements/report`} className={cambioStyles.btnTopUp} style={{ display: 'inline-block' }}>
          Resoconto liquidazioni
        </Link>
      </div>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <>
          <section className={cambioStyles.section}>
            <div className={settlementStyles.selectRow}>
              <label className={settlementStyles.field}>
                Stand
                <select
                  className={cambioStyles.userSelect}
                  value={selectedStandId}
                  onChange={(e) => handleSelectStand(e.target.value)}
                >
                  <option value="">-- Seleziona uno stand --</option>
                  {(summary?.stands ?? []).map((s) => (
                    <option key={s.standId} value={s.standId}>{s.standName}</option>
                  ))}
                </select>
              </label>
            </div>

            {selectedStand && (
              <div className={cambioStyles.cardRow}>
                <div className={cambioStyles.statCard}>
                  <div className={cambioStyles.statLabel}>Crediti guadagnati (report)</div>
                  <div className={cambioStyles.statValue}>{selectedStand.earnedCredits.toFixed(2)}</div>
                  <div className={cambioStyles.statSub}>Riferimento informativo dal report ordini</div>
                </div>
                <div className={cambioStyles.statCard}>
                  <div className={cambioStyles.statLabel}>Già liquidati</div>
                  <div className={cambioStyles.statValue}>{selectedStand.settledCredits.toFixed(2)}</div>
                  <div className={cambioStyles.statSub}>Totale crediti già erogati per questo stand</div>
                </div>
              </div>
            )}
          </section>

          {selectedStand && (
            <section className={cambioStyles.section}>
              <h2 className={styles.sectionTitle}>Nuova liquidazione</h2>
              <div className={settlementStyles.formGrid}>
                <div className={cambioStyles.formCard}>
                  <label className={cambioStyles.field}>
                    Importo presentato ({currencyName})
                    <input type="number" min="0.01" step="0.01" value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={submitting} />
                  </label>
                  <label className={cambioStyles.field}>
                    Percentuale trattenuta dal gestore (%) — default 0
                    <input type="number" min="0" max="100" step="0.1" value={feePercent}
                      onChange={(e) => setFeePercent(e.target.value)}
                      placeholder="0"
                      disabled={submitting} />
                  </label>
                  <label className={cambioStyles.field}>
                    Note (opzionale)
                    <input type="text" value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={submitting} />
                  </label>
                  <button className={cambioStyles.btnTopUp} onClick={handleSubmit}
                    disabled={!validAmount || submitting}>
                    {submitting ? 'Liquidazione in corso...' : `Liquida ${currencyName}`}
                  </button>
                </div>

                <div className={`${cambioStyles.formCard} ${settlementStyles.previewCard}`}>
                  <h3 className={settlementStyles.previewTitle}>Corrispettivo in euro</h3>
                  {!validAmount ? (
                    <p className={cambioStyles.preview}>Inserisci l'importo presentato per calcolare il corrispettivo.</p>
                  ) : (
                    <>
                      <div className={settlementStyles.previewRow}>
                        <span className={settlementStyles.previewLabel}>Lordo</span>
                        <span className={settlementStyles.previewValue}>€{grossEuro.toFixed(2)}</span>
                      </div>
                      <div className={settlementStyles.previewRow}>
                        <span className={settlementStyles.previewLabel}>Trattenuta ({feeNum.toFixed(1)}%)</span>
                        <span className={`${settlementStyles.previewValue} ${settlementStyles.previewFee}`}>- €{feeEuro.toFixed(2)}</span>
                      </div>
                      <div className={`${settlementStyles.previewRow} ${settlementStyles.previewTotal}`}>
                        <span className={settlementStyles.previewLabel}>Da corrispondere</span>
                        <span className={`${settlementStyles.previewValue} ${settlementStyles.previewPayout}`}>€{payoutEuro.toFixed(2)}</span>
                      </div>
                      <p className={settlementStyles.previewNote}>
                        {creditsNum.toFixed(2)} {currencyName} ÷ {rate} (cambio) × ({100 - feeNum}%)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className={styles.sectionTitle}>Storico liquidazioni</h2>
            {totals.count > 0 && (
              <div className={settlementStyles.totalsBar}>
                <span className={settlementStyles.totalsItem}>Liquidazioni: <strong>{totals.count}</strong></span>
                <span className={settlementStyles.totalsItem}>Crediti liquidati: <strong>{totals.credits.toFixed(2)}</strong></span>
                <span className={settlementStyles.totalsItem}>Totale erogato: <strong>€{totals.payoutEuro.toFixed(2)}</strong></span>
              </div>
            )}
            {settlements.length === 0 ? (
              <p className={styles.empty}>Nessuna liquidazione registrata.</p>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Data</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Stand</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Crediti</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Corso</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Lordo €</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>% gestore</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Trattenuta €</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Erogato €</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Operatore</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {new Date(s.occurredAt).toLocaleString('it-IT')}
                          </td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{s.standName}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{s.amount.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>1 € = {s.exchangeRate} {currencyName}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>€{s.grossEuro.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.feePercent.toFixed(1)}%</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-red)' }}>- €{s.feeEuro.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--color-green)' }}>€{s.payoutEuro.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{s.performedByName || '-'}</td>
                          <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden' }}>{s.description || '-'}</td>
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
