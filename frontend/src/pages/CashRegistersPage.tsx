import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import type { UploadedImage } from '../lib/upload'
import { useAuth } from '../features/auth/auth-context'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import reportStyles from './EventReportPage.module.scss'
import styles from './CashRegistersPage.module.scss'

type CashFloat = { euro: number; credits: number; setAt: string | null }

type ReportItem = {
  id: string
  name: string
  status: 'open' | 'closed'
  openedByUserId: string | null
  openedByName: string | null
  openedAt: string
  closedAt: string | null
  cashFloat: CashFloat
  topUp: number
  refund: number
  topUpCount: number
  refundCount: number
  topUpReal: number
  refundReal: number
  euroContent: number
  creditsContent: number
  sinceTopUpCount: number
  sinceRefundCount: number
  sinceTotalCount: number
}

type CashRegistersReport = {
  eventId: string
  eventName: string
  exchangeRate: number
  currencyName: string
  currencySymbol: UploadedImage | null
  from: string | null
  to: string | null
  items: ReportItem[]
  totals: {
    openCount: number
    closedCount: number
    floatEuro: number
    floatCredits: number
    euroContent: number
    creditsContent: number
    sinceTotalCount: number
  }
}

function fmtEur(n: number) {
  return `€${n.toFixed(2)}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CassaRow({ item, isTotal }: { item: ReportItem; isTotal?: boolean }) {
  return (
    <tr className={isTotal ? reportStyles.tableTotals : undefined}>
      <td className={styles.cassaName}>
        {item.name}
        {!isTotal && <span className={styles.sub}>Aperta il {fmtDateTime(item.openedAt)}</span>}
      </td>
      <td>
        <span className={`${styles.statusBadge} ${item.status === 'open' ? styles.statusOpen : styles.statusClosed}`}>
          {item.status === 'open' ? 'Aperta' : 'Chiusa'}
        </span>
      </td>
      <td className={styles.openerName}>{item.openedByName ?? '—'}</td>
      <td className={reportStyles.num}>{fmtEur(item.cashFloat.euro)}</td>
      <td className={reportStyles.num}>{item.cashFloat.credits.toFixed(2)}</td>
      <td className={reportStyles.num}>{fmtEur(item.euroContent)}</td>
      <td className={reportStyles.num}>{item.creditsContent.toFixed(2)}</td>
      <td className={reportStyles.num}>
        {item.sinceTotalCount}
        <span className={styles.sub}>{item.sinceTopUpCount} carichi / {item.sinceRefundCount} rimborsi</span>
      </td>
    </tr>
  )
}

export function CashRegistersPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [report, setReport] = useState<CashRegistersReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!eventId || !isAuthenticated) return
    if (!silent) setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', new Date(from).toISOString())
      if (to) params.set('to', new Date(to).toISOString())
      const qs = params.toString()
      const data = await apiRequest<CashRegistersReport>(
        `/exchange/${eventId}/cash-registers/report${qs ? `?${qs}` : ''}`
      )
      setReport(data)
      setForbidden(false)
    } catch (err) {
      if ((err as { status?: number }).status === 403) setForbidden(true)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [eventId, isAuthenticated, from, to])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const id = setInterval(() => { void load(true) }, 5000)
    return () => clearInterval(id)
  }, [load])

  if (isLoading) return null
  if (forbidden) {
    return (
      <div className={reportStyles.page}>
        <div className="page-shell">
          <p className={styles.empty}>Accesso negato.</p>
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
              <CurrencyDisplay currencyName={report.currencyName} currencySymbol={report.currencySymbol} /> Master Cambio — {report.eventName}
            </h1>
          </div>
          <div className={reportStyles.headerActions}>
            <div className={reportStyles.dateGroup}>
              <label className={reportStyles.dateLabel}>Transazioni da</label>
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setIsLoading(true) }}
                className={reportStyles.dateInput}
              />
              <label className={reportStyles.dateLabel}>a</label>
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => { setTo(e.target.value); setIsLoading(true) }}
                className={reportStyles.dateInput}
              />
              {(from || to) && (
                <button
                  className={reportStyles.secondaryBtn}
                  onClick={() => { setFrom(''); setTo(''); setIsLoading(true) }}
                >
                  Azzera
                </button>
              )}
            </div>
            <button className={reportStyles.secondaryBtn} onClick={() => window.print()}>
              Stampa
            </button>
          </div>
        </div>

        <div className={reportStyles.reportGrid}>
          <div className={reportStyles.card}>
            <div className={reportStyles.cardTitle}>Riepilogo casse</div>
            <div className={reportStyles.totalsBar}>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Casse aperte</span>
                <span className={reportStyles.totalValue}>{totals.openCount}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Casse chiuse</span>
                <span className={reportStyles.totalValue}>{totals.closedCount}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Fondo €</span>
                <span className={reportStyles.totalValue}>{fmtEur(totals.floatEuro)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Fondo {report.currencyName}</span>
                <span className={reportStyles.totalValue}>{totals.floatCredits.toFixed(2)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Contenuto €</span>
                <span className={reportStyles.totalValue}>{fmtEur(totals.euroContent)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Contenuto {report.currencyName}</span>
                <span className={reportStyles.totalValue}>{totals.creditsContent.toFixed(2)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Transazioni nel periodo</span>
                <span className={reportStyles.totalValue}>{totals.sinceTotalCount}</span>
              </div>
            </div>
          </div>

          <div className={reportStyles.card}>
            <div className={reportStyles.cardTitle}>Dettaglio per cassa</div>
            {report.items.length === 0 ? (
              <p className={styles.empty}>Nessuna cassa registrata per questo evento.</p>
            ) : (
              <div className={reportStyles.tableWrap}>
                <table className={reportStyles.table}>
                  <thead>
                    <tr>
                      <th>Cassa</th>
                      <th>Stato</th>
                      <th>Aperta da</th>
                      <th className={reportStyles.num}>Fondo €</th>
                      <th className={reportStyles.num}>Fondo {report.currencyName}</th>
                      <th className={reportStyles.num}>Contenuto €</th>
                      <th className={reportStyles.num}>Contenuto {report.currencyName}</th>
                      <th className={reportStyles.num}>Transazioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((item) => (
                      <CassaRow key={item.id} item={item} />
                    ))}
                    <CassaRow
                      isTotal
                      item={{
                        id: '__tot',
                        name: 'TOTALE',
                        status: 'open',
                        openedByUserId: null,
                        openedByName: null,
                        openedAt: report.from ?? new Date().toISOString(),
                        closedAt: null,
                        cashFloat: { euro: totals.floatEuro, credits: totals.floatCredits, setAt: null },
                        topUp: 0, refund: 0, topUpCount: 0, refundCount: 0,
                        topUpReal: 0, refundReal: 0,
                        euroContent: totals.euroContent,
                        creditsContent: totals.creditsContent,
                        sinceTopUpCount: 0, sinceRefundCount: 0,
                        sinceTotalCount: totals.sinceTotalCount,
                      }}
                    />
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.note}>
              «Fondo» è la dotazione iniziale impostata per la cassa; «Contenuto» è il valore attuale (fondo + incassi
              reali − rimborsi reali + movimenti cassa). Le «Transazioni» conteggiano solo i carichi e i rimborsi effettuati
              dalla cassa a partire da {report.from ? fmtDateTime(report.from) : "inizio evento"}
              {report.to ? ` fino a ${fmtDateTime(report.to)}` : ''}. Le casse chiuse restano visibili come storico in sola
              lettura.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
