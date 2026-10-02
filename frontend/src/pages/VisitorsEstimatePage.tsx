import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
  fetchVisitorsEstimate,
  type VisitorsEstimate,
  type VisitorStandEstimate,
} from '../lib/visitors'
import styles from './VisitorsEstimatePage.module.scss'

function fmtVisitors(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

function fmtPercent(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 1000) / 10}%`
}

function fmtTokens(n: number): string {
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
              {stand.settledCredits > 0 && (
                <div className={styles.catNote}>
                  {fmtTokens(stand.settledCredits)} liquidati, ripartiti sulle categorie in base al
                  fatturato di questo stand.
                </div>
              )}
            </div>
          </details>
        )}
      </td>
      <td className={styles.num}>{fmtTokens(stand.earnedCredits)}</td>
      <td className={styles.num}>{fmtTokens(stand.settledCredits)}</td>
      <td className={`${styles.num} ${styles.estimate}`}>{fmtVisitors(stand.estimatedVisitorsTotal)}</td>
    </tr>
  )
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
  /* La somma delle righe e' il totale "grezzo": serve a far vedere quanto la
     * correzione delle sovrapposizioni toglie, non e' il totale evento. */
  const rowsSum = Math.round(
    data.stands.reduce((sum, s) => sum + s.estimatedVisitorsTotal, 0) * 10,
  ) / 10

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
                dagli ordini registrati in piattaforma, con chi compra in più categorie contato una
                volta sola
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
              <div className={styles.cardTitle}>Stima liquidazioni</div>
              {/* Zero liquidati non è "zero visitatori": è un dato assente, e
                  mostrarlo come 0 farebbe sembrare una misura quella che è solo
                  l'assenza di un dato. */}
              <div className={styles.bigValue}>
                {data.totals.settlementBasedEstimated === null
                  ? '—'
                  : fmtVisitors(data.totals.settlementBasedEstimated)}
              </div>
              <div className={styles.cardNote}>
                {data.totals.settledCredits > 0 ? (
                  <>
                    {fmtTokens(data.totals.settledCredits)} {data.currencyName} liquidati divisi per
                    {fmtVisitors(data.tokensPerVisitor)} {data.currencyName} a visita
                  </>
                ) : (
                  'nessuna liquidazione registrata nel periodo'
                )}
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

          {data.categories.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Categorie e sovrapposizione</div>
              <p className={styles.cardNote}>
                Chi beve e mangia nello stesso carrello è una persona sola: la categoria più grande
                fa da base (peso 1), le altre pesano quanto la parte dei loro carrelli in cui quella
                categoria &egrave; l&rsquo;unica presente.
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th className={styles.num}>Quantit&agrave;</th>
                      <th className={styles.num}>Coefficiente</th>
                      <th className={styles.num}>Quota da sola</th>
                      <th className={styles.num}>Peso</th>
                      <th className={styles.num}>Stima pesata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((category) => (
                      <tr key={category.label}>
                        <td>{category.label}</td>
                        <td className={styles.num}>{category.quantity}</td>
                        <td className={styles.num}>{fmtVisitors(category.coefficient)}</td>
                        <td className={styles.num}>{fmtPercent(category.soloQuota)}</td>
                        <td className={styles.num}>{fmtPercent(category.weight)}</td>
                        <td className={`${styles.num} ${styles.estimate}`}>
                          {fmtVisitors(category.weightedVisitors)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.coeffNote}>
                {data.overlap.totalBaskets === 0
                  ? 'Nessun carrello osservabile: nessuna sovrapposizione da correggere.'
                  : `${data.overlap.mixedBaskets} carrelli su ${data.overlap.totalBaskets} (${fmtPercent(data.overlap.multiCategoryBasketShare)}) contengono più di una categoria. Senza la correzione la somma sarebbe ${fmtVisitors(data.totals.productEstimatedUnweighted)} visitatori.`}
              </div>
              {data.totals.unattributedSettledCredits > 0 && (
                <div className={styles.coeffNote}>
                  {fmtTokens(data.totals.unattributedSettledCredits)} {data.currencyName} liquidati
                  non sono attribuibili a nessuna categoria: gli stand che li hanno ricevuti non hanno
                  vendite nel periodo, quindi il loro mix di fatturato non esiste.
                </div>
              )}
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardTitle}>Dettaglio per stand</div>
            <p className={styles.cardNote}>
              La riga per stand &egrave; la somma di quel banco e resta grezza: la correzione delle
              sovrapposizioni si pu&ograve; fare solo a livello di evento, perch&eacute; solo l&igrave;
              si sa quali categorie sono finite nello stesso carrello. Per questo il totale non
              &egrave; la somma delle righe.
            </p>
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
                      <th className={styles.num}>Guadagnati</th>
                      <th className={styles.num}>Liquidati</th>
                      <th className={styles.num}>Stima visitatori</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stands.map((stand) => (
                      <StandRow key={stand.standId} stand={stand} />
                    ))}
                    <tr className={styles.tableTotals}>
                      <td className={styles.num}>—</td>
                      <td className={styles.standName}>Somma delle righe</td>
                      <td className={styles.num}>{totalOrders}</td>
                      <td className={styles.num}>{totalCustomers}</td>
                      <td />
                      <td className={styles.num}>{fmtTokens(data.totals.earnedCredits)}</td>
                      <td className={styles.num}>{fmtTokens(data.totals.settledCredits)}</td>
                      <td className={`${styles.num} ${styles.estimate}`}>{fmtVisitors(rowsSum)}</td>
                    </tr>
                    <tr className={styles.tableTotals}>
                      <td className={styles.num}>—</td>
                      <td className={styles.standName}>Totale evento (corretto)</td>
                      <td className={styles.num} />
                      <td className={styles.num} />
                      <td />
                      <td className={styles.num} />
                      <td className={styles.num} />
                      <td className={`${styles.num} ${styles.estimate}`}>
                        {fmtVisitors(data.totals.productEstimated)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={styles.note}>
            <strong>Tre stime, non un numero.</strong> Prodotti, token e liquidazioni misurano la
            stessa folla con tre strumenti diversi, quindi non vanno sommate: quella che si vuole
            usare dipende da quale dei tre segnali è più affidabile per quell&rsquo;evento. I
            coefficienti trasformano le unit&agrave; vendute in visitatori (es. 2 panini dello stesso
            tipo &#8776; 2 visitatori), non identificano persone uniche, e chi compra in pi&ugrave;
            categorie nello stesso carrello viene contato una volta sola.
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