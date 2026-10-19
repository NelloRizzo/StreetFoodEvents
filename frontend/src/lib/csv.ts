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
