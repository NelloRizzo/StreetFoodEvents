import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { apiRequest } from '../lib/api'
import {
  fetchEventAnalytics,
  formatHourLabel,
  formatSeconds,
  type AnalyticsStandRow,
  type EventAnalytics,
} from '../lib/eventAnalytics'
import styles from './EventAnalyticsPage.module.scss'

type StandOption = {
  id: string
  name: string
  numbers?: Array<{ eventId: string; number: number }>
}

/** Numero progressivo dello stand per l'evento corrente (la numerazione è
 *  per evento, non globale). */
function standNumberOf(stand: StandOption, eventId: string): number | null {
  return stand.numbers?.find((n) => n.eventId === eventId)?.number ?? null
}

function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

/** Importi in euro: due decimali, i crediti restano con `fmtNumber`. */
function fmtEuro(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function fmtPercent(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 1000) / 10}%`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
 *
 * GOTCHA: i cerchi sono `circleMarker`, NON `circle`. `L.circle` accetta il
 * raggio in METRI, quindi il cerchio si rimpicciolisce da solo quando si
 * zooma indietro e a una vista d'insieme sparisce. `circleMarker` ragiona in
 * PIXEL e resta leggibile a qualunque zoom.
 */

/* Zoom di inquadratura: 16 copre ~840 m in verticale, la scala di una piazza
   con i banchi disposti. Con 18 si vedeva un solo banco. */
const SALES_MAP_ZOOM = 16

/* Zoom nativo dei provider verificato scaricando i tile: Esri street e imagery
   restituiscono tile veri fino a z19, a z20 restituiscono tutti e due lo stesso
   segnaposto grigio da 2.521 byte ("Map data not yet available"). OSM regge fino
   a 19. Per questo il tetto e' 19 e non 20. */
const NATIVE_ZOOM = 19

/* Tre provider per i tile. Leaflet non ha fallback: se quello attivo non
   risponde (bloccato da un ad-blocker, rete che lo filtra, servizio Esri
   irraggiungibile) la mappa resta grigia ma i cerchi SVG disegnati sopra si
   vedono lo stesso, e sembra un bug invece di un problema di rete. */
const TILE_ESRI_STREET =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
const TILE_ESRI_SAT =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TILE_OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const ESRI_ATTR = '&copy; <a href="https://www.esri.com/">Esri</a>'
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function SalesMap({ stands, currencyName }: { stands: AnalyticsStandRow[]; currencyName: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tileError, setTileError] = useState<string | null>(null)
  const positioned = useMemo(() => stands.filter((s) => s.location), [stands])
  const maxRevenue = useMemo(
    () => Math.max(1, ...positioned.map((s) => s.revenue)),
    [positioned],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || positioned.length === 0) return

    const map = L.map(container, {
      zoomControl: true,
      /* La rotella parte disattivata: se rubasse lo scroll, scorrendo la
         pagina col dito sopra la mappa si zoomerebbe invece di scorrere. Si
         attiva al primo click e si disattiva uscendo. I pulsanti +/- ci sono
         sempre. */
      scrollWheelZoom: false,
      maxZoom: NATIVE_ZOOM,
    })

    const streetLayer = L.tileLayer(TILE_ESRI_STREET, {
      attribution: ESRI_ATTR,
      maxZoom: NATIVE_ZOOM,
      maxNativeZoom: NATIVE_ZOOM,
    }).addTo(map)

    const satelliteLayer = L.tileLayer(TILE_ESRI_SAT, {
      attribution: ESRI_ATTR,
      maxZoom: NATIVE_ZOOM,
      maxNativeZoom: NATIVE_ZOOM,
    })

    const osmLayer = L.tileLayer(TILE_OSM, {
      attribution: OSM_ATTR,
      maxZoom: NATIVE_ZOOM,
      maxNativeZoom: NATIVE_ZOOM,
    })

    /* Scelta del layer, come nella mappa dell'evento: dal disegno del piazzale
       si vede subito quale banco ha la fila lunga. OSM non finisce qui: entra
       nel controllo solo se serve davvero (fallback), cosi' l'elenco non
       promette un provider che non e' ancora stato provato. */
    const layersControl = L.control.layers(
      { Satellite: satelliteLayer, Mappa: streetLayer },
      undefined,
      { position: 'bottomleft' },
    ).addTo(map)

    /* Alcuni errori prima di cambiare provider: uno sparso può essere un singolo
       tile lento, non un servizio irraggiungibile. */
    let esriErrors = 0
    let usingFallback = false
    streetLayer.on('tileerror', () => {
      esriErrors += 1
      if (usingFallback || esriErrors < 4) return
      /* Se l'operatore ha gia' scelto Satellite non gli si cambia sotto gli
         occhi il layer attivo. */
      if (!map.hasLayer(streetLayer)) return
      usingFallback = true
      map.removeLayer(streetLayer)
      layersControl.addBaseLayer(osmLayer, 'OpenStreetMap')
      osmLayer.addTo(map)
      osmLayer.on('tileerror', () => {
        setTileError(
          'Impossibile caricare la mappa: i dati restano disponibili nella tabella qui sotto.',
        )
      })
    })

    const bounds = L.latLngBounds([])
    for (const stand of positioned) {
      const popup = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = stand.number ? `#${stand.number} ${stand.standName}` : stand.standName
      const detail = document.createElement('div')
      detail.textContent = `${stand.orders} ordini · ${fmtNumber(stand.revenue)} ${currencyName}`
      popup.append(title, detail)

      L.circleMarker([stand.location!.lat, stand.location!.lng], {
        /* Raggio in PIXEL, radice del fatturato: altrimenti un fatturato 100x
           maggiore darebbe un cerchio 10x piu' grande di quanto serve. */
        radius: 9 + 17 * Math.sqrt(stand.revenue / maxRevenue),
        color: '#bf5a2a',
        weight: 2,
        fillColor: '#e08b4c',
        fillOpacity: 0.35,
      })
        .bindPopup(popup)
        .addTo(map)

      bounds.extend([stand.location!.lat, stand.location!.lng])
    }

    /* `fitBounds` va sempre con `maxZoom`: senza, su stand ravvicinati (o su
       un solo stand, dove i bounds sono degeneri ma `isValid()` dice vero)
       lo zoom viene spinto al massimo e i tile a quei livelli non esistono. */
    const fitAll = () => {
      if (positioned.length > 1 && bounds.isValid()) {
        map.fitBounds(bounds.pad(0.15), { maxZoom: SALES_MAP_ZOOM })
      } else {
        const only = positioned[0]!.location!
        map.setView([only.lat, only.lng], SALES_MAP_ZOOM)
      }
    }
    fitAll()

    /* Dopo che l'operatore ha girato la mappa a mano serve tornare alla vista
       d'insieme: Leaflet non ha un pulsante "fit", quindi lo aggiungiamo. */
    const fitControl = new L.Control({ position: 'topright' })
    fitControl.onAdd = () => {
      const btn = L.DomUtil.create('button', styles.mapBtn, container) as HTMLButtonElement
      btn.type = 'button'
      btn.title = 'Riquadra tutti gli stand'
      btn.setAttribute('aria-label', 'Riquadra tutti gli stand')
      btn.textContent = '⤢'
      btn.onclick = (e) => {
        L.DomEvent.stop(e)
        fitAll()
      }
      return btn
    }
    fitControl.addTo(map)

    const enableWheel = () => map.scrollWheelZoom.enable()
    const disableWheel = () => map.scrollWheelZoom.disable()
    container.addEventListener('click', enableWheel)
    container.addEventListener('mouseout', disableWheel)

    return () => {
      container.removeEventListener('click', enableWheel)
      container.removeEventListener('mouseout', disableWheel)
      map.remove()
    }
  }, [positioned, maxRevenue, currencyName])

  return (
    <>
      <div ref={containerRef} className={styles.map} />
      {tileError && <p className={styles.mapWarning}>{tileError}</p>}
    </>
  )
}

export function EventAnalyticsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [data, setData] = useState<EventAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [stands, setStands] = useState<StandOption[]>([])
  const [standId, setStandId] = useState('')

  // L'elenco stand serve solo alla select: non va ripollato con i dati.
  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    void apiRequest<{ items: StandOption[] }>(`/stands?eventId=${eventId}`)
      .then((res) => {
        if (!cancelled) setStands(res.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setStands([])
      })
    return () => { cancelled = true }
  }, [eventId])

  const sortedStands = useMemo(
    () => [...stands].sort((a, b) => {
      const na = standNumberOf(a, eventId ?? '')
      const nb = standNumberOf(b, eventId ?? '')
      if (na !== null && nb !== null && na !== nb) return na - nb
      if (na !== null) return -1
      if (nb !== null) return 1
      return a.name.localeCompare(b.name)
    }),
    [stands, eventId],
  )

  const selectedStandName = useMemo(
    () => stands.find((s) => s.id === standId)?.name ?? null,
    [stands, standId],
  )

  const load = useCallback(async () => {
    if (!eventId) return
    try {
      const result = await fetchEventAnalytics(
        eventId,
        from || undefined,
        to || undefined,
        standId || undefined,
      )
      setData(result)
      setForbidden(false)
    } catch {
      setForbidden(true)
    }
    setIsLoading(false)
  }, [eventId, from, to, standId])

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

  /* I filtri stanno in `.headerActions`, che in stampa viene nascosta: senza
     questa riga il foglio non dice più quale stand e quale periodo riporta. */
  const printScope = [
    data.window.from || data.window.to
      ? `Periodo: ${data.window.from || 'inizio evento'} - ${data.window.to || 'fine evento'}`
      : null,
    selectedStandName ? `Stand: ${selectedStandName}` : 'Stand: tutti',
  ].filter(Boolean).join(' \u00b7 ')

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <h1 className={styles.title}>Analisi vendite — {data.eventName}</h1>
          <div className={styles.headerActions}>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Stand</label>
              <select
                value={standId}
                onChange={(e) => { setIsLoading(true); setStandId(e.target.value) }}
                className={styles.dateInput}
                aria-label="Filtra per stand"
              >
                <option value="">Tutti gli stand</option>
                {sortedStands.map((s) => {
                  const n = standNumberOf(s, eventId)
                  return (
                    <option key={s.id} value={s.id}>
                      {n !== null ? `${n} \u2014 ` : ''}{s.name}
                    </option>
                  )
                })}
              </select>
            </div>
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

        <p className={styles.printScope}>{printScope}</p>

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
          <div className={styles.cardTitle}>Liquidazioni stand</div>
          <p className={styles.cardNote}>
            I crediti guadagnati sono cumulativi su tutto l&rsquo;evento, le liquidazioni sono
            quelle cadute nel periodo selezionato. Sono conti separati dal fatturato: un
            pagamento in euro a un gestore non &egrave; una vendita.
          </p>
          <div className={styles.kvGrid}>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Liquidati</span>
              <span className={styles.kvValue}>
                {fmtNumber(totals.settlements.settledCredits)} {data.currencyName}
              </span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Netto erogato</span>
              <span className={styles.kvValue}>{fmtEuro(totals.settlements.payoutEuro)} &euro;</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Trattenute</span>
              <span className={styles.kvValue}>{fmtEuro(totals.settlements.feeEuro)} &euro;</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Liquidazioni</span>
              <span className={styles.kvValue}>{totals.settlements.settlementCount}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Guadagnati e non liquidati</span>
              <span className={styles.kvValue}>
                {fmtNumber(totals.settlements.remainingEarnedCredits)} {data.currencyName}
              </span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Caricati e non rimborsati</span>
              <span className={styles.kvValue}>
                {fmtNumber(totals.settlements.toReturnCredits)} {data.currencyName}
              </span>
            </div>
          </div>
          {totals.settlements.standsNeverSettled > 0 && (
            <p className={styles.cardNote}>
              <span className={`${styles.pill} ${styles.pillWarn}`}>
                {totals.settlements.standsNeverSettled}{' '}
                {totals.settlements.standsNeverSettled === 1 ? 'stand mai liquidato' : 'stand mai liquidati'}
              </span>{' '}
              Stand che hanno guadagnato crediti ma non hanno mai ricevuto una liquidazione, nemmeno
              fuori dal periodo. Vedi il badge nella tabella qui sotto.
            </p>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Resoconto dei {data.currencyName}</div>
          <p className={styles.cardNote}>
            Prima met&agrave;: i flussi del periodo. Seconda met&agrave;: la fotografia di adesso,
            che &egrave; per definizione non filtrabile a pi&ograve; date.
          </p>

          <h3 className={styles.subTitle}>Movimenti del periodo</h3>
          <div className={styles.kvGrid}>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Caricati dai visitatori</span>
              <span className={styles.kvValue}>{fmtNumber(data.tokens.period.loaded)}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Rimborsi del banco cambio</span>
              <span className={styles.kvValue}>&minus;{fmtNumber(data.tokens.period.cashRefunded)}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Messi in circolazione</span>
              <span className={styles.kvValue}>{fmtNumber(data.tokens.period.netLoaded)}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Spesi in ordini</span>
              <span className={styles.kvValue}>{fmtNumber(data.tokens.period.spent)}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Quota spesa</span>
              <span className={styles.kvValue}>{fmtPercent(data.tokens.period.spentShareOfNetLoaded)}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Ancora non spesi</span>
              <span className={styles.kvValue}>{fmtNumber(data.tokens.period.remaining)}</span>
            </div>
          </div>

          <h3 className={styles.subTitle}>Situazione adesso</h3>
          <div className={styles.kvGrid}>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Nei portafogli</span>
              <span className={styles.kvValue}>{fmtNumber(data.tokens.snapshot.inCirculation)}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Nelle casse</span>
              <span className={styles.kvValue}>{fmtNumber(data.tokens.snapshot.inCash)}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Fondi di cassa</span>
              <span className={styles.kvValue}>
                {fmtNumber(data.tokens.snapshot.registerFloats + data.tokens.snapshot.legacyFloat)}
              </span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.kvLabel}>Quadratura</span>
              <span
                className={`${styles.pill} ${Math.abs(data.tokens.snapshot.gap) > 0.01 ? styles.pillWarn : ''}`}
              >
                {Math.abs(data.tokens.snapshot.gap) <= 0.01
                  ? 'coerente'
                  : `scarto ${fmtNumber(data.tokens.snapshot.gap)}`}
              </span>
            </div>
          </div>
          {Math.abs(data.tokens.snapshot.gap) > 0.01 && (
            <p className={styles.cardNote}>
              I portafogli e le transazioni non tornano: può essere un intervento manuale o un
              caricamento a cassa non ancora registrato. Meglio saperlo che leggerlo come fatturato.
            </p>
          )}

          {data.tokensByProduct.length > 0 && (
            <>
              <h3 className={styles.subTitle}>Dove sono finiti i {data.currencyName} spesi</h3>
              <p className={styles.cardNote}>
                I crediti usati su un ordine multi-riga sono ripartiti sulle righe in proporzione
                al loro importo: un prodotto &egrave; cos&igrave; pagato solo in parte.
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Prodotto</th>
                      <th>Stand</th>
                      <th className={styles.num}>Quantit&agrave;</th>
                      <th className={styles.num}>{data.currencyName}</th>
                      <th className={styles.num}>Quota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tokensByProduct.map((product) => (
                      <tr key={`${product.eventProductId}-${product.standName}`}>
                        <td>{product.productName}</td>
                        <td>{product.standName}</td>
                        <td className={styles.num}>{product.quantity}</td>
                        <td className={styles.num}>{fmtNumber(product.tokens)}</td>
                        <td className={styles.num}>{fmtPercent(product.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
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
                    <th className={styles.num}>Guadagnati</th>
                    <th className={styles.num}>Liquidati</th>
                    <th className={styles.num}>Da liquidare</th>
                    <th>Liquidazione</th>
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
                      <td className={styles.num}>{fmtNumber(stand.earnedCredits)}</td>
                      <td className={styles.num}>{fmtNumber(stand.settledCredits)}</td>
                      <td className={styles.num}>{fmtNumber(stand.remainingEarnedCredits)}</td>
                      <td>
                        {stand.neverSettled ? (
                          <span className={`${styles.pill} ${styles.pillWarn}`}>mai liquidato</span>
                        ) : stand.settlementCount > 0 ? (
                          <>
                            {stand.settlementCount} liquidazione
                            {stand.settlementCount === 1 ? '' : 'ni'}
                            {stand.settlementCountAllTime > stand.settlementCount && (
                              <span className={styles.cardNote}>
                                {' '}
                                ({stand.settlementCountAllTime} in tutto)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className={styles.cardNote}>
                            {stand.earnedCredits > 0 ? 'nessuna nel periodo' : '—'}
                          </span>
                        )}
                        {stand.lastSettlementAt && (
                          <span className={styles.cardNote}> &middot; ultima {fmtDateTime(stand.lastSettlementAt)}</span>
                        )}
                      </td>
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
                    <td className={styles.num}>{fmtNumber(totals.settlements.earnedCredits)}</td>
                    <td className={styles.num}>{fmtNumber(totals.settlements.settledCredits)}</td>
                    <td className={styles.num}>
                      {fmtNumber(totals.settlements.remainingEarnedCredits)}
                    </td>
                    <td>{totals.settlements.settlementCount} totali</td>
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