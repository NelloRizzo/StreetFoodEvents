import { describe, expect, it } from 'vitest'

import { buildSocialMenuCaption, formatEventDateRange } from '../../lib/socialMenu'

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

describe('buildSocialMenuCaption', () => {
  const base = {
    standName: 'Panino d\'Oro',
    eventName: 'Street Food Fest',
    startDate: '2026-09-05',
    endDate: '2026-09-07',
    productNames: ['Panino con porchetta', 'Tris di arrosticini'],
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
    const caption = buildSocialMenuCaption({ ...base, productNames: ['Panino', ''] })
    expect(caption).toContain('• Panino')
    expect(caption).toContain('• Panino')
    expect(caption).not.toMatch(/•\s*\n/)
  })

  it('omits menu section when no products', () => {
    const caption = buildSocialMenuCaption({ ...base, productNames: [] })
    expect(caption).not.toContain('Il nostro menu:')
    expect(caption).toContain('Vieni a trovarci!')
  })
})