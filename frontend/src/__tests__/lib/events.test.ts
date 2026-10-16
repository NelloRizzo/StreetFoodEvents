import { describe, expect, it } from 'vitest'

import { eventWithDate } from '../../lib/events'

/* Il punto dell'helper e' una cosa sola: due edizioni della stessa
 * manifestazione devono risultare due etichette DIVERSE. Tutto il resto
 * (formato, fallback) e' secondario rispetto a questo. */

describe('eventWithDate', () => {
  it('due edizioni della stessa manifestazione sono etichette diverse', () => {
    const edizione2026 = { name: 'Street Food Roma', startDate: '2026-09-10T00:00:00.000Z' }
    const edizione2027 = { name: 'Street Food Roma', startDate: '2027-09-10T00:00:00.000Z' }

    expect(eventWithDate(edizione2026)).not.toBe(eventWithDate(edizione2027))
  })

  it('accanto al nome mette la data di inizio in formato italiano', () => {
    expect(eventWithDate({ name: 'Street Food Roma', startDate: '2026-09-10T00:00:00.000Z' })).toBe(
      'Street Food Roma — 10/09/2026',
    )
  })

  it('senza data mostra il solo nome, senza trattini', () => {
    expect(eventWithDate({ name: 'Street Food Roma', startDate: null })).toBe('Street Food Roma')
    expect(eventWithDate({ name: 'Street Food Roma' })).toBe('Street Food Roma')
  })

  /* Una data malformata non deve far cadere la pagina: l'etichetta resta
   * quella di prima, senza data. */
  it('una data non parsabile degrada al solo nome invece di lanciare', () => {
    expect(eventWithDate({ name: 'Street Food Roma', startDate: 'non-e-una-data' })).toBe(
      'Street Food Roma',
    )
  })

  it('su un evento assente restituisce una stringa vuota', () => {
    expect(eventWithDate(null)).toBe('')
    expect(eventWithDate(undefined)).toBe('')
  })
})