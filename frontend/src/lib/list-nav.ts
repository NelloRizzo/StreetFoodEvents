/* Navigazione delle liste amministrative: paginazione client-side e filtri
   per iniziale / per data.

   Prodotti, Stand e Eventi scaricano l'intera lista dal server (`GET
   /products`, `/stands`, `/events` non hanno paginazione lato server) e
   paginano qui. La logica sta in un modulo puro — senza React né jsdom —
   così è testabile direttamente e le tre pagine non la riscrivono.

   Il filtro per iniziale e quello per data filtrano, non "saltano a":
   su una lista paginata lo scroll verso una voce di un'altra pagina non
   ha senso, e l'ordine del server (gli stand sono in numero progressivo
   per evento, non in ordine alfabetico) va conservato. */

/** Elementi per pagina, uguale su tutte le pagine che usano questo modulo. */
export const PAGE_SIZE = 20

export type PageSlice<T> = {
  /** Pagina richiesta, riportata entro i limiti validi. */
  page: number
  totalPages: number
  slice: T[]
}

/**
 * Taglia la lista sulla pagina chiediesta.
 *
 * La pagina va sempre passata da `paginate` per il rendering (mai la state
 * grezza): dopo una cancellazione o un filtro più stretto la state può
 * superare `totalPages` e la lista diventerebbe vuota a fronte di voci
 * presenti.
 */
export function paginate<T>(items: readonly T[], page: number, size: number = PAGE_SIZE): PageSlice<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages)
  const start = (current - 1) * size
  return { page: current, totalPages, slice: items.slice(start, start + size) }
}

/**
 * Iniziale di una voce per il navigatore: lettera A-Z maiuscola con gli
 * accenti levati (`Ènoteca` → `E`), `#` per tutto il resto (numeri, emoji,
 * nomi vuoti), così nessuna voce resta irraggiungibile dal filtro.
 */
export function initialOf(name: string): string {
  const base = (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .charAt(0)
    .toUpperCase()
  return base >= 'A' && base <= 'Z' ? base : '#'
}

/** Iniziali presenti nei nomi, in ordine alfabetico con `#` in testa. */
export function availableInitials(names: readonly string[]): string[] {
  const set = new Set(names.map(initialOf))
  return [...set].sort((a, b) => {
    if (a === '#') return -1
    if (b === '#') return 1
    return a.localeCompare(b)
  })
}

export const MONTH_LABELS = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
] as const

export type YearMonth = { year: number; month: number }

/**
 * Anno e mese di inizio evento letti **dall'ISO come stringa**, senza
 * passare da `Date`: è lo stesso prefisso che la card e il form usano già
 * (`startDate.slice(0, 10)`), quindi nessun fuso orario può spostare la
 * data di un giorno e la selezione coincide con ciò che l'operatore legge.
 */
export function startYearMonth(iso: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})/.exec(iso ?? '')
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1 }
}
