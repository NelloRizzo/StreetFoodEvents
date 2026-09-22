import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { fetchVisitorsEstimate, type VisitorsEstimate, type VisitorStandEstimate } from '../lib/visitors'
import styles from './VisitorsEstimatePage.module.scss'

function fmtVisitors(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

function StandRow({ stand, isTotal }: { stand: VisitorStandEstimate; isTotal?: boolean }) {
  return (
    <tr className={isTotal ? styles.tableTotals : undefined}>
      <td className={styles.num}>{stand.number ?? '—'}</td>
      <td className={styles.standName}>{stand.standName}</td>
      <td className={styles.num}>
        {stand.ordersCount}
        {!isTotal && !stand.hasOrders && <span className={styles.noDataBadge}>nessun ordine</span>}
      </td>
      <td className={styles.num}>{stand.distinctCustomers}</td>
      <td>
        {stand.categories.length === 0 ? (
          <span className={styles.emptyCell}>—</span>
        ) : (
          <details className={styles.catDetails}>
            <summary className={styles.catSummary}>
              {stand.categories.length} {stand.categories.length === 1 ? 'categoria' : 'categorie'}
            </summary>
            <div className={styles.catList}>
              {stand.categories.map((c) => (
                <div key={c.label} className={styles.catRow}>
                  <span className={styles.catLabel}>{c.label}</span>
                  <span className={styles.catQty}>
                    {c.quantity} &times; {fmtVisitors(c.coefficient)} = {fmtVisitors(c.estimatedVisitors)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </td>
      <td className={`${styles.num} ${styles.estimate}`}>{fmtVisitors(stand.estimatedVisitorsTotal)}</td>
    </tr>
  )
}

function fmtTokens(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

export function VisitorsEstimatePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [data, setData] = useState<VisitorsEstimate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    if (!eventId) return
    try {
      const estimate = await fetchVisitorsEstimate(eventId, from || undefined, to || undefined)
      setData(estimate)
      setIsLoading(false)
    } catch {
      setForbidden(true)
      setIsLoading(false)
    }
  }, [eventId, from, to])

  useEffect(() => { void load() }, [load])

  if (isLoading) return null
  if (forbidden) {
    return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  }
  if (!eventId || !data) return null

  const totalOrders = data.stands.reduce((sum, s) => sum + s.ordersCount, 0)
  const totalCustomers = data.stands.reduce((sum, s) => sum + s.distinctCustomers, 0)

  const customCoefficients = Object.entries(data.coefficientMap)

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Stima visitatori — {data.eventName}</h1>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Da</label>
              <input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setIsLoading(true) }}
                className={styles.dateInput}
              />
              <label className={styles.dateLabel}>a</label>
              <input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setIsLoading(true) }}
                className={styles.dateInput}
              />
            </div>
            <button className={styles.secondaryBtn} onClick={() => window.print()}>
              Stampa
            </button>
          </div>
        </div>

        <div className={styles.reportGrid}>
          <div className={styles.summaryGrid}>
            <div className={`${styles.card} ${styles.cardHighlight}`}>
              <div className={styles.cardTitle}>Stima prodotti</div>
              <div className={styles.bigValue}>{fmtVisitors(data.totals.productEstimated)}</div>
              <div className={styles.cardNote}>
                somma della stima per stand, dagli ordini registrati in piattaforma
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Stima token</div>
              <div className={styles.bigValue}>{fmtVisitors(data.totals.tokenBasedEstimated)}</div>
              <div className={styles.cardNote}>
                {fmtTokens(data.totals.netTokensSold)} {data.currencyName} venduti divisi per
                {fmtVisitors(data.tokensPerVisitor)} {data.currencyName} medi a visita
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Token venduti</div>
              <div className={styles.bigValue}>{fmtTokens(data.totals.netTokensSold)}</div>
              <div className={styles.cardNote}>
                {data.totals.distinctTokenBuyers} {data.totals.distinctTokenBuyers === 1 ? 'acquirente' : 'acquirenti'} distinti
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Ordini in piattaforma</div>
              <div className={styles.bigValue}>{data.totals.nonCancelledOrders}</div>
              <div className={styles.cardNote}>
                {data.totals.distinctOrderCustomers} {data.totals.distinctOrderCustomers === 1 ? 'cliente' : 'clienti'} distinti
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Dettaglio per stand</div>
            {data.stands.length === 0 ? (
              <p className={styles.empty}>Nessun dato disponibile.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.num}>N&deg;</th>
                      <th>Stand</th>
                      <th className={styles.num}>Ordini</th>
                      <th className={styles.num}>Clienti</th>
                      <th>Quantit&agrave; per categoria</th>
                      <th className={styles.num}>Stima visitatori</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stands.map((stand) => (
                      <StandRow key={stand.standId} stand={stand} />
                    ))}
                    <tr className={styles.tableTotals}>
                      <td className={styles.num}>—</td>
                      <td className={styles.standName}>TOTALE</td>
                      <td className={styles.num}>{totalOrders}</td>
                      <td className={styles.num}>{totalCustomers}</td>
                      <td />
                      <td className={`${styles.num} ${styles.estimate}`}>{fmtVisitors(data.totals.productEstimated)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={styles.note}>
            <strong>Stima approssimativa</strong> — i coefficienti trasformano le unit&agrave; vendute in visitatori
            (es. 2 panini dello stesso tipo &#8776; 2 visitatori), non identificano persone uniche.
            Gli stand senza ordini registrati contribuiscono con zero. Un prodotto in pi&ugrave; categorie
            &egrave; conteggiato una sola volta, nella categoria col coefficiente pi&ugrave; alto. La stima &ldquo;token&rdquo;
            copre tutti i visitatori solo se l&rsquo;economia dell&rsquo;evento passa dai token.{' '}
            {data.tokensPerVisitor === 10 && data.totals.nonCancelledOrders === 0 && (
              <span>Nessun ordine osservabile: usato il valore predefinito di 10 unit&agrave; per visitatore.</span>
            )}
            <div className={styles.coeffNote}>
              Coefficienti applicati:{' '}
              {customCoefficients.map(([label, coeff]) => `${label} = ${fmtVisitors(coeff)}`)
                .join(', ')}{' '}
              &middot; default = {data.defaultCoefficient}.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}