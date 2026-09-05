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

export type SocialMenuCaptionInput = {
  standName: string
  standSlogan?: string | null
  eventName: string
  startDate: string
  endDate: string
  location?: string | null
  eventTagline?: string | null
  productNames: string[]
  menuUrl: string
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

  const names = input.productNames.map((n) => n.trim()).filter(Boolean)
  if (names.length > 0) {
    lines.push('')
    lines.push('Il nostro menu:')
    names.forEach((n) => lines.push(`• ${n}`))
  }

  lines.push('')
  lines.push('Vieni a trovarci!')
  if (input.menuUrl) lines.push(input.menuUrl)

  return lines.join('\n')
}