export type SeasonalTheme = 'spring' | 'summer' | 'autumn' | 'winter' | 'christmas' | 'easter'

export type EventTheme = {
  brand: string
  text: string
  surface: string
  highlight: string
}

function easterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function isInRange(date: Date, monthStart: number, dayStart: number, monthEnd: number, dayEnd: number): boolean {
  const start = new Date(date.getFullYear(), monthStart - 1, dayStart)
  const end = new Date(date.getFullYear(), monthEnd - 1, dayEnd)
  return date >= start && date <= end
}

export function getSeasonalTheme(date: Date = new Date()): SeasonalTheme {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()

  // Natale: 15 dic – 6 gen
  if ((m === 12 && d >= 15) || (m === 1 && d <= 6)) return 'christmas'

  // Pasqua: ±3 giorni dalla domenica di Pasqua
  const easter = easterDate(y)
  const easterStart = new Date(easter)
  easterStart.setDate(easter.getDate() - 3)
  const easterEnd = new Date(easter)
  easterEnd.setDate(easter.getDate() + 3)
  if (date >= easterStart && date <= easterEnd) return 'easter'

  // Stagioni meteorologiche
  if (isInRange(date, 3, 1, 5, 31)) return 'spring'
  if (isInRange(date, 6, 1, 8, 31)) return 'summer'
  if (isInRange(date, 9, 1, 11, 30)) return 'autumn'
  return 'winter'
}
