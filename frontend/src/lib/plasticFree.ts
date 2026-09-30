/* Specchio di PLASTIC_FREE_PRACTICES in backend/src/models/stand-adhesion.model.ts.
 * Le due pratiche di tracciamento riduzione sprechi ("Ingredienti locali a km 0
 * certificati" e "Documentazione per la riduzione di sprechi") sono state
 * spostate nella lista anti-spreco: vedi lib/foodWaste.ts. */
export const PLASTIC_FREE_PRACTICES = [
  { key: 'compostable-plates', label: 'Piatti compostabili', weight: 2 },
  { key: 'compostable-cups', label: 'Bicchieri compostabili', weight: 2 },
  { key: 'waste-separation', label: 'Raccolta differenziata allo stand', weight: 1 },
  { key: 'used-oil-container', label: 'Contenitore olio esausto', weight: 1 },
  { key: 'digital-menu', label: 'Menu digitale', weight: 1 },
  { key: 'plastic-free-setup', label: 'Allestimento senza plastica', weight: 2 },
] as const

export const PLASTIC_FREE_LABELS: Record<string, string> = Object.fromEntries(
  PLASTIC_FREE_PRACTICES.map((p) => [p.key, p.label])
)

export function plasticFreeScore(keys: string[]): number {
  const weights = new Map<string, number>(PLASTIC_FREE_PRACTICES.map((p) => [p.key, p.weight]))
  return keys.reduce((sum, key) => sum + (weights.get(key) ?? 0), 0)
}