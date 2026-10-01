import { describe, expect, it } from 'vitest'

import { formatHourLabel, formatSeconds } from '../../lib/eventAnalytics'

/* Il bucket arriva dal backend allineato all'ora UTC; l'etichetta deve usare
   l'ora LOCALE, altrimenti su un evento italiano il grafico risulta spostato.
   L'aspettativa e' calcolata con lo stesso formattatore, quindi il test
   fallirebbe in un fuso non UTC se l'implementazione usasse `$hour` in UTC. */
describe('formatHourLabel', () => {
  it('etichetta il bucket in ora locale, non in UTC', () => {
    const bucket = '2026-06-15T12:00:00.000Z'
    const expected = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })
      .format(new Date(bucket))
    expect(formatHourLabel(bucket)).toBe(expected)
  })

  it('produce sempre un\'ora fra 00 e 23', () => {
    for (let h = 0; h < 24; h += 1) {
      const iso = new Date(Date.UTC(2026, 5, 15, h)).toISOString()
      const label = formatHourLabel(iso)
      expect(label).toMatch(/^\d{2}:\d{2}$/)
    }
  })

  it('sposta l\'etichetta di un\'ora rispetto a UTC quando il fuso lo richiede', () => {
    /* 23:30 UTC: se il formattatore funzionasse, in Italia (UTC+2) sarebbe
       gia' il giorno dopo. Il test resta valido in ogni fuso. */
    const bucket = '2026-06-15T23:30:00.000Z'
    const localHour = new Date(bucket).getHours()
    expect(formatHourLabel(bucket).startsWith(String(localHour).padStart(2, '0'))).toBe(true)
  })
})

describe('formatSeconds', () => {
  it('scrive un trattino quando non ci sono dati', () => {
    expect(formatSeconds(null)).toBe('—')
  })

  it('usa i secondi sotto il minuto', () => {
    expect(formatSeconds(0)).toBe('0 s')
    expect(formatSeconds(45)).toBe('45 s')
  })

  it('usa i minuti, con i secondi solo se non sono zero', () => {
    expect(formatSeconds(60)).toBe('1 min')
    expect(formatSeconds(300)).toBe('5 min')
    expect(formatSeconds(330)).toBe('5 min 30 s')
  })
})