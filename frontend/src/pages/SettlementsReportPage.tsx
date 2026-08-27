import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import type { UploadedImage } from '../lib/upload'
import { useAuth } from '../features/auth/auth-context'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import reportStyles from './EventReportPage.module.scss'
import styles from './SettlementsReportPage.module.scss'

type ReportStand = {
  standId: string
  standName: string
  settlementCount: number
  loadCount: number
  loadedCredits: number
  settledCredits: number
  earnedCredits: number
  toReturnCredits: number
  loadedEuro: number
  settledEuro: number
  grossEuro: number
  feeEuro: number
  payoutEuro: number
}

type SettlementReport = {
  eventId: string
  eventName: string
  exchangeRate: number
  currencyName: string
  currencySymbol: UploadedImage | null
  from: string | null
  to: string | null
  stands: ReportStand[]
  totals: {
    settlementCount: number
    loadCount: number
    loadedCredits: number
    settledCredits: number
    earnedCredits: number
    toReturnCredits: number
    loadedEuro: number
    settledEuro: number
    grossEuro: number
    feeEuro: number
    payoutEuro: number
  }
}

function fmtEur(n: number) {
  return `€${n.toFixed(2)}`
}

function StandRow({ stand, isTotal }: { stand: ReportStand; isTotal?: boolean }) {
  return (
    <tr className={isTotal ? reportStyles.tableTotals : undefined}>
      <td className={reportStyles.standName}>{stand.standName}</td>
      <td className={reportStyles.num}>{stand.settlementCount}</td>
      <td className={reportStyles.num}>{stand.loadedCredits.toFixed(2)}</td>
      <td className={reportStyles.num}>{stand.settledCredits.toFixed(2)}</td>
      <td className={reportStyles.num}>{stand.earnedCredits.toFixed(2)}</td>
      <td className={`${reportStyles.num} ${styles.remainingValue}`}>{stand.toReturnCredits.toFixed(2)}</td>
      <td className={reportStyles.num}>{stand.loadedEuro !== 0 ? fmtEur(stand.loadedEuro) : '—'}</td>
      <td className={reportStyles.num}>{stand.settledEuro !== 0 ? fmtEur(stand.settledEuro) : '—'}</td>
      <td className={reportStyles.num}>{fmtEur(stand.grossEuro)}</td>
      <td className={`${reportStyles.num} ${styles.feeValue}`}>- {fmtEur(stand.feeEuro)}</td>
      <td className={`${reportStyles.num} ${styles.payoutValue}`}>{fmtEur(stand.payoutEuro)}</td>
    </tr>
  )
}

export function SettlementsReportPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [report, setReport] = useState<SettlementReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    if (!eventId || !isAuthenticated) return
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      const data = await apiRequest<SettlementReport>(`/exchange/${eventId}/settlements/report${qs ? `?${qs}` : ''}`)
      setReport(data)
      setForbidden(false)
    } catch (err) {
      if ((err as { status?: number }).status === 403) setForbidden(true)
    } finally {
      setIsLoading(false)
    }
  }, [eventId, isAuthenticated, from, to])

  useEffect(() => { void load() }, [load])

  if (isLoading) return null
  if (forbidden) {
    return (
      <div className={reportStyles.page}>
        <div className="page-shell">
          <p className={reportStyles.empty}>Accesso negato.</p>
        </div>
      </div>
    )
  }
  if (!eventId || !report) return null

  const { totals } = report

  return (
    <div className={reportStyles.page}>
      <div className="page-shell">
        <div className={reportStyles.header}>
          <div>
            <h1 className={reportStyles.title}>
              <CurrencyDisplay currencyName={report.currencyName} currencySymbol={report.currencySymbol} /> Resoconto liquidazioni — {report.eventName}
            </h1>
          </div>
          <div className={reportStyles.headerActions}>
            <div className={reportStyles.dateGroup}>
              <label className={reportStyles.dateLabel}>Da</label>
              <input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setIsLoading(true) }}
                className={reportStyles.dateInput}
              />
              <label className={reportStyles.dateLabel}>a</label>
              <input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setIsLoading(true) }}
                className={reportStyles.dateInput}
              />
            </div>
            <button className={reportStyles.secondaryBtn} onClick={() => window.print()}>
              Stampa
            </button>
          </div>
        </div>

        <div className={reportStyles.reportGrid}>
          <div className={reportStyles.card}>
            <div className={reportStyles.cardTitle}>Riepilogo</div>
            <div className={reportStyles.totalsBar}>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Liquidazioni</span>
                <span className={reportStyles.totalValue}>{totals.settlementCount}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Caricati (DARE)</span>
                <span className={reportStyles.totalValue}>{totals.loadedCredits.toFixed(2)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Crediti liquidati</span>
                <span className={reportStyles.totalValue}>{totals.settledCredits.toFixed(2)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Lordo</span>
                <span className={reportStyles.totalValue}>{fmtEur(totals.grossEuro)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Trattenuto</span>
                <span className={`${reportStyles.totalValue} ${styles.feeValue}`}>- {fmtEur(totals.feeEuro)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Erogato</span>
                <span className={`${reportStyles.totalValue} ${styles.payoutValue}`}>{fmtEur(totals.payoutEuro)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Da restituire</span>
                <span className={`${reportStyles.totalValue} ${styles.remainingValue}`}>{totals.toReturnCredits.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className={reportStyles.card}>
            <div className={reportStyles.cardTitle}>Dettaglio per stand</div>
            {report.stands.length === 0 ? (
              <p className={reportStyles.empty}>Nessuna liquidazione nel periodo selezionato.</p>
            ) : (
              <div className={reportStyles.tableWrap}>
                <table className={reportStyles.table}>
                  <thead>
                    <tr>
                      <th>Stand</th>
                      <th className={reportStyles.num}>N.</th>
                      <th className={reportStyles.num}>Caricati (DARE)</th>
                      <th className={reportStyles.num}>Liquidati (AVERE)</th>
                      <th className={reportStyles.num}>Guadagnati</th>
                      <th className={reportStyles.num}>Da restituire</th>
                      <th className={reportStyles.num}>Voci € DARE</th>
                      <th className={reportStyles.num}>Voci € AVERE</th>
                      <th className={reportStyles.num}>Lordo €</th>
                      <th className={reportStyles.num}>Trattenuta €</th>
                      <th className={reportStyles.num}>Erogato €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.stands.map((stand) => (
                      <StandRow key={stand.standId} stand={stand} />
                    ))}
                    <StandRow stand={{ ...totals, standId: '', standName: 'TOTALE' }} isTotal />
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.note}>
              Le operazioni possono essere filtrate per data. «Caricati» (DARE) sono i crediti dati allo stand da restituire
              in liquidazione; «Liquidati» (AVERE) i crediti restituiti con pagamento in euro; «Da restituire» = caricati −
              liquidati. «Crediti guadagnati» fa riferimento a tutto l'evento (report ordini), a prescindere dal filtro.
              «Voci €» sono operazioni registrate direttamente in euro: DARE = credito da esigere dallo stand, AVERE =
              pagamento già corrisposto (incluso nell'erogato).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
