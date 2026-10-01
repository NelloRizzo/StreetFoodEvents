import { describe, expect, it } from 'vitest'

import { formatEarnedAt, progressLabel } from '../../lib/badges'

describe('progressLabel', () => {
  it('mostra il conteggio solo se il badge ha una soglia', () => {
    /* I badge "una tantum" (Primo ordine, Nottefondista) non hanno un
       conteggio da avvicinare: mostrarne uno sarebbe inventare un numero. */
    expect(progressLabel({ progress: 1, target: null })).toBeNull()
  })

  it('mostra "N su target" sotto la soglia', () => {
    expect(progressLabel({ progress: 2, target: 3 })).toBe('2 su 3')
    expect(progressLabel({ progress: 0, target: 2 })).toBe('0 su 2')
  })

  it('non supera mai il target nel testo', () => {
    /* Se il progresso arrivasse oltre la soglia (per esempio per un badge
       rinominato con una soglia piu' bassa) il testo non deve dire "5 su 3". */
    expect(progressLabel({ progress: 5, target: 3 })).toBeNull()
  })

  it('tace quando la soglia e\' stata raggiunta', () => {
    expect(progressLabel({ progress: 3, target: 3 })).toBeNull()
  })
})

describe('formatEarnedAt', () => {
  it('restituisce stringa vuota se la data manca', () => {
    expect(formatEarnedAt(null)).toBe('')
  })

  it('formatta la data di acquisizione in italiano', () => {
    const out = formatEarnedAt('2026-06-15T12:00:00.000Z')
    expect(out).not.toBe('')
    expect(out).toMatch(/2026/)
  })
})
