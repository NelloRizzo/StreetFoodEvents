import type { VisitorsEstimate, VisitorStandEstimate } from './visitors'
import { csvRow, dateTimeOf, num, periodRangeLabel, sanitizeFilename } from './csv'

/**
 * Esportazione CSV della tabella «Dettaglio per stand» di «Stima visitatori».
 *
 * Esporta **solo quella tabella** (il pulsante sta in testa alla card), con la
 * testata di perimetro: periodo, valuta, tasso e data di esportazione. Stesse
 * regole di formato di `analyticsCsv.ts` — le convenzioni (separatore virgola,
 * punto decimale, BOM, `\r\n`) stanno in `lib/csv.ts`, qui non si inventa
 * niente di nuovo.
 *
 * Scelte deliberate:
 * - **Le due righe finali restano distinte**, come in pagina: «Somma delle
 *   righe» (somma grezza, non addizionabile) e «Totale evento (corretto)».
 *   Sono due numeri diversi per costruzione — unirli in un solo «totale»
 *   sarebbe mentire, e la seconda riga porta una nota che lo spiega.
 * - **Le categorie si aprono**: in pagina stanno in un `<details>` chiuso
 *   (`N categorie`), qui diventano `Categoria: q.tà × coefficiente = stima`
 *   separate da `;` in un'unica cella: un file deve tornare utile senza che
 *   nessuno clicchi niente.
 * - **Le spieghette dei badge diventano la colonna «Note»**: «nessun ordine»,
 *   «da liquidazione», «stima dedotta», ripartizione col mix dell'evento —
 *   sono il motivo per cui un numero è affidabile o no, e un foglio senza quel
 *   contesto induce a somme sbagliate.
 */

export type VisitorsCsvScope = {
  /** Istante di esportazione, per non leggere l'orologio dentro la builder. */
  exportedAt: Date
}

/** Il `<details>` della pagina, aperto: `Panini: 12 × 1 = 12; Bibite: 3 × …`. */
function categoriesCell(stand: VisitorStandEstimate): string {
  if (stand.categories.length === 0) return '—'
  return stand.categories
    .map((c) => `${c.label}: ${c.quantity} × ${num(c.coefficient)} = ${num(c.estimatedVisitors)}`)
    .join('; ')
}

/** I badge della riga (`nessun ordine`, `da liquidazione`, `stima dedotta`)
 *  e il mix con cui sono ripartiti i crediti liquidati, quando dice qualcosa. */
function notesCell(stand: VisitorStandEstimate): string {
  const notes: string[] = []
  if (!stand.hasOrders) notes.push('nessun ordine')
  if (stand.revenueSource === 'settlements') notes.push('da liquidazione')
  if (stand.estimationBasis === 'settlements') notes.push('stima dedotta')
  if (stand.settledCredits > 0 && stand.categoriesMix === 'event') {
    notes.push('crediti ripartiti sulle percentuali dell\'evento')
  }
  return notes.join('; ')
}

export function buildVisitorsStandCsv(data: VisitorsEstimate, scope: VisitorsCsvScope): string {
  const rows: string[] = []
  const cur = data.currencyName
  const { totals } = data

  /* Testata: stesse etichette degli altri export stampati, così tre fogli
     salvati in settimane diverse si distinguono a colpo d'occhio. */
  rows.push(csvRow(`Stima visitatori - ${data.eventName}`))
  rows.push(csvRow('Periodo', periodRangeLabel(data.window)))
  rows.push(csvRow('Valuta evento', cur))
  rows.push(csvRow('Tasso di cambio', `1 EUR = ${data.exchangeRate || 1} ${cur}`))
  rows.push(csvRow('Esportato il', dateTimeOf(scope.exportedAt)))

  rows.push('')
  rows.push('DETTAGLIO PER STAND')
  rows.push(csvRow(
    'N.', 'Stand', 'Ordini', 'Clienti', 'Quantità per categoria',
    `Guadagnati (${cur})`, `Liquidati (${cur})`, `Fatturato (${cur})`,
    'Stima visitatori', 'Note',
  ))
  if (data.stands.length === 0) {
    rows.push(csvRow('Nessun dato disponibile.'))
    return rows.join('\r\n')
  }

  for (const stand of data.stands) {
    rows.push(csvRow(
      stand.number ?? '—',
      stand.standName,
      stand.ordersCount,
      stand.distinctCustomers,
      categoriesCell(stand),
      num(stand.earnedCredits),
      num(stand.settledCredits),
      num(stand.revenue),
      num(stand.estimatedVisitorsTotal),
      notesCell(stand),
    ))
  }

  /* Le due righe finali della pagina: somma grezza e totale evento corretto.
     Sono distinte DI PROPOSITO — il totale corretto non è la somma delle
     righe, perché la sovrapposizione fra categorie si corregge solo a livello
     di evento. La nota lo dice anche a chi apre il file tra sei mesi. */
  const totalOrders = data.stands.reduce((sum, s) => sum + s.ordersCount, 0)
  const totalCustomers = data.stands.reduce((sum, s) => sum + s.distinctCustomers, 0)
  const rowsSum = Math.round(data.stands.reduce((sum, s) => sum + s.estimatedVisitorsTotal, 0) * 10) / 10
  const rowsRevenue = Math.round(data.stands.reduce((sum, s) => sum + s.revenue, 0) * 10) / 10
  rows.push(csvRow(
    '—', 'Somma delle righe', totalOrders, totalCustomers, '',
    num(totals.earnedCredits), num(totals.settledCredits), num(rowsRevenue), num(rowsSum),
    'somma grezza delle righe; non è il totale evento',
  ))
  rows.push(csvRow(
    '—', 'Totale evento (corretto)', '', '', '', '', '', '',
    num(totals.productEstimated),
    'corregge la sovrapposizione fra categorie: non è la somma delle righe',
  ))

  return rows.join('\r\n')
}

/** Nome file: `stima-visitatori-<evento>-<da>_<a>.csv`. */
export function visitorsCsvFilename(data: VisitorsEstimate): string {
  const from = sanitizeFilename(data.window.from || 'inizio')
  const to = sanitizeFilename(data.window.to || 'fine')
  return `stima-visitatori-${sanitizeFilename(data.eventName)}-${from}_${to}.csv`
}
