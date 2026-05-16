import { describe, expect, it } from 'vitest'

import { getSeasonalTheme } from '../../lib/theme'

describe('getSeasonalTheme', () => {
  it('returns summer for a date in June', () => {
    const date = new Date(2026, 5, 15)
    expect(getSeasonalTheme(date)).toBe('summer')
  })

  it('returns spring for a date in April', () => {
    const date = new Date(2026, 3, 15)
    expect(getSeasonalTheme(date)).toBe('spring')
  })

  it('returns autumn for a date in October', () => {
    const date = new Date(2026, 9, 15)
    expect(getSeasonalTheme(date)).toBe('autumn')
  })

  it('returns winter for a date in February', () => {
    const date = new Date(2026, 1, 15)
    expect(getSeasonalTheme(date)).toBe('winter')
  })

  it('returns christmas on December 25', () => {
    const date = new Date(2026, 11, 25)
    expect(getSeasonalTheme(date)).toBe('christmas')
  })

  it('returns christmas on January 1', () => {
    const date = new Date(2026, 0, 1)
    expect(getSeasonalTheme(date)).toBe('christmas')
  })

  it('returns easter on Easter Sunday 2026', () => {
    const date = new Date(2026, 3, 5)
    expect(getSeasonalTheme(date)).toBe('easter')
  })

  it('returns easter 3 days before Easter', () => {
    const date = new Date(2026, 3, 2)
    expect(getSeasonalTheme(date)).toBe('easter')
  })

  it('returns easter 3 days after Easter', () => {
    const date = new Date(2026, 3, 8)
    expect(getSeasonalTheme(date)).toBe('easter')
  })

  it('uses current date when no argument given', () => {
    const result = getSeasonalTheme()
    expect(['spring', 'summer', 'autumn', 'winter', 'christmas', 'easter']).toContain(result)
  })
})
