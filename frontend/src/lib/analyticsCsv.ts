import {
  aggregateHourlyByHour,
  filterBucketsByDay,
  formatDayKey,
  formatHourKey,
  formatSeconds,
  type AnalyticsStandRow,
  type EventAnalytics,
} from './eventAnalytics'
import {
  csvRow,
  dateTime,
  dateTimeOf,
  euro,
  num,
  pct,
  periodRangeLabel,
  sanitizeFilename,
} from './csv'

/**
 * Esportazione CSV della pagina «Analisi vendite».
 *
 * Un solo file con tutte le sezioni, nello stesso ordine in cui compaiono a
 * schermo: un click, un foglio leggibile. La costruzione è pura (dati + scope
 * → stringa) così si testa senza toccare il DOM; il download resta in
 * `lib/csv.ts`.
 *
 * Scelte deliberate:
 * - **Separatore virgola e punto decimale**, come ogni altro CSV del progetto:
 *   una cella decimale con la virgola verrebbe racchiusa fra virgolette, e in
 *   Excel una cifra virgolettata è testo che non si somma. Le colonne di
 *   percentuale portano `(% )` nell'intestazione invece di `%` nella cella,
 *   per lo stesso motivo.
 * - **Le quadrature escono numeriche** (`0` = coerente), non come il pill «scarto»
 *   della pagina: in un foglio di calcolo un testo non si somma, e lo scarto è
 *   esattamente il numero che si vuole controllare.
 * - **La vista per ora è quella della pagina**: stessa accorpamento per ora
 *   locale e stesso filtro giorno (`hourDayKey`), altrimenti il foglio
 *   riporterebbe dati diversi dal grafico accanto al bottone.
 * - **Le sezioni tabellari vuote restano**, con una riga «Nessun dato nel
 *   periodo»: un csv che salta una sezione non fa distinguere «non c'è» da
 *   «non l'hai esportata». Fa eccezione il dettaglio token-per-prodotto, che
 *   la pagina stessa mostra solo se presente.
 */

export type AnalyticsCsvScope = {
  /** Nome dello stand filtrato, `null` se la vista è su tutti gli stand. */
  standName: string | null
  /** Giorno del grafico orario (`YYYY-MM-DD`), `null` = tutti i giorni. */
  hourDayKey: string | null
  /** Istante di esportazione, per non leggere l'orologio dentro la builder. */
  exportedAt: Date
}

const EMPTY_SECTION_ROW = 'Nessun dato nel periodo.'

/** Durata nella notazione breve della pagina (`5'30"`), vuota se assente. */
function duration(seconds: number | null): string {
  return seconds === null ? '' : formatSeconds(seconds)
}

/**
 * Testo della colonna «Liquidazione» del dettaglio per stand: la stessa
 * frase che vede l'operatore nella tabella (badge «mai liquidato», numero di
 * liquidazioni, «nessuna nel periodo», data dell'ultima).
 */
function settlementLabel(stand: AnalyticsStandRow): string {
  const parts: string[] = []
  if (stand.neverSettled) {
    parts.push('mai liquidato')
  } else if (stand.settlementCount > 0) {
    /* Il "(N in tutto)" sta ATTACCATO al conteggio, come in pagina: in una
       cella CSV un segmento a sé diventerebbe "2 liquidazioni · (3 in tutto)". */
    let count = `${stand.settlementCount} liquidazion${stand.settlementCount === 1 ? 'e' : 'i'}`
    if (stand.settlementCountAllTime > stand.settlementCount) {
      count += ` (${stand.settlementCountAllTime} in tutto)`
    }
    parts.push(count)
  } else if (stand.earnedCredits > 0) {
    parts.push('nessuna nel periodo')
  }
  if (stand.lastSettlementAt) parts.push(`ultima ${dateTime(stand.lastSettlementAt)}`)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

/** Blocco `Indicatore,Valore` (riepilogo, liquidazioni, token). */
function kvSection(title: string, rows: (string | number)[][], out: string[]) {
  out.push('')
  out.push(title)
  out.push(csvRow('Indicatore', 'Valore'))
  for (const row of rows) out.push(csvRow(...row))
}

/** Testata comune a tutti i file di questa pagina (unica o per tabella):
 *  stesse etichette del `printScope` stampato, perché il file deve dire da
 *  solo quale periodo e quale stand riporta — tre esportazioni somigliano e
 *  non si sa più quale è quale. */
function analyticsTestata(data: EventAnalytics, scope: AnalyticsCsvScope, out: string[]) {
  const rate = data.exchangeRate || 1
  out.push(csvRow(`Analisi vendite - ${data.eventName}`))
  out.push(csvRow('Periodo', periodRangeLabel(data.window)))
  out.push(csvRow('Stand', scope.standName ?? 'tutti'))
  if (scope.hourDayKey) {
    out.push(csvRow('Giorno del grafico orario', formatDayKey(scope.hourDayKey)))
  }
  out.push(csvRow('Valuta evento', data.currencyName))
  out.push(csvRow('Tasso di cambio', `1 EUR = ${rate} ${data.currencyName}`))
  out.push(csvRow('Esportato il', dateTimeOf(scope.exportedAt)))
}

/**
 * Sezione «PRODOTTI PIÙ VENDUTI» (con la riga vuota di testa). La stessa
 * funzione alimenta il file unico e l'export del solo pulsante in testa alla
 * tabella: due versioni della stessa tabella divergono alla prima modifica.
 */
function topProductsSection(data: EventAnalytics, out: string[]) {
  const cur = data.currencyName
  out.push('')
  out.push('PRODOTTI PIÙ VENDUTI')
  out.push(csvRow('#', 'Prodotto', 'Stand', 'Quantità', `Ricavo (${cur})`))
  if (data.topProducts.length === 0) {
    out.push(csvRow(EMPTY_SECTION_ROW))
  } else {
    data.topProducts.forEach((p, i) => {
      out.push(csvRow(i + 1, p.productName, p.standName, p.quantity, num(p.revenue)))
    })
  }
}

/**
 * Sezione «DETTAGLIO PER STAND» con la riga TOTALE della pagina.
 */
function standDetailSection(data: EventAnalytics, out: string[]) {
  const cur = data.currencyName
  const { totals } = data
  out.push('')
  out.push('DETTAGLIO PER STAND')
  out.push(csvRow(
    'N.', 'Stand', 'Ordini', 'Quantità', `Fatturato (${cur})`, `Contanti (${cur})`,
    `POS (${cur})`, `Crediti (${cur})`, 'Preparazione', `Guadagnati (${cur})`,
    `Liquidati (${cur})`, `Da liquidare (${cur})`, 'Liquidazione',
  ))
  if (data.byStand.length === 0) {
    out.push(csvRow(EMPTY_SECTION_ROW))
    return
  }
  for (const s of data.byStand) {
    out.push(csvRow(
      s.number ?? '—',
      s.standName,
      s.orders,
      s.quantity,
      num(s.revenue),
      num(s.cashRevenue),
      num(s.posRevenue),
      num(s.creditRevenue),
      duration(s.avgPrepSeconds),
      num(s.earnedCredits),
      num(s.settledCredits),
      num(s.remainingEarnedCredits),
      settlementLabel(s),
    ))
  }
  out.push(csvRow(
    '—',
    'TOTALE',
    totals.orders,
    totals.quantity,
    num(totals.revenue),
    num(totals.cashRevenue),
    num(totals.posRevenue),
    num(totals.creditRevenue),
    duration(totals.avgPrepSeconds),
    num(totals.settlements.earnedCredits),
    num(totals.settlements.settledCredits),
    num(totals.settlements.remainingEarnedCredits),
    `${totals.settlements.settlementCount} totali`,
  ))
}

export function buildAnalyticsCsv(data: EventAnalytics, scope: AnalyticsCsvScope): string {
  const rows: string[] = []
  const rate = data.exchangeRate || 1
  const { totals } = data
  const cur = data.currencyName

  analyticsTestata(data, scope, rows)

  /* ── Riepilogo ───────────────────────────────────────────────────────
     Le due righe «di cui» rendono esplicito che il fatturato include il netto
     erogato: senza, la stessa vendita sembra contata due volte e nessuna
     frase di testo può spiegarlo dentro un foglio. */
  kvSection('RIEPILOGO', [
    ['Fatturato (crediti)', num(totals.revenue)],
    ['Fatturato (EUR)', euro(totals.revenue / rate)],
    ['Fatturato da ordini (crediti)', num(totals.orderRevenue)],
    ['Fatturato da liquidazioni (crediti)', num(totals.payoutCredits)],
    ['Ordini', totals.orders],
    ['Prodotti venduti', totals.quantity],
    ['Omaggi esclusi', totals.giftOrders],
    ['Clienti distinti', totals.distinctCustomers],
    ['Scontrino medio (crediti)', num(totals.avgOrderValue)],
    ['Tempo medio di preparazione', duration(totals.avgPrepSeconds)],
    ['Ordini arrivati a pronto', totals.prepOrders],
  ], rows)

  kvSection('LIQUIDAZIONI STAND', [
    ['Liquidati (crediti)', num(totals.settlements.settledCredits)],
    ['Netto erogato (EUR)', euro(totals.settlements.payoutEuro)],
    ['Trattenute (EUR)', euro(totals.settlements.feeEuro)],
    ['Liquidazioni', totals.settlements.settlementCount],
    ['Guadagnati e non liquidati (crediti)', num(totals.settlements.remainingEarnedCredits)],
    ['Caricati e non rimborsati (crediti)', num(totals.settlements.toReturnCredits)],
    ['Stand mai liquidati', totals.settlements.standsNeverSettled],
  ], rows)

  kvSection(`RESOCONTO ${cur.toUpperCase()} - MOVIMENTI DEL PERIODO`, [
    ['Caricati dai visitatori', num(data.tokens.period.loaded)],
    ['Rimborsi del banco cambio', num(-Math.abs(data.tokens.period.cashRefunded))],
    ['Messi in circolazione', num(data.tokens.period.netLoaded)],
    ['Spesi in ordini', num(data.tokens.period.spent)],
    ['Quota spesa (%)', pct(data.tokens.period.spentShareOfNetLoaded)],
    ['Ancora non spesi', num(data.tokens.period.remaining)],
  ], rows)

  kvSection(`RESOCONTO ${cur.toUpperCase()} - SITUAZIONE ADESSO`, [
    ['Nei portafogli', num(data.tokens.snapshot.inCirculation)],
    ['Nelle casse', num(data.tokens.snapshot.inCash)],
    ['Fondi di cassa', num(data.tokens.snapshot.registerFloats + data.tokens.snapshot.legacyFloat)],
    ['Scarto di quadratura', num(data.tokens.snapshot.gap)],
  ], rows)

  /* Emessi = event-wide, non filtrato: la riga lo dichiara nell'intestazione. */
  const issued = data.tokens.issued
  const issuedRows: (string | number)[][] = [
    ['Ricevuti dai visitatori (tutto l\'evento)', num(issued.receivedCredits)],
    ['Ancora nelle casse (tutto l\'evento)', num(issued.inCashCredits)],
    ['Emessi finora (tutto l\'evento)', num(issued.totalCredits)],
  ]
  if (issued.configuredCredits !== null) {
    issuedRows.push([
      `Totale token dell'evento (${issued.denominationCount} tagli)`,
      num(issued.configuredCredits),
    ])
  }
  if (issued.difference !== null) {
    /* Numerica e non «coerente»: zero si controlla col filtro del foglio. */
    issuedRows.push(['Differenza emessi - configurati', num(issued.difference)])
  }
  kvSection(`RESOCONTO ${cur.toUpperCase()} - EMESSI DAL BANCO`, issuedRows, rows)

  /* Token per prodotto: la pagina lo mostra solo se presente, idem qui. */
  if (data.tokensByProduct.length > 0) {
    rows.push('')
    rows.push('TOKEN SPESI PER PRODOTTO')
    rows.push(csvRow('Prodotto', 'Stand', 'Quantità', cur, 'Quota (%)'))
    for (const p of data.tokensByProduct) {
      rows.push(csvRow(p.productName, p.standName, p.quantity, num(p.tokens), pct(p.share)))
    }
  }

  /* ── Vendite per ora: stessa vista del grafico ───────────────────────── */
  rows.push('')
  rows.push('VENDITE PER ORA')
  rows.push(csvRow('Ora', 'Ordini', 'Prodotti', `Ricavo (${cur})`))
  const hourly = aggregateHourlyByHour(filterBucketsByDay(data.hourly, scope.hourDayKey || null))
  if (hourly.length === 0) {
    rows.push(csvRow(EMPTY_SECTION_ROW))
  } else {
    for (const bucket of hourly) {
      rows.push(
        csvRow(formatHourKey(bucket.hour), bucket.orders, bucket.quantity, num(bucket.revenue)),
      )
    }
  }

  /* ── Tempo di preparazione ───────────────────────────────────────────── */
  rows.push('')
  rows.push('TEMPO DI PREPARAZIONE')
  rows.push(csvRow('Intervallo', 'Ordini'))
  if (totals.prepOrders === 0) {
    rows.push(csvRow('Nessun ordine pronto nel periodo.'))
  } else {
    for (const bucket of data.prepBuckets) {
      rows.push(csvRow(bucket.label, bucket.count))
    }
  }

  /* ── Prodotti più venduti e dettaglio per stand: sezioni riusate anche
        dai pulsanti in testa alle singole tabelle ─────────────────────────── */
  topProductsSection(data, rows)
  standDetailSection(data, rows)

  return rows.join('\r\n')
}

/** Solo la tabella «Prodotti più venduti», con la testata di perimetro. */
export function buildTopProductsCsv(data: EventAnalytics, scope: AnalyticsCsvScope): string {
  const rows: string[] = []
  analyticsTestata(data, scope, rows)
  topProductsSection(data, rows)
  return rows.join('\r\n')
}

/** Solo la tabella «Dettaglio per stand» (con TOTALE), con la testata. */
export function buildStandDetailCsv(data: EventAnalytics, scope: AnalyticsCsvScope): string {
  const rows: string[] = []
  analyticsTestata(data, scope, rows)
  standDetailSection(data, rows)
  return rows.join('\r\n')
}

/** Nome file: `analisi-vendite[-<sezione>]-<stand>-<evento>-<da>_<a>.csv`.
 *  Il pezzo di sezione serve a non sovrascrivere il file unico quando si
 *  esporta una singola tabella dalla stessa pagina. */
export function analyticsCsvFilename(
  data: EventAnalytics,
  scope: AnalyticsCsvScope,
  sectionSlug?: string,
): string {
  const parts = ['analisi-vendite']
  if (sectionSlug) parts.push(sectionSlug)
  parts.push(scope.standName ? sanitizeFilename(scope.standName) : 'tutti-gli-stand')
  parts.push(sanitizeFilename(data.eventName))
  parts.push(`${sanitizeFilename(data.window.from || 'inizio')}_${sanitizeFilename(data.window.to || 'fine')}`)
  return `${parts.join('-')}.csv`
}
