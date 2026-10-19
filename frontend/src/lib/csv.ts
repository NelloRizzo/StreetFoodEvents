/**
 * Utility CSV condivise per l'esportazione lato client.
 *
 * Prima di questo modulo le tre funzioni (`csvCell`, `downloadCsv`,
 * `sanitizeFilename`) vivevano private dentro `EventOrdersPage`: una seconda
 * pagina di esportazione le avrebbe copiate e le due versioni sarebbero
 * diverse alla prima modifica (regola vale per il resto dell'app: una sola
 * copia per cosa che deve restare identico).
 *
 * Convenzioni, uguali allo storico resoconto incassi:
 * - separatore **virgola** (`,`) e non punto e virgola;
 * - BOM UTF-8 in testa, cosi' Excel riconosce gli accenti ("più", "città");
 * - terminatore riga `\r\n` (Excel su Windows);
 * - le celle che contengono virgola, virgolette o a capo vengono racchiuse tra
 *   virgolette doppie (`""` per la virgoletta interna), RFC 4180.
 * I numeri restano con il punto decimale, come lo storico resoconto incassi:
 * una cella con la virgola decimale conterrebbe il separatore, verrebbe
 * racchiusa e in un foglio di calcolo **una cifra virgolettata e' testo che non
 * si somma**. Dettagli e scelte di formato delle sezioni: `analyticsCsv.ts`.
 */

export function csvCell(value: string | number): string {
  const str = String(value)
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

/** Riga CSV: celle già pronte, unite col separatore. */
export function csvRow(...cells: (string | number)[]): string {
  return cells.map(csvCell).join(',')
}

/** Scarica una stringa come file CSV (BOM + blob + anchor transitorio). */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** Nome file leggibile: qualsiasi carattere non alfanumerico diventa `-`,
 *  i trattini iniziali/finali vengono tagliati (un nome fatto solo di simboli
 *  altrimenti diventerebbe `-`), e un nome vuoto cade su `file`. */
export function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
}

/* ── Formati numerici e date ──────────────────────────────────────────────
   Convivono qui perché le regole devono essere identiche in ogni export
   (vedi l'intestazione del modulo): una copia per pagina diverge alla prima
   modifica e due fogli esportati dalla stessa pagina non si sommano più. */

/** Numero con al massimo due cifre decimali (crediti o euro: i centesimi
 *  bastano) e **punto decimale**: una cella con la virgola finirebbe tra
 *  virgolette e in un foglio di calcolo una cifra virgolettata è testo,
 *  non numero. */
export function num(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Euro con due decimali. */
export function euro(n: number): string {
  return n.toFixed(2)
}

/** Percentuale 0-1 → numero con una cifra decimale, **senza** simbolo `%`
 *  (l'intestazione di colonna lo dichiara). */
export function pct(value: number | null): string {
  if (value === null) return ''
  return String(Math.round(value * 1000) / 10)
}

/** Data/ora con parti numeriche: `01/10 18:30`. Niente `toLocaleString`,
 *  perché il risultato deve essere identico in ogni ambiente (e nei test). */
export function dateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Data/ora completa `01/10/2026 18:30`, per la testata dei file. */
export function dateTimeOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Etichetta periodo `da - a`, con fallback per gli estremi mancanti. */
export function periodRangeLabel(window: { from: string; to: string }): string {
  if (!window.from && !window.to) return 'intero evento'
  return `${window.from || 'inizio evento'} - ${window.to || 'fine evento'}`
}
