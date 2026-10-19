import {
  aggregateHourlyByHour,
  filterBucketsByDay,
  formatDayKey,
  formatHourKey,
  formatSeconds,
  type AnalyticsStandRow,
  type EventAnalytics,
} from './eventAnalytics'
import { csvRow, sanitizeFilename } from './csv'

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

/** Numero con al massimo due cifre decimali (crediti o euro: i centesimi
 *  bastano) e **punto decimale**, come ogni altro CSV del progetto (vedi il
 *  resoconto incassi): una cella con la virgola finirebbe tra virgolette e in
 *  un foglio di calcolo una cifra virgolettata è testo, non numero. */
function num(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Euro con due decimali, come la pagina (`fmtEuro`). */
function euro(n: number): string {
  return n.toFixed(2)
}

/** Percentuale 0-1 → numero con una cifra decimale, senza simbolo `%`
 *  (il valore arriva già come frazione, come lo stampa la pagina). */
function pct(value: number | null): string {
  if (value === null) return ''
  return String(Math.round(value * 1000) / 10)
}

/** Durata nella notazione breve della pagina (`5'30"`), vuota se assente. */
function duration(seconds: number | null): string {
  return seconds === null ? '' : formatSeconds(seconds)
}

/** Data/ora con parti numeriche: `01/10 18:30`. Niente `toLocaleString`,
 *  perché il risultato deve essere identico in ogni ambiente (e nei test). */
function dateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function dateTimeOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function periodLabel(data: EventAnalytics): string {
  const { from, to } = data.window
  if (!from && !to) return 'intero evento'
  return `${from || 'inizio evento'} - ${to || 'fine evento'}`
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

export function buildAnalyticsCsv(data: EventAnalytics, scope: AnalyticsCsvScope): string {
  const rows: string[] = []
  const rate = data.exchangeRate || 1
  const { totals } = data
  const cur = data.currencyName

  /* ── Testata ───────────────────────────────────────────────────────────
     Stesse etichette del `printScope` stampato: il file deve dire da solo
     quale periodo e quale stand riporta, altrimenti tre esportazioni
     somigliano e non si sa quale è quale. */
  rows.push(csvRow(`Analisi vendite - ${data.eventName}`))
  rows.push(csvRow('Periodo', periodLabel(data)))
  rows.push(csvRow('Stand', scope.standName ?? 'tutti'))
  if (scope.hourDayKey) {
    rows.push(csvRow('Giorno del grafico orario', formatDayKey(scope.hourDayKey)))
  }
  rows.push(csvRow('Valuta evento', cur))
  rows.push(csvRow('Tasso di cambio', `1 EUR = ${rate} ${cur}`))
  rows.push(csvRow('Esportato il', dateTimeOf(scope.exportedAt)))

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

  /* ── Prodotti più venduti ────────────────────────────────────────────── */
  rows.push('')
  rows.push('PRODOTTI PIÙ VENDUTI')
  rows.push(csvRow('#', 'Prodotto', 'Stand', 'Quantità', `Ricavo (${cur})`))
  if (data.topProducts.length === 0) {
    rows.push(csvRow(EMPTY_SECTION_ROW))
  } else {
    data.topProducts.forEach((p, i) => {
      rows.push(csvRow(i + 1, p.productName, p.standName, p.quantity, num(p.revenue)))
    })
  }

  /* ── Dettaglio per stand, con la riga TOTALE della pagina ──────────────── */
  rows.push('')
  rows.push('DETTAGLIO PER STAND')
  rows.push(csvRow(
    'N.', 'Stand', 'Ordini', 'Quantità', `Fatturato (${cur})`, `Contanti (${cur})`,
    `POS (${cur})`, `Crediti (${cur})`, 'Preparazione', `Guadagnati (${cur})`,
    `Liquidati (${cur})`, `Da liquidare (${cur})`, 'Liquidazione',
  ))
  if (data.byStand.length === 0) {
    rows.push(csvRow(EMPTY_SECTION_ROW))
  } else {
    for (const s of data.byStand) {
      rows.push(csvRow(
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
    rows.push(csvRow(
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

  return rows.join('\r\n')
}

/** Nome file: `analisi-vendite-<stand>-<evento>-<da>_<a>.csv`. */
export function analyticsCsvFilename(data: EventAnalytics, scope: AnalyticsCsvScope): string {
  const standSlug = scope.standName ? sanitizeFilename(scope.standName) : 'tutti-gli-stand'
  const from = sanitizeFilename(data.window.from || 'inizio')
  const to = sanitizeFilename(data.window.to || 'fine')
  return `analisi-vendite-${standSlug}-${sanitizeFilename(data.eventName)}-${from}_${to}.csv`
}
