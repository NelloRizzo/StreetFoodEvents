import { describe, expect, it } from 'vitest'

import { medalForRank } from '../../lib/photoLikes'

/* Le medaglie sono l'unica cosa che rende visibile il podio in galleria: se il
   gradino non produce un glifo, la classifica sparisce senza errori. */
describe('medalForRank', () => {
  it('mappa i primi tre gradini sui glifi delle medaglie', () => {
    expect(medalForRank(1)).toBe('\u{1F947}')
    expect(medalForRank(2)).toBe('\u{1F948}')
    expect(medalForRank(3)).toBe('\u{1F949}')
  })

  it('oltre il podio non c\'è medaglia', () => {
    expect(medalForRank(4)).toBeNull()
    expect(medalForRank(10)).toBeNull()
  })

  it('senza gradino (nessun like) non c\'è medaglia', () => {
    expect(medalForRank(null)).toBeNull()
  })
})
