import { describe, expect, it } from 'vitest'

import {
  buildSocialMenuCaption,
  formatEventDateRange,
  formatCredits,
  formatMonetaLine,
  isEuroCurrency,
} from '../../lib/socialMenu'

describe('formatEventDateRange', () => {
  it('formats a single-day event', () => {
    expect(formatEventDateRange('2026-09-05', '2026-09-05')).toBe('5 settembre 2026')
  })

  it('formats a same-month multi-day event', () => {
    expect(formatEventDateRange('2026-09-05', '2026-09-07')).toBe('5 — 7 settembre 2026')
  })

  it('formats a cross-month event', () => {
    expect(formatEventDateRange('2026-08-31', '2026-09-02')).toBe(
      '31 agosto 2026 — 2 settembre 2026',
    )
  })

  it('formats a cross-year event', () => {
    expect(formatEventDateRange('2026-12-31', '2027-01-02')).toBe(
      '31 dicembre 2026 — 2 gennaio 2027',
    )
  })

  it('returns empty string for invalid dates', () => {
    expect(formatEventDateRange('not-a-date', '2026-09-05')).toBe('')
  })
})

describe('formatCredits', () => {
  it('formats integers without decimals', () => {
    expect(formatCredits(12)).toBe('12')
    expect(formatCredits(12.0)).toBe('12')
  })

  it('formats decimals with the comma', () => {
    expect(formatCredits(12.5)).toBe('12,50')
    expect(formatCredits(12.3)).toBe('12,30')
  })
})

describe('formatMonetaLine / isEuroCurrency', () => {
  it('returns null for the euro currency', () => {
    expect(formatMonetaLine('€', 5)).toBeNull()
    expect(formatMonetaLine('euro', 5)).toBeNull()
    expect(formatMonetaLine(null, 5)).toBeNull()
  })

  it('renders the change for a named currency', () => {
    expect(formatMonetaLine('Token', 5)).toBe('Moneta evento: Token (1 Token = 0,20 €)')
  })

  it('renders 1 NOME = 1 € when the rate is 1', () => {
    expect(formatMonetaLine('Lira', 1)).toBe('Moneta evento: Lira (1 Lira = 1 €)')
  })

  it('detects euro by bare symbol', () => {
    expect(isEuroCurrency('€')).toBe(true)
    expect(isEuroCurrency('Token')).toBe(false)
    expect(isEuroCurrency('')).toBe(true)
  })
})

describe('buildSocialMenuCaption', () => {
  const base = {
    standName: 'Panino d\'Oro',
    eventName: 'Street Food Fest',
    startDate: '2026-09-05',
    endDate: '2026-09-07',
    products: [
      { name: 'Panino con porchetta', price: 12 },
      { name: 'Tris di arrosticini', price: 10 },
    ],
    menuUrl: 'https://app.example.com/events/e1/stands/s1',
  }

  it('includes stand name, event name, date and products without prices', () => {
    const caption = buildSocialMenuCaption(base)
    expect(caption).toContain('Panino d\'Oro')
    expect(caption).toContain('Street Food Fest')
    expect(caption).toContain('5 — 7 settembre 2026')
    expect(caption).toContain('• Panino con porchetta')
    expect(caption).toContain('• Tris di arrosticini')
    expect(caption).toContain('Vieni a trovarci!')
    expect(caption).toContain(base.menuUrl)
    expect(caption).not.toContain('€')
    expect(caption).not.toMatch(/\d+,\d{2}/)
  })

  it('appends slogan and location when present', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      standSlogan: 'Dal 1985 a Roma',
      location: 'Roma',
    })
    expect(caption).toContain('Dal 1985 a Roma')
    expect(caption).toContain('Street Food Fest — Roma')
  })

  it('skips empty product names', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      products: [
        { name: 'Panino', price: 5 },
        { name: '', price: 5 },
      ],
    })
    expect(caption).toContain('• Panino')
    expect(caption).not.toMatch(/•\s*\n/)
  })

  it('omits menu section when no products', () => {
    const caption = buildSocialMenuCaption({ ...base, products: [] })
    expect(caption).not.toContain('Il nostro menu:')
    expect(caption).toContain('Vieni a trovarci!')
  })

  it('includes prices with the currency when includePrices is on', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includePrices: true,
      currencyName: 'Token',
      exchangeRate: 5,
    })
    expect(caption).toContain('• Panino con porchetta 12 Token')
    expect(caption).toContain('• Tris di arrosticini 10 Token')
    expect(caption).toContain('Moneta evento: Token (1 Token = 0,20 €)')
  })

  it('uses the euro symbol for prices without a named currency', () => {
    const caption = buildSocialMenuCaption({ ...base, includePrices: true })
    expect(caption).toContain('• Panino con porchetta 12 €')
    expect(caption).not.toContain('Moneta evento:')
  })

  it('keeps products without price when price is null or 0', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includePrices: true,
      currencyName: 'Token',
      products: [
        { name: 'Omaggio', price: 0 },
        { name: 'Coffe break', price: null },
      ],
    })
    expect(caption).toContain('• Omaggio')
    expect(caption).toContain('• Coffe break')
    expect(caption).not.toContain('0 Token')
  })
})