import { describe, expect, it } from 'vitest'

import {
  endOfDay,
  isEventFinished,
  isEventOngoing,
  isEventStarted,
  notStartedMessage,
} from '../../lib/eventSchedule'

/* Il `now` arriva sempre dal chiamante (`useState(() => Date.now())`): il lint
   React vieta `Date.now()` nel render, e i test fissano l'istante per non
   diventare fragili col tempo. */
const NOW = new Date('2026-10-05T12:00:00.000Z').getTime()

describe('isEventStarted', () => {
  it('l\'evento è iniziato quando la data d\'inizio è passata', () => {
    expect(isEventStarted('2026-10-01T00:00:00.000Z', NOW)).toBe(true)
  })

  it('l\'evento non è iniziato quando la data d\'inizio è futura', () => {
    expect(isEventStarted('2026-10-20T00:00:00.000Z', NOW)).toBe(false)
  })

  it('all\'esatto istante di inizio è già iniziato', () => {
    expect(isEventStarted('2026-10-05T12:00:00.000Z', NOW)).toBe(true)
  })

  it('senza data d\'inizio non blocca (fallire aperto)', () => {
    expect(isEventStarted(null, NOW)).toBe(true)
    expect(isEventStarted(undefined, NOW)).toBe(true)
    expect(isEventStarted('non-una-data', NOW)).toBe(true)
  })
})

describe('endOfDay / isEventFinished', () => {
  it('porta la data di fine a fine giornata', () => {
    const end = endOfDay('2026-10-05T00:00:00.000Z')
    expect(end?.getHours()).toBe(23)
    expect(end?.getMinutes()).toBe(59)
  })

  it('l\'evento non è terminato nella giornata di fine', () => {
    /* Fine giornata compresa: un evento che finisce oggi non è "terminato"
       fino a domani, altrimenti l'ultimo giorno non si lavora. */
    expect(isEventFinished('2026-10-05T00:00:00.000Z', NOW)).toBe(false)
  })

  it('l\'evento è terminato il giorno dopo la fine', () => {
    expect(isEventFinished('2026-10-04T00:00:00.000Z', NOW)).toBe(true)
  })

  it('senza data di fine non è mai terminato', () => {
    expect(isEventFinished(null, NOW)).toBe(false)
  })
})

describe('isEventOngoing', () => {
  it('vero solo nella finestra dell\'evento', () => {
    const evento = { startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-05T00:00:00.000Z' }
    expect(isEventOngoing(evento, NOW)).toBe(true)
  })

  it('falso prima del via', () => {
    const evento = { startDate: '2026-10-20T00:00:00.000Z', endDate: '2026-10-25T00:00:00.000Z' }
    expect(isEventOngoing(evento, NOW)).toBe(false)
  })

  it('falso dopo la fine', () => {
    const evento = { startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-05T00:00:00.000Z' }
    expect(isEventOngoing(evento, NOW)).toBe(false)
  })

  it('falso senza evento', () => {
    expect(isEventOngoing(null, NOW)).toBe(false)
  })
})

describe('notStartedMessage', () => {
  it('spiega il blocco quando l\'evento non è iniziato', () => {
    const messaggio = notStartedMessage({ startDate: '2026-10-20T00:00:00.000Z' }, NOW)
    expect(messaggio).not.toBeNull()
    expect(messaggio).toContain('non è ancora iniziato')
  })

  it('non dice nulla quando l\'evento è aperto', () => {
    expect(notStartedMessage({ startDate: '2026-10-01T00:00:00.000Z' }, NOW)).toBeNull()
    expect(notStartedMessage(null, NOW)).toBeNull()
  })
})