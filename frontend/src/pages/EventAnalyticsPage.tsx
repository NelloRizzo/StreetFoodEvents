import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import {
  fetchEventAnalytics,
  formatHourLabel,
  formatSeconds,
  type AnalyticsStandRow,
  type EventAnalytics,
} from '../lib/eventAnalytics'
import styles from './EventAnalyticsPage.module.scss'

function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

/**
 * Mappa delle vendite per stand.
 *
 * Non e' una vera "mappa di calore delle presenze": i visitatori non hanno una
 * posizione GPS, quindi l'unico segnale spaziale reale e' dove sono i stand e
 * quanto hanno venduto. Il cerchio e' proporzionale al fatturato.
 *
 * La popup e' costruita con nodi DOM e `textContent`: il nome dello stand
 * arriva da un form admin e non deve mai finire in un innerHTML.
 */
function SalesMap({ stands, currencyName }: { stands: AnalyticsStandRow[]; currencyName: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const positioned = useMemo(() => stands.filter((s) => s.location), [stands])
  const maxRevenue = useMemo(
    () => Math.max(1, ...positioned.map((s) => s.revenue)),
    [positioned],
  )

  useEffect(() => {
    if (!containerRef.current || positioned.length === 0) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      maxZoom: 22,
    })

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; <a href="https://www.esri.com/">Esri</a>', maxZoom: 20, maxNativeZoom: 20 },
    ).addTo(map)

    const bounds = L.latLngBounds([])
    for (const stand of positioned) {
      const popup = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = stand.number ? `#${stand.number} ${stand.standName}` : stand.standName
      const detail = document.createElement('div')
      detail.textContent = `${stand.orders} ordini · ${fmtNumber(stand.revenue)} ${currencyName}`
      popup.append(title, detail)

      L.circle([stand.location!.lat, stand.location!.lng], {
        /* Raggio in metri: radice del fatturato, altrimenti il fatturato
           100x maggiore farebbe un cerchio 10x piu' grande di quanto serve. */
        radius: 8 + 45 * Math.sqrt(stand.revenue / maxRevenue),
        color: '#bf5a2a',
        weight: 2,
        fillColor: '#e08b4c',
        fillOpacity: 0.35,
      })
        .bindPopup(popup)
        .addTo(map)

      bounds.extend([stand.location!.lat, stand.location!.lng])
    }

    /* GOTCHA mappa: `fitBounds` senza `maxZoom` su stand ravvicinati (o su un
       solo stand, dove i bounds sono degeneri) spinge lo zoom al massimo
       consentito: i tile a quei livelli non esistono e la mappa resta grigia
       con "Map data not yet available". Per questo il zoom e' limitato a 18,
       come in EventMapPage, e con un solo stand si centra a mano. */
    if (positioned.length > 1 && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.15), { maxZoom: 18 })
    } else {
      const only = positioned[0]!.location!
      map.setView([only.lat, only.lng], 18)
    }

    return () => {
      map.remove()
    }
  }, [positioned, maxRevenue, currencyName])

  return <div ref={containerRef} className={styles.map} />
}

export function EventAnalyticsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [data, setData] = useState<EventAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    if (!eventId) return
    try {
      const result = await fetchEventAnalytics(eventId, from || undefined, to || undefined)
      setData(result)
      setForbidden(false)
    } catch {
      setForbidden(true)
    }
    setIsLoading(false)
  }, [eventId, from, to])

  useEffect(() => { void load() }, [load])

  const maxHourOrders = useMemo(
    () => Math.max(1, ...(data?.hourly ?? []).map((h) => h.orders)),
    [data],
  )
  const maxBucketCount = useMemo(
    () => Math.max(1, ...(data?.prepBuckets ?? []).map((b) => b.count)),
    [data],
  )

  if (isLoading) return null
  if (forbidden) {
    return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>
  }
  if (!eventId || !data) return null

  const { totals } = data
  const revenueEuro = totals.revenue / (data.exchangeRate || 1)
  const positioned = data.byStand.filter((s) => s.location)

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <h1 className={styles.title}>Analisi vendite — {data.eventName}</h1>
          <div className={styles.headerActions}>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Da</label>
              <input
                type="date"
                value={from}
                onChange={(e) => { setIsLoading(true); setFrom(e.target.value) }}
                className={styles.dateInput}
              />
              <label className={styles.dateLabel}>a</label>
              <input
                type="date"
                value={to}
                onChange={(e) => { setIsLoading(true); setTo(e.target.value) }}
                className={styles.dateInput}
              />
            </div>
            <button type="button" className={styles.secondaryBtn} onClick={() => window.print()}>
              Stampa
            </button>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <div className={`${styles.card} ${styles.cardHighlight}`}>
            <div className={styles.cardTitle}>Fatturato</div>
            <div className={styles.bigValue}>{fmtNumber(totals.revenue)} {data.currencyName}</div>
            <div className={styles.cardNote}>
              &asymp; {fmtNumber(revenueEuro)} &euro; &middot; scontrino medio{' '}
              {fmtNumber(totals.avgOrderValue)} {data.currencyName}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Ordini</div>
            <div className={styles.bigValue}>{totals.orders}</div>
            <div className={styles.cardNote}>{totals.quantity} prodotti &middot; {totals.giftOrders} omaggi esclusi</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Clienti distinti</div>
            <div className={styles.bigValue}>{totals.distinctCustomers}</div>
            <div className={styles.cardNote}>
              {totals.orders > 0
                ? `${fmtNumber(totals.orders / Math.max(1, totals.distinctCustomers))} ordini per cliente`
                : 'nessun ordine registrato'}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Tempo medio di preparazione</div>
            <div className={styles.bigValue}>{formatSeconds(totals.avgPrepSeconds)}</div>
            <div className={styles.cardNote}>
              {totals.prepOrders} ordini arrivati a &laquo;pronto&raquo;
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Vendite per ora</div>
          <p className={styles.cardNote}>
            Ore in ora locale del browser. Serve per decidere quando aprire le postazioni e come
            dimensionarle.
          </p>
          {data.hourly.length === 0 ? (
            <p className={styles.empty}>Nessun ordine nel periodo.</p>
          ) : (
            <div className={styles.chart}>
              {data.hourly.map((bucket) => (
                <div key={bucket.bucketStart} className={styles.chartCol}>
                  <span className={styles.chartValue}>{bucket.orders}</span>
                  <div
                    className={styles.chartBar}
                    style={{ height: `${Math.round((bucket.orders / maxHourOrders) * 100)}%` }}
                    title={`${formatHourLabel(bucket.bucketStart)} — ${bucket.orders} ordini, ${bucket.quantity} prodotti, ${fmtNumber(bucket.revenue)} ${data.currencyName}`}
                  />
                  <span className={styles.chartLabel}>{formatHourLabel(bucket.bucketStart)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Tempo di preparazione</div>
          <p className={styles.cardNote}>
            Media {formatSeconds(totals.avgPrepSeconds)} su {totals.prepOrders} ordini. Gli intervalli
            sono gli stessi per tutti gli eventi, cosi i confronti sono leggibili.
          </p>
          {totals.prepOrders === 0 ? (
            <p className={styles.empty}>Nessun ordine &laquo;pronto&raquo; nel periodo.</p>
          ) : (
            <div className={styles.buckets}>
              {data.prepBuckets.map((bucket) => (
                <div key={bucket.label} className={styles.bucketRow}>
                  <span className={styles.bucketLabel}>{bucket.label}</span>
                  <div className={styles.bucketTrack}>
                    <div
                      className={styles.bucketFill}
                      style={{ width: `${Math.round((bucket.count / maxBucketCount) * 100)}%` }}
                    />
                  </div>
                  <span className={styles.bucketValue}>{bucket.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Prodotti pi&ugrave; venduti</div>
          {data.topProducts.length === 0 ? (
            <p className={styles.empty}>Nessun prodotto venduto nel periodo.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.num}>#</th>
                    <th>Prodotto</th>
                    <th>Stand</th>
                    <th className={styles.num}>Quantit&agrave;</th>
                    <th className={styles.num}>Ricavo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((product, i) => (
                    <tr key={`${product.eventProductId}-${product.standId}`}>
                      <td className={styles.num}>{i + 1}</td>
                      <td>{product.productName}</td>
                      <td>{product.standName}</td>
                      <td className={styles.num}>{product.quantity}</td>
                      <td className={styles.num}>{fmtNumber(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Vendite sulla mappa</div>
          <p className={styles.cardNote}>
            Il cerchio cresce con il fatturato dello stand. Non &egrave; una mappa delle presenze:
            dei visitatori non conosciamo la posizione, quindi la vendita &egrave; l&rsquo;unico
            segnale spaziale reale.
          </p>
          {positioned.length === 0 ? (
            <p className={styles.empty}>
              Nessuno stand ha una posizione impostata per questo evento.
            </p>
          ) : (
            <SalesMap stands={data.byStand} currencyName={data.currencyName} />
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Dettaglio per stand</div>
          {data.byStand.length === 0 ? (
            <p className={styles.empty}>Nessun dato disponibile.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.num}>N&deg;</th>
                    <th>Stand</th>
                    <th className={styles.num}>Ordini</th>
                    <th className={styles.num}>Quantit&agrave;</th>
                    <th className={styles.num}>Fatturato</th>
                    <th className={styles.num}>Contanti</th>
                    <th className={styles.num}>POS</th>
                    <th className={styles.num}>Crediti</th>
                    <th className={styles.num}>Preparazione</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStand.map((stand) => (
                    <tr key={stand.standId}>
                      <td className={styles.num}>{stand.number ?? '—'}</td>
                      <td>{stand.standName}</td>
                      <td className={styles.num}>{stand.orders}</td>
                      <td className={styles.num}>{stand.quantity}</td>
                      <td className={styles.num}>{fmtNumber(stand.revenue)}</td>
                      <td className={styles.num}>{fmtNumber(stand.cashRevenue)}</td>
                      <td className={styles.num}>{fmtNumber(stand.posRevenue)}</td>
                      <td className={styles.num}>{fmtNumber(stand.creditRevenue)}</td>
                      <td className={styles.num}>{formatSeconds(stand.avgPrepSeconds)}</td>
                    </tr>
                  ))}
                  <tr className={styles.tableTotals}>
                    <td className={styles.num}>—</td>
                    <td>TOTALE</td>
                    <td className={styles.num}>{totals.orders}</td>
                    <td className={styles.num}>{totals.quantity}</td>
                    <td className={styles.num}>{fmtNumber(totals.revenue)}</td>
                    <td className={styles.num}>{fmtNumber(totals.cashRevenue)}</td>
                    <td className={styles.num}>{fmtNumber(totals.posRevenue)}</td>
                    <td className={styles.num}>{fmtNumber(totals.creditRevenue)}</td>
                    <td className={styles.num}>{formatSeconds(totals.avgPrepSeconds)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className={styles.note}>
          <strong>Cosa non c&rsquo;&egrave; qui.</strong> La distribuzione per ora &egrave; basata
          sull&rsquo;ora di emissione dell&rsquo;ordine, non su quella in cui il visitatore ha
          attraversato i banchi. Il tempo di preparazione misura dall&rsquo;ordine al passaggio a
          &laquo;pronto&raquo;: include l&rsquo;attesa in coda, non solo la cucina. Omaggi e ordini
          cancellati sono esclusi dal fatturato.
        </p>
      </div>
    </div>
  )
}