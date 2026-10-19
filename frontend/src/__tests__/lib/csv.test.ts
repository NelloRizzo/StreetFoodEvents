import { describe, expect, it } from 'vitest'

import { csvCell, csvRow, sanitizeFilename } from '../../lib/csv'

/* Separatore virgola (convenzione del resoconto incassi): la virgola dentro il
   testo va racchiusa, il resto no — la notazione dei tempi `5'30"` contiene
   solo apostrofo e virgoletta, e la virgoletta basta a farla quotare. */
describe('csvCell', () => {
  it('lascia semplici le celle senza virgola, a capo o virgoletta', () => {
    expect(csvCell('Panineria')).toBe('Panineria')
    expect(csvCell(42)).toBe('42')
    /* La notazione dei tempi `1'30"` contiene un virgoletta: e' l'unico caso
       in cui una cella di numeri finisce fra virgolette. */
    expect(csvCell("5'30\"")).toBe('"5\'30"""')
  })

  it('racchiude e raddoppia quando serve', () => {
    expect(csvCell('Città, duomo')).toBe('"Città, duomo"')
    expect(csvCell('Il "duro"')).toBe('"Il ""duro"""')
    expect(csvCell('a\nb')).toBe('"a\nb"')
    expect(csvCell('riga;altro;ancora')).toBe('riga;altro;ancora')
  })
})

describe('csvRow', () => {
  it('unisce le celle col separatore', () => {
    expect(csvRow('a', 1, 'b, c')).toBe('a,1,"b, c"')
  })
})

describe('sanitizeFilename', () => {
  it('riduce a lettere, cifre, trattini e underscore', () => {
    expect(sanitizeFilename('Notti Cilentine 2026!')).toBe('Notti-Cilentine-2026')
    expect(sanitizeFilename('***')).toBe('file')
  })
})
