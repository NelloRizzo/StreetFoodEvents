const MONTHS_IT = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]

export function formatEventDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

  const fmtLong = (d: Date) => `${d.getDate()} ${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`

  if (start.toDateString() === end.toDateString()) return fmtLong(start)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} — ${fmtLong(end)}`
  }
  return `${fmtLong(start)} — ${fmtLong(end)}`
}

export function isEuroCurrency(currencyName: string | null | undefined): boolean {
  const t = (currencyName ?? '').trim().toLowerCase()
  if (!t) return true
  if (t === 'euro' || t === 'euros') return true
  return /^[^\p{L}\p{N}]$/u.test(t)
}

export function formatCredits(price: number): string {
  const rounded = Math.round(price * 100) / 100
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace('.', ',')
}

export function formatMonetaLine(
  currencyName: string | null | undefined,
  exchangeRate: number | null | undefined,
): string | null {
  const name = (currencyName ?? '').trim() || '€'
  if (isEuroCurrency(name)) return null
  const rate = Number.isFinite(exchangeRate) && exchangeRate! > 0 ? exchangeRate! : 1
  const euroPerUnit = 1 / rate
  const euroLabel =
    Math.round(euroPerUnit) === euroPerUnit
      ? String(Math.round(euroPerUnit))
      : euroPerUnit.toFixed(2).replace('.', ',')
  return `Moneta evento: ${name} (1 ${name} = ${euroLabel} €)`
}

export type SocialMenuCaptionProduct = {
  name: string
  price: number | null
}

export type SocialMenuCaptionInput = {
  standName: string
  standSlogan?: string | null
  eventName: string
  startDate: string
  endDate: string
  location?: string | null
  eventTagline?: string | null
  products: SocialMenuCaptionProduct[]
  menuUrl: string
  includePrices?: boolean
  currencyName?: string | null
  exchangeRate?: number | null
}

export function buildSocialMenuCaption(input: SocialMenuCaptionInput): string {
  const lines: string[] = []
  lines.push(input.standName.trim())
  if (input.standSlogan?.trim()) lines.push(input.standSlogan.trim())

  const place = [input.eventName.trim(), input.location?.trim()].filter(Boolean).join(' — ')
  if (place) lines.push(place)

  const dateRange = formatEventDateRange(input.startDate, input.endDate)
  if (dateRange) lines.push(dateRange)

  if (input.eventTagline?.trim()) lines.push(input.eventTagline.trim())

  const currency = (input.currencyName ?? '').trim() || '€'
  const products = input.products
    .map((p) => ({ name: p.name.trim(), price: p.price }))
    .filter((p) => p.name.length > 0)
  if (products.length > 0) {
    lines.push('')
    lines.push('Il nostro menu:')
    products.forEach((p) => {
      let line = `• ${p.name}`
      if (input.includePrices && p.price != null && p.price > 0) {
        line += ` ${formatCredits(p.price)} ${currency}`
      }
      lines.push(line)
    })
    const moneta = formatMonetaLine(input.currencyName, input.exchangeRate)
    if (input.includePrices && moneta) lines.push(moneta)
  }

  lines.push('')
  lines.push('Vieni a trovarci!')
  if (input.menuUrl) lines.push(input.menuUrl)

  return lines.join('\n')
}