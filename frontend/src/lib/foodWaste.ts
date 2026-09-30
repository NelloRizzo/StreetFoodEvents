/* Specchio di FOOD_WASTE_PRACTICES in backend/src/models/stand-adhesion.model.ts:
 * se cambi una lista, cambiala in entrambi i file (il modulo stampabile usa
 * quella del backend, il wizard questa). */
export const FOOD_WASTE_PRACTICES = [
  // Approvvigionamento
  { key: 'purchase-planning', group: 'Approvvigionamento', label: 'Ordini ai fornitori basati su una stima di vendita', weight: 2 },
  { key: 'pack-sized-purchases', group: 'Approvvigionamento', label: 'Acquisti in formati adatti al consumo dello stand', weight: 1 },
  { key: 'local-suppliers', group: 'Approvvigionamento', label: 'Fornitori locali', weight: 1 },
  // Conservazione
  { key: 'fifo-labelling', group: 'Conservazione', label: 'FIFO con etichettatura e data di apertura dei prodotti', weight: 2 },
  { key: 'closed-containers', group: 'Conservazione', label: 'Stoccaggio in contenitori chiusi e separati per tipologia', weight: 1 },
  // Preparazione e servizio
  { key: 'small-batches', group: 'Preparazione e servizio', label: 'Preparazione in piccoli lotti o a richiesta, invece che in anticipo', weight: 2 },
  { key: 'measured-prep', group: 'Preparazione e servizio', label: 'Brodi, salse e preparazioni base quantificate sul venduto', weight: 2 },
  { key: 'last-minute-discount', group: 'Preparazione e servizio', label: 'Sconto dichiarato sul cibo in eccedenza a fine servizio', weight: 1 },
  // Eccedenze e misura
  { key: 'donate-surplus', group: 'Eccedenze e misura', label: 'Donazione delle eccedenze a soggetto autorizzato in convenzione', weight: 2 },
  { key: 'take-back-unsold', group: 'Eccedenze e misura', label: 'Ritiro a fine evento del non venduto anziché smaltimento', weight: 2 },
  { key: 'waste-log', group: 'Eccedenze e misura', label: 'Registro delle quantità di spreco', weight: 1 },
] as const

export const FOOD_WASTE_LABELS: Record<string, string> = Object.fromEntries(
  FOOD_WASTE_PRACTICES.map((p) => [p.key, p.label])
)

/** Gruppi nell'ordine in cui compaiono nel modulo stampabile. */
export const FOOD_WASTE_GROUPS: string[] = [...new Set(FOOD_WASTE_PRACTICES.map((p) => p.group))]

export function foodWasteScore(keys: string[]): number {
  const weights = new Map<string, number>(FOOD_WASTE_PRACTICES.map((p) => [p.key, p.weight]))
  return keys.reduce((sum, key) => sum + (weights.get(key) ?? 0), 0)
}
