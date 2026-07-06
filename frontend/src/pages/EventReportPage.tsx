import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

import { fetchEventReport, type EventReport, type EventReportStand } from '../lib/orders'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './EventReportPage.module.scss'

const CASH_REGISTER_KEY = 'cashRegister_'

function loadRegister(eventId: string): number {
  try {
    const raw = localStorage.getItem(CASH_REGISTER_KEY + eventId)
    if (raw) {
      const { amount } = JSON.parse(raw)
      return typeof amount === 'number' ? amount : 0
    }
  } catch { /* ignore */ }
  return 0
}

function saveRegister(eventId: string, amount: number) {
  localStorage.setItem(CASH_REGISTER_KEY + eventId, JSON.stringify({ amount, updatedAt: new Date().toISOString() }))
}

function StandRow({ stand, isTotal, showCash, showCredits }: { stand: EventReportStand; isTotal?: boolean; showCash: boolean; showCredits: boolean }) {
  return (
    <tr className={isTotal ? styles.tableTotals : undefined}>
      <td className={styles.standName}>{stand.standName}</td>
      <td className={styles.num}>{stand.paidOrders}</td>
      <td className={styles.num}>{fmt(stand.totalRevenue)}</td>
      {showCash && <td className={`${styles.num} ${styles.totalCash}`}>{fmt(stand.cashRevenue)}</td>}
      {showCredits && <td className={`${styles.num} ${styles.totalCredits}`}>{fmt(stand.creditRevenue)}</td>}
      <td className={styles.num}>{stand.pendingOrders}</td>
      <td className={styles.num}>{fmt(stand.pendingAmount)}</td>
      <td className={styles.num}>{fmt(stand.refundedAmount)}</td>
    </tr>
  )
}

function fmt(n: number) {
  return `€${n.toFixed(2)}`
}

export function EventReportPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [report, setReport] = useState<EventReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [registerVisible, setRegisterVisible] = useState(false)
  const [registerAmount, setRegisterAmount] = useState(loadRegister(eventId ?? ''))
  const [showResetPrompt, setShowResetPrompt] = useState(false)

  const load = useCallback(async () => {
    if (!eventId) return
    try {
      const data = await fetchEventReport(eventId, startDate || undefined, endDate || undefined)
      setReport(data)
      setIsLoading(false)
    } catch {
      setForbidden(true)
      setIsLoading(false)
    }
  }, [eventId, startDate, endDate])

  useEffect(() => { void load() }, [load])

  const handleResetRegister = (value?: string) => {
    if (!eventId) return
    const num = Number(value)
    if (!Number.isFinite(num) || num < 0) return
    setRegisterAmount(num)
    saveRegister(eventId, num)
    setShowResetPrompt(false)
  }

  if (isLoading) return null
  if (forbidden) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  if (!eventId || !report) return null

  const hasCredits = report.stands.some((s) => s.creditRevenue > 0)
  const hasCash = report.cashPaymentsEnabled

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <Link to={`/events/${eventId}/orders`} className={styles.backLink}>&larr; Torna agli ordini</Link>
            <h1 className={styles.title}>Report — {report.eventName}</h1>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Da</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setIsLoading(true) }}
                className={styles.dateInput}
              />
              <label className={styles.dateLabel}>a</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setIsLoading(true) }}
                className={styles.dateInput}
              />
            </div>
            <button className={styles.secondaryBtn} onClick={() => window.print()}>
              Stampa
            </button>
          </div>
        </div>

        <div className={styles.reportGrid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Cassa</div>
            <div className={styles.cashRegister}>
              {registerVisible ? (
                <span className={styles.cashRegisterAmount}>{fmt(registerAmount)}</span>
              ) : (
                <span className={styles.cashRegisterHidden}>&bull;&bull;&bull;&bull;&bull;</span>
              )}
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setRegisterVisible((v) => !v)}
                title={registerVisible ? 'Nascondi' : 'Mostra'}
                aria-label={registerVisible ? 'Nascondi totale cassa' : 'Mostra totale cassa'}
              >
                {registerVisible ? '\u{1F441}' : '\u{1F441}\u200D\u{1F5E8}'}
              </button>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => setShowResetPrompt(true)}
              >
                Azzera cassa
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Riepilogo</div>
            <div className={styles.totalsBar}>
              <div className={styles.totalItem}>
                <span className={styles.totalLabel}>Ordini pagati</span>
                <span className={styles.totalValue}>{report.totals.paidOrders}</span>
              </div>
              <div className={styles.totalItem}>
                <span className={styles.totalLabel}>Totale</span>
                <span className={styles.totalValue}>{fmt(report.totals.totalRevenue)}</span>
              </div>
              {hasCash && (
                <div className={styles.totalItem}>
                  <span className={styles.totalLabel}>Contanti</span>
                  <span className={`${styles.totalValue} ${styles.totalCash}`}>{fmt(report.totals.cashRevenue)}</span>
                </div>
              )}
              {hasCredits && (
                <div className={styles.totalItem}>
                  <span className={styles.totalLabel}>Crediti</span>
                  <span className={`${styles.totalValue} ${styles.totalCredits}`}>{fmt(report.totals.creditRevenue)}</span>
                </div>
              )}
              <div className={styles.totalItem}>
                <span className={styles.totalLabel}>Pendenti</span>
                <span className={styles.totalValue}>{fmt(report.totals.pendingAmount)}</span>
              </div>
              {report.totals.refundedAmount > 0 && (
                <div className={styles.totalItem}>
                  <span className={styles.totalLabel}>Rimborsato</span>
                  <span className={styles.totalValue}>{fmt(report.totals.refundedAmount)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Dettaglio per stand</div>
            {report.stands.length === 0 ? (
              <p className={styles.empty}>Nessun dato disponibile.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Stand</th>
                      <th className={styles.num}>Pagati</th>
                      <th className={styles.num}>Totale</th>
                      {hasCash && <th className={styles.num}>Contanti</th>}
                      {hasCredits && <th className={styles.num}>Crediti</th>}
                      <th className={styles.num}>Pendenti</th>
                      <th className={styles.num}>Da incassare</th>
                      <th className={styles.num}>Rimborsato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.stands.map((stand) => (
                      <StandRow key={stand.standId} stand={stand} showCash={hasCash} showCredits={hasCredits} />
                    ))}
                    <StandRow
                      stand={{
                        standId: '',
                        standName: 'TOTALE',
                        ...report.totals,
                        paymentMethods: { cash: 0, credits: 0, mixed: 0 }
                      }}
                      isTotal
                      showCash={hasCash}
                      showCredits={hasCredits}
                    />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showResetPrompt}
        variant="prompt"
        title="Imposta cassa"
        message="Inserisci il nuovo importo in cassa:"
        confirmLabel="Salva"
        onConfirm={handleResetRegister}
        onCancel={() => setShowResetPrompt(false)}
      />
    </div>
  )
}
