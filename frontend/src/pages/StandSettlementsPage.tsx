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

type SettlementDirection = 'debit' | 'credit'
type SettlementUnit = 'credits' | 'euro'

type EventDenomination = { label: string; value: number; quantity: number }
type EventFeeBand = { maxAmount: number; feePercent: number; feeFlat: number }

type SettlementStand = {
  standId: string
  standName: string
  earnedCredits: number
  loadedCredits: number
  settledCredits: number
  toReturnCredits: number
  loadedEuro: number
  settledEuro: number
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
  direction: SettlementDirection
  unit: SettlementUnit
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
  totals: { loadedCredits: number; settledCredits: number; loadedEuro: number; settledEuro: number; payoutEuro: number; count: number }
  pagination: { page: number; totalPages: number; total: number; limit: number }
}

type DenominationReportItem = {
  label: string
  value: number
  issued: number
  returned: number
  returnedEuro: number
  lost: number
  anomaly: boolean
}

export function StandSettlementsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [summary, setSummary] = useState<SettlementSummary | null>(null)

  const [selectedStandId, setSelectedStandId] = useState('')
  const [direction, setDirection] = useState<SettlementDirection>('credit')
  const [unit, setUnit] = useState<SettlementUnit>('credits')
  const [amount, setAmount] = useState('')
  const [feePercent, setFeePercent] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [eventDenoms, setEventDenoms] = useState<EventDenomination[]>([])
  const [eventFeeBands, setEventFeeBands] = useState<EventFeeBand[]>([])
  const [standFeeOverride, setStandFeeOverride] = useState<{ feePercent: number | null; feeFlat: number | null } | null>(null)
  const [denomCounts, setDenomCounts] = useState<Record<string, string>>({})
  const [denomReport, setDenomReport] = useState<DenominationReportItem[]>([])
  const [showDenomReport, setShowDenomReport] = useState(false)
  const [feePrefilled, setFeePrefilled] = useState(false)

  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [totals, setTotals] = useState<{ loadedCredits: number; settledCredits: number; loadedEuro: number; settledEuro: number; payoutEuro: number; count: number }>({ loadedCredits: 0, settledCredits: 0, loadedEuro: 0, settledEuro: 0, payoutEuro: 0, count: 0 })
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
      const ev = await apiRequest<{ item: { name: string; denominations?: EventDenomination[]; feeBands?: EventFeeBand[] } }>(`/events/${eventId}`)
      setEventDenoms(ev.item.denominations ?? [])
      setEventFeeBands(ev.item.feeBands ?? [])
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

  const hasDenoms = eventDenoms.length > 0
  const denomTotalCredits = hasDenoms
    ? eventDenoms.reduce((sum, d) => {
        const count = parseFloat(denomCounts[d.label] ?? '0')
        return sum + (Number.isFinite(count) ? count : 0) * d.value
      }, 0)
    : 0

  const isEuro = unit === 'euro'
  const inputNum = parseFloat(amount)
  const creditsNum = !isEuro && hasDenoms && direction === 'credit' ? denomTotalCredits : inputNum
  const validAmount = Number.isFinite(creditsNum) && creditsNum > 0
  const isCredit = direction === 'credit'
  const grossEuro = isCredit && validAmount
    ? (isEuro ? Math.round(creditsNum * 100) / 100 : Math.round(creditsNum / rate * 100) / 100)
    : 0

  const resolveFee = (ge: number): string => {
    if (standFeeOverride?.feePercent != null) return String(standFeeOverride.feePercent)
    const matchingBand = [...eventFeeBands].sort((a, b) => a.maxAmount - b.maxAmount).find((b) => ge <= b.maxAmount)
    if (matchingBand) return String(matchingBand.feePercent)
    return ''
  }

  const feeNum = isCredit && !isEuro && Number.isFinite(parseFloat(feePercent)) ? parseFloat(feePercent) : 0
  const feeEuro = isCredit && !isEuro && validAmount ? Math.round(grossEuro * (feeNum / 100) * 100) / 100 : 0
  const payoutEuro = isCredit && validAmount ? Math.round((grossEuro - feeEuro) * 100) / 100 : 0

  useEffect(() => {
    if (isEuro || !hasDenoms || !isCredit || denomTotalCredits <= 0) return
    const ge = Math.round(denomTotalCredits / rate * 100) / 100
    const resolved = resolveFee(ge)
    if (resolved !== feePercent) {
      setFeePercent(resolved)
      setFeePrefilled(resolved !== '')
    }
  }, [denomCounts, hasDenoms, isCredit, denomTotalCredits, rate])

  const switchUnit = (next: SettlementUnit) => {
    if (next === unit) return
    setUnit(next)
    setAmount('')
    setDenomCounts({})
  }

  const handleSelectStand = async (standId: string) => {
    setSelectedStandId(standId)
    setDenomCounts({})
    setFeePrefilled(false)
    const stand = summary?.stands.find((s) => s.standId === standId)
    if (stand) {
      setAmount(!isEuro && isCredit && stand.earnedCredits > 0 ? String(stand.earnedCredits) : '')
    } else {
      setAmount('')
    }
    if (eventId && standId) {
      try {
        const standData = await apiRequest<{ item: { numbers?: Array<{ eventId: string; feePercent: number | null; feeFlat: number | null }> } }>(`/stands/${standId}`)
        const num = standData.item.numbers?.find((n) => n.eventId === eventId)
        setStandFeeOverride(num ? { feePercent: num.feePercent, feeFlat: num.feeFlat } : null)
      } catch {
        setStandFeeOverride(null)
      }
    }
  }

  const handleSubmit = async () => {
    if (!eventId || !selectedStandId || !validAmount) return
    setSubmitting(true)
    try {
      const denominationsPayload = (!isEuro && isCredit && hasDenoms)
        ? eventDenoms
            .filter((d) => {
              const count = parseFloat(denomCounts[d.label] ?? '0')
              return Number.isFinite(count) && count > 0
            })
            .map((d) => ({
              label: d.label,
              value: d.value,
              count: parseFloat(denomCounts[d.label] ?? '0'),
            }))
        : undefined

      const res = await apiRequest<{ item: Settlement }>(`/exchange/${eventId}/settlements`, {
        method: 'POST',
        bodyJson: {
          standId: selectedStandId,
          amount: creditsNum,
          direction,
          unit,
          feePercent: feeNum,
          description: description.trim() || undefined,
          denominations: denominationsPayload,
        }
      })
      setAmount('')
      setDescription('')
      setModal({
        open: true,
        variant: 'alert',
        title: !isCredit
          ? (isEuro ? 'Credito da esigere registrato' : 'Carico crediti registrato')
          : (isEuro ? 'Voce AVERE in euro registrata' : 'Liquidazione completata'),
        message: !isCredit && isEuro
          ? `${res.item.standName}: credito da esigere di €${res.item.amount.toFixed(2)} — nessun movimento di cassa ora.`
          : isEuro
            ? `${res.item.standName}: pagati €${res.item.payoutEuro.toFixed(2)} (voce contabile in euro, senza conversione).`
            : isCredit
              ? `${res.item.standName}: ${res.item.amount.toFixed(2)} ${currencyName} → €${res.item.payoutEuro.toFixed(2)} da corrispondere (€${res.item.grossEuro.toFixed(2)} lordi, ${res.item.feePercent}% trattenuta = €${res.item.feeEuro.toFixed(2)}).`
              : `${res.item.standName}: caricati ${res.item.amount.toFixed(2)} ${currencyName} da restituire in fase di liquidazione (nessun pagamento in euro).`
      })
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante l\'operazione' })
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
      <Link to={`/events/${eventId}`} className={`${styles.backLink} ${settlementStyles.noPrint}`}>&larr; Torna all'evento</Link>
      <div className={settlementStyles.printHeader}>
        <h2>Liquidazione stand — {eventName}</h2>
        <p>Elenco transazioni registrate · stampa del {new Date().toLocaleString('it-IT')}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className={styles.pageTitle}>
          <CurrencyDisplay currencyName={currencyName} currencySymbol={summary?.currencySymbol ?? null} /> Liquidazione stand - {eventName || 'Caricamento...'}
        </h1>
        <Link to={`/admin/events/${eventId}/settlements/report`} className={`${cambioStyles.btnTopUp} ${settlementStyles.noPrint}`} style={{ display: 'inline-block' }}>
          Resoconto liquidazioni
        </Link>
      </div>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <>
          <section className={`${cambioStyles.section} ${settlementStyles.noPrint}`}>
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
                  <div className={cambioStyles.statLabel}>Caricati allo stand (DARE)</div>
                  <div className={cambioStyles.statValue}>{selectedStand.loadedCredits.toFixed(2)}</div>
                  <div className={cambioStyles.statSub}>Crediti dati allo stand, da restituire</div>
                </div>
                <div className={cambioStyles.statCard}>
                  <div className={cambioStyles.statLabel}>Liquidati (AVERE)</div>
                  <div className={cambioStyles.statValue}>{selectedStand.settledCredits.toFixed(2)}</div>
                  <div className={cambioStyles.statSub}>Crediti restituiti dallo stand</div>
                </div>
                <div className={cambioStyles.statCard}>
                  <div className={cambioStyles.statLabel}>Da restituire</div>
                  <div className={cambioStyles.statValue}>{selectedStand.toReturnCredits.toFixed(2)}</div>
                  <div className={cambioStyles.statSub}>DARE − AVERE</div>
                </div>
                <div className={cambioStyles.statCard}>
                  <div className={cambioStyles.statLabel}>Da esigere € (DARE)</div>
                  <div className={cambioStyles.statValue}>€{selectedStand.loadedEuro.toFixed(2)}</div>
                  <div className={cambioStyles.statSub}>Voci contabili in euro</div>
                </div>
                <div className={cambioStyles.statCard}>
                  <div className={cambioStyles.statLabel}>Da saldare € (AVERE)</div>
                  <div className={cambioStyles.statValue}>€{selectedStand.settledEuro.toFixed(2)}</div>
                  <div className={cambioStyles.statSub}>Pagamenti diretti in euro</div>
                </div>
              </div>
            )}
          </section>

          {selectedStand && (
            <section className={`${cambioStyles.section} ${settlementStyles.noPrint}`}>
              <h2 className={styles.sectionTitle}>Nuova operazione</h2>
              <div className={settlementStyles.formGrid}>
                <div className={cambioStyles.formCard}>
                  <div className={settlementStyles.directionToggle}>
                    <button
                      type="button"
                      className={`${settlementStyles.directionBtn} ${isCredit ? settlementStyles.directionCreditActive : ''}`}
                      onClick={() => setDirection('credit')}
                      disabled={submitting}
                    >
                      AVERE &middot; Pago lo stand
                    </button>
                    <button
                      type="button"
                      className={`${settlementStyles.directionBtn} ${!isCredit ? settlementStyles.directionDebitActive : ''}`}
                      onClick={() => setDirection('debit')}
                      disabled={submitting}
                    >
                      DARE &middot; Carico allo stand
                    </button>
                  </div>
                  <p style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--color-text-muted)', margin: '0 0 0.9rem', padding: '0.5rem 0.7rem', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <strong>AVERE</strong> = denaro che esce dalla cassa verso lo standista (liquidazione crediti o pagamento diretto).<br />
                    <strong>DARE</strong> = valore che lo stand deve al gestore (crediti consegnati da restituire, oppure debito in euro).
                  </p>
                  <div className={settlementStyles.directionToggle}>
                    <button
                      type="button"
                      className={`${settlementStyles.directionBtn} ${!isEuro ? settlementStyles.unitActive : ''}`}
                      onClick={() => switchUnit('credits')}
                      disabled={submitting}
                    >
                      In crediti ({currencyName})
                    </button>
                    <button
                      type="button"
                      className={`${settlementStyles.directionBtn} ${isEuro ? settlementStyles.unitActive : ''}`}
                      onClick={() => switchUnit('euro')}
                      disabled={submitting}
                    >
                      In euro (€)
                    </button>
                  </div>
                  {hasDenoms && isCredit && !isEuro ? (
                    <div className={cambioStyles.field}>
                      <span style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>Tagli restituiti dallo stand</span>
                      {eventDenoms.map((d) => {
                        const count = parseFloat(denomCounts[d.label] ?? '0')
                        const countNum = Number.isFinite(count) ? count : 0
                        const sub = countNum * d.value
                        return (
                          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <span style={{ flex: 2, fontSize: '0.85rem' }}>{d.label}</span>
                            <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>€{d.value.toFixed(2)} cad.</span>
                            <span style={{ width: 60 }}>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={denomCounts[d.label] ?? ''}
                                onChange={(e) => setDenomCounts((prev) => ({ ...prev, [d.label]: e.target.value }))}
                                placeholder="0"
                                disabled={submitting}
                                style={{ width: '100%', textAlign: 'right' }}
                              />
                            </span>
                            <span style={{ flex: 1, textAlign: 'right', fontSize: '0.85rem', fontWeight: 500 }}>
                              {countNum > 0 ? `${countNum} × ${d.value.toFixed(2)} = ${sub.toFixed(2)} ${currencyName}` : '—'}
                            </span>
                          </div>
                        )
                      })}
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                        Totale: <strong>{denomTotalCredits.toFixed(2)} {currencyName}</strong> = €{grossEuro.toFixed(2)} lordo
                        {feePrefilled && <span> — Fee pre-compilata dal sistema ({feePercent}%)</span>}
                      </p>
                    </div>
                  ) : (
                    <label className={cambioStyles.field}>
                      {isEuro
                        ? 'Importo (€)'
                        : isCredit ? `Importo presentato (${currencyName})` : `Crediti da caricare (${currencyName})`}
                      <input type="number" min="0.01" step="0.01" value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={submitting} />
                    </label>
                  )}
                  {isCredit && !isEuro && (
                    <label className={cambioStyles.field}>
                      Percentuale trattenuta dal gestore (%) — default 0
                      <input type="number" min="0" max="100" step="0.1" value={feePercent}
                        onChange={(e) => setFeePercent(e.target.value)}
                        placeholder="0"
                        disabled={submitting} />
                    </label>
                  )}
                  <label className={cambioStyles.field}>
                    Note (opzionale)
                    <input type="text" value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={submitting} />
                  </label>
                  <button className={cambioStyles.btnTopUp} onClick={handleSubmit}
                    disabled={!validAmount || submitting}>
                    {submitting
                      ? 'Registrazione in corso...'
                      : !isCredit && isEuro
                        ? 'Registra addebito in euro allo stand'
                        : isEuro
                          ? 'Registra pagamento in euro allo stand'
                          : (isCredit ? 'Registra liquidazione (paga lo stand)' : 'Carica crediti allo stand (da restituire)')}
                  </button>
                </div>

                <div className={`${cambioStyles.formCard} ${settlementStyles.previewCard}`}>
                  {isCredit ? (
                    isEuro ? (
                      <>
                        <h3 className={settlementStyles.previewTitle}>Pagamento diretto in euro</h3>
                        {!validAmount ? (
                          <p className={cambioStyles.preview}>Inserisci l'importo in euro da registrare.</p>
                        ) : (
                          <>
                            <div className={`${settlementStyles.previewRow} ${settlementStyles.previewTotal}`}>
                              <span className={settlementStyles.previewLabel}>Da corrispondere</span>
                              <span className={`${settlementStyles.previewValue} ${settlementStyles.previewPayout}`}>€{creditsNum.toFixed(2)}</span>
                            </div>
                            <p className={settlementStyles.previewNote}>
                              Voce contabile in euro: nessuna conversione dai crediti, nessuna trattenuta.
                            </p>
                          </>
                        )}
                      </>
                    ) : (
                      <>
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
                      </>
                    )
                  ) : isEuro ? (
                    <>
                      <h3 className={settlementStyles.previewTitle}>Credito da esigere</h3>
                      <p className={cambioStyles.preview}>
                        Lo stand deve €{validAmount ? creditsNum.toFixed(2) : '__'}: nessun movimento di cassa ora.
                      </p>
                      <p className={settlementStyles.previewNote}>
                        Chiudere il debito con operazioni AVERE (anche parziali) nello stesso importo.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className={settlementStyles.previewTitle}>Nessun corrispettivo in euro</h3>
                      <p className={cambioStyles.preview}>
                        I crediti caricati allo stand vanno restituiti in fase di liquidazione (AVERE).
                      </p>
                      <p className={settlementStyles.previewNote}>
                        {validAmount
                          ? `${creditsNum.toFixed(2)} ${currencyName} da restituire.`
                          : "Inserisci l'importo da caricare."}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }} className={settlementStyles.noPrint}>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Storico liquidazioni</h2>
              <button className={styles.textBtn} onClick={() => window.print()} disabled={settlements.length === 0}>
                Stampa elenco transazioni
              </button>
            </div>
            {totals.count > 0 && (
              <div className={settlementStyles.totalsBar}>
                <span className={settlementStyles.totalsItem}>Operazioni: <strong>{totals.count}</strong></span>
                <span className={settlementStyles.totalsItem}>Caricati (DARE): <strong>{totals.loadedCredits.toFixed(2)}</strong></span>
                <span className={settlementStyles.totalsItem}>Liquidati (AVERE): <strong>{totals.settledCredits.toFixed(2)}</strong></span>
                {totals.loadedEuro !== 0 && (
                  <span className={settlementStyles.totalsItem}>Voci € DARE: <strong>€{totals.loadedEuro.toFixed(2)}</strong></span>
                )}
                {totals.settledEuro !== 0 && (
                  <span className={settlementStyles.totalsItem}>Voci € AVERE: <strong>€{totals.settledEuro.toFixed(2)}</strong></span>
                )}
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
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tipo</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Importo</th>
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
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {s.direction === 'debit'
                              ? <span className={settlementStyles.badgeDebit}>{s.unit === 'euro' ? 'DARE · Voce €' : 'DARE · Carico'}</span>
                              : <span className={settlementStyles.badgeCredit}>{s.unit === 'euro' ? 'AVERE · Voce €' : 'AVERE · Liquidazione'}</span>}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                            {s.unit === 'euro' ? `€${s.amount.toFixed(2)}` : s.amount.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                            {s.unit === 'euro' ? '—' : `1 € = ${s.exchangeRate} ${currencyName}`}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.direction === 'debit' ? '—' : `€${s.grossEuro.toFixed(2)}`}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.direction === 'debit' || s.unit === 'euro' ? '—' : `${s.feePercent.toFixed(1)}%`}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-red)' }}>{s.direction === 'debit' || s.unit === 'euro' ? '—' : `- €${s.feeEuro.toFixed(2)}`}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--color-green)' }}>{s.direction === 'debit' ? '—' : `€${s.payoutEuro.toFixed(2)}`}</td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{s.performedByName || '-'}</td>
                          <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden' }}>{s.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {txTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }} className={settlementStyles.noPrint}>
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

          {eventDenoms.length > 0 && (
            <section style={{ marginTop: '2rem' }} className={settlementStyles.noPrint}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Riepilogo tagli valuta</h2>
                <button
                  className={styles.textBtn}
                  onClick={async () => {
                    if (!showDenomReport && eventId) {
                      try {
                        const data = await apiRequest<{ items: DenominationReportItem[] }>(`/exchange/${eventId}/denomination-report`)
                        setDenomReport(data.items)
                      } catch { /* ignore */ }
                    }
                    setShowDenomReport(!showDenomReport)
                  }}
                >
                  {showDenomReport ? 'Nascondi' : 'Mostra riepilogo'}
                </button>
              </div>
              {showDenomReport && (
                <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Taglio</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Valore (EUR)</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Emessi</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Resi</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Resi (EUR)</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Persi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {denomReport.map((d) => (
                        <tr key={d.label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{d.label}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>€{d.value.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{d.issued}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: d.anomaly ? 'var(--color-red)' : undefined, fontWeight: d.anomaly ? 700 : undefined }}>
                            {d.returned}
                            {d.anomaly && ' ⚠️'}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>€{d.returnedEuro.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: d.lost > 0 ? 'var(--color-red)' : undefined }}>
                            {d.lost}
                          </td>
                        </tr>
                      ))}
                      {denomReport.length === 0 && (
                        <tr><td colSpan={6} style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nessun dato tagli disponibile</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
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
