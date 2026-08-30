export const ALLERGEN_OPTIONS = [
  { value: 'gluten', label: 'Glutine' },
  { value: 'crustaceans', label: 'Crostacei' },
  { value: 'eggs', label: 'Uova' },
  { value: 'fish', label: 'Pesce' },
  { value: 'peanuts', label: 'Arachidi' },
  { value: 'soy', label: 'Soia' },
  { value: 'milk', label: 'Latte' },
  { value: 'tree-nuts', label: 'Frutta a guscio' },
  { value: 'celery', label: 'Sedano' },
  { value: 'mustard', label: 'Senape' },
  { value: 'sesame', label: 'Sesamo' },
  { value: 'sulphites', label: 'Solfiti' },
  { value: 'lupins', label: 'Lupini' },
  { value: 'molluscs', label: 'Molluschi' },
]

export const ALLERGEN_LABELS: Record<string, string> = Object.fromEntries(
  ALLERGEN_OPTIONS.map((o) => [o.value, o.label])
)
