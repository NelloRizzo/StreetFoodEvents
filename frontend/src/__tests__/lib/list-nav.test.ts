import { describe, expect, it } from 'vitest'

import { PAGE_SIZE, availableInitials, initialOf, paginate, startYearMonth } from '../../lib/list-nav'

describe('initialOf', () => {
  it('restituisce la lettera maiuscola', () => {
    expect(initialOf('Panino della casa')).toBe('P')
    expect(initialOf('  arancia')).toBe('A')
  })

  it('leva gli accenti, così «Ènoteca» resta raggiungibile da E', () => {
    expect(initialOf('Ènoteca')).toBe('E')
    expect(initialOf('Àncora')).toBe('A')
  })

  it('mette su # tutto cio che non e\' una lettera: numeri, emoji, vuoto', () => {
    expect(initialOf('2 Palle')).toBe('#')
    expect(initialOf('🍕 Pizzeria')).toBe('#')
    expect(initialOf('')).toBe('#')
  })
})

describe('availableInitials', () => {
  it('ordina in alfabetico e mette # in testa', () => {
    expect(availableInitials(['Zia', 'Bau', 'Arancia', '2 Palle'])).toEqual(['#', 'A', 'B', 'Z'])
  })

  it('non ripete le iniziali e le calcola sui nomi, non sulle posizioni', () => {
    expect(availableInitials(['Arancia', 'Anice', 'Banana'])).toEqual(['A', 'B'])
  })
})

describe('paginate', () => {
  it('taglia per pagina con PAGE_SIZE di default', () => {
    const items = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => i)
    const first = paginate(items, 1)
    expect(first.totalPages).toBe(2)
    expect(first.slice).toHaveLength(PAGE_SIZE)
    expect(first.slice[0]).toBe(0)

    const second = paginate(items, 2)
    expect(second.slice).toHaveLength(5)
    expect(second.slice[0]).toBe(PAGE_SIZE)
  })

  it('una lista vuota ha comunque una pagina, così non si mostra «0 di 0»', () => {
    const empty = paginate([], 1)
    expect(empty).toEqual({ page: 1, totalPages: 1, slice: [] })
    expect(paginate([], 7)).toEqual({ page: 1, totalPages: 1, slice: [] })
  })

  /* Dopo una cancellazione o un filtro piu' stretto la pagina salvata puo'
     superare il numero di pagine: senza questo clamp la lista diventerebbe
     vuota a fronte di voci presenti. */
  it('riporta la pagina entro i limiti', () => {
    const items = Array.from({ length: 25 }, (_, i) => i)
    expect(paginate(items, 99).page).toBe(2)
    expect(paginate(items, 99).slice[0]).toBe(20)
    expect(paginate(items, 0).page).toBe(1)
    expect(paginate(items, -3).page).toBe(1)
    expect(paginate(items, NaN).page).toBe(1)
  })

  it('rispetta una dimensione personalizzata', () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    const page = paginate(items, 3, 4)
    expect(page.totalPages).toBe(3)
    expect(page.slice).toEqual([8, 9])
  })
})

describe('startYearMonth', () => {
  /* `new Date(iso).getMonth()` legge il fuso della macchina: una data a
     mezzanotte con offset puo' finire nel mese/anno sbagliato. Leggere
     l'ISO come stringa e' lo stesso prefisso che usano card e form. */
  it('legge il prefisso ISO senza passare da Date', () => {
    expect(startYearMonth('2027-06-10T00:00:00.000Z')).toEqual({ year: 2027, month: 5 })
    expect(startYearMonth('2027-12-31T23:59:59.999Z')).toEqual({ year: 2027, month: 11 })
    expect(startYearMonth('2027-01-01T00:30:00+01:00')).toEqual({ year: 2027, month: 0 })
  })

  it('responde null su dati che non sono una data', () => {
    expect(startYearMonth('')).toBeNull()
    expect(startYearMonth('non-una-data')).toBeNull()
  })
})
