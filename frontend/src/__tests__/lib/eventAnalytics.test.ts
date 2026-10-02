import { describe, expect, it } from 'vitest'

import {
  aggregateHourlyByHour,
  filterBucketsByDay,
  formatDayKey,
  formatHourKey,
  formatHourLabel,
  formatSeconds,
  listBucketDays,
  localDayKey,
  type AnalyticsHourBucket,
} from '../../lib/eventAnalytics'

/* Costruisce un bucket allineato all'ora UTC partendo dall'ora LOCALE: e' cosi'
   che i test restano validi in qualunque fuso orario. Si passa per i getter
   locali e si corregge la deriva, altrimenti il bucket starebbe sull'ora UTC
   e le aspettative si sposterebbero di due ore su un evento italiano. */
function bucketAt(dayOffset: number, localHour: number, values: Partial<AnalyticsHourBucket> = {}): AnalyticsHourBucket {
  const local = new Date(2026, 9, 1 + dayOffset, localHour, 0, 0, 0)
  const naive = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), local.getHours())
  const drift = new Date(naive).getHours() - localHour
  return {
    bucketStart: new Date(naive - drift * 3600000).toISOString(),
    orders: 10,
    quantity: 20,
    revenue: 100,
    ...values,
  }
}

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

  it('usa i secondi con il doppio apostrofo sotto il minuto', () => {
    expect(formatSeconds(0)).toBe('0"')
    expect(formatSeconds(45)).toBe('45"')
  })

  it('usa l\'apostrofo per i minuti, coi secondi solo se non sono zero', () => {
    expect(formatSeconds(60)).toBe("1'")
    expect(formatSeconds(300)).toBe("5'")
    expect(formatSeconds(330)).toBe("5'30\"")
  })

  /* Arrotondando il resto si otterrebbe 1'60: il resto va calcolato sui secondi
   totali arrotondati, non sul resto della divisione. 59,6 s arrotondano a
   60 s, che è esattamente un minuto: `1'`, non `60"`. */
  it('non produce mai 60 secondi dopo un minuto', () => {
    expect(formatSeconds(119.6)).toBe("2'")
    expect(formatSeconds(59.6)).toBe("1'")
  })
})

/* Il backend raggruppa per giorno-ora, quindi su piu' giorni arrivano bucket
   con la stessa etichetta oraria: senza accorpamento il grafico ripete la
   stessa fascia una volta al giorno. */
describe('aggregateHourlyByHour', () => {
  it('somma le ore uguali dei giorni diversi in una sola barra', () => {
    const buckets = [
      bucketAt(0, 18, { orders: 5, quantity: 8, revenue: 100 }),
      bucketAt(1, 18, { orders: 7, quantity: 12, revenue: 200 }),
      bucketAt(2, 18, { orders: 3, quantity: 4, revenue: 50 }),
    ]

    const merged = aggregateHourlyByHour(buckets)

    expect(merged).toHaveLength(1)
    expect(merged[0].orders).toBe(15)
    expect(merged[0].quantity).toBe(24)
    expect(merged[0].revenue).toBe(350)
  })

  it('non duplica le etichette: una barra per ora distinta', () => {
    const buckets = [
      bucketAt(0, 18, { orders: 1 }),
      bucketAt(0, 19, { orders: 2 }),
      bucketAt(1, 18, { orders: 4 }),
      bucketAt(1, 20, { orders: 8 }),
    ]

    const labels = aggregateHourlyByHour(buckets).map((b) => formatHourKey(b.hour))

    expect(labels).toEqual([formatHourKey(18), formatHourKey(19), formatHourKey(20)])
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('ordina le fasce per ora crescente', () => {
    const merged = aggregateHourlyByHour([bucketAt(0, 20), bucketAt(0, 9), bucketAt(0, 14)])
    expect(merged.map((b) => b.hour)).toEqual([9, 14, 20])
  })

  it('non inventa fasce vuote e lascia intatti gli aggregati di un giorno solo', () => {
    const single = [bucketAt(0, 12, { orders: 6, quantity: 9, revenue: 150 })]
    const merged = aggregateHourlyByHour(single)
    expect(merged).toHaveLength(1)
    expect(merged[0].orders).toBe(6)
    expect(merged[0].quantity).toBe(9)
    expect(merged[0].revenue).toBe(150)
  })

  it('restituisce una lista vuota senza bucket', () => {
    expect(aggregateHourlyByHour([])).toEqual([])
  })
})

describe('filterBucketsByDay', () => {
  it('isola il giorno scelto', () => {
    const buckets = [bucketAt(0, 18), bucketAt(1, 18), bucketAt(2, 18)]
    const day = localDayKey(bucketAt(1, 18).bucketStart)

    const filtered = filterBucketsByDay(buckets, day)

    expect(filtered).toHaveLength(1)
    expect(localDayKey(filtered[0].bucketStart)).toBe(day)
  })

  it('restituisce tutto quando il giorno e\' nullo (tutti i giorni)', () => {
    const buckets = [bucketAt(0, 18), bucketAt(1, 18)]
    expect(filterBucketsByDay(buckets, null)).toHaveLength(2)
  })

  it('restituisce nulla se il giorno non ha ordini', () => {
    expect(filterBucketsByDay([bucketAt(0, 18)], '2020-01-01')).toEqual([])
  })
})

describe('localDayKey / listBucketDays', () => {
  it('ricava il giorno locale in formato YYYY-MM-DD', () => {
    expect(localDayKey(bucketAt(3, 22).bucketStart)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('elenca i giorni presenti nei bucket, senza duplicati e in ordine', () => {
    const buckets = [bucketAt(2, 12), bucketAt(0, 12), bucketAt(2, 18), bucketAt(1, 9)]

    const days = listBucketDays(buckets)

    expect(days).toHaveLength(3)
    expect([...days].sort()).toEqual(days)
    expect(days).toEqual([...new Set(days)])
  })
})

describe('formatDayKey', () => {
  it('scrive il giorno in formato leggibile', () => {
    expect(formatDayKey('2026-10-01')).toBe('1 ott')
  })
})

describe('formatHourKey', () => {
  it('allinea sempre l\'ora a due cifre', () => {
    expect(formatHourKey(0)).toBe('00:00')
    expect(formatHourKey(9)).toBe('09:00')
    expect(formatHourKey(18)).toBe('18:00')
  })
})