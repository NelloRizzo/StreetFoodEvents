import { describe, expect, it } from 'vitest'

import { analyticsCsvFilename, buildAnalyticsCsv, buildStandDetailCsv, buildTopProductsCsv, type AnalyticsCsvScope } from '../../lib/analyticsCsv'
import {
  type AnalyticsHourBucket,
  type AnalyticsStandRow,
  type EventAnalytics,
} from '../../lib/eventAnalytics'

/* Stessa tecnica del test di eventAnalytics: il bucket nasce dall'ora LOCALE,
   cosi' le aspettative sull'ora del grafico restano vere in qualunque fuso. */
function bucketAt(dayOffset: number, localHour: number, values: Partial<AnalyticsHourBucket> = {}): AnalyticsHourBucket {
  const local = new Date(2026, 9, 1 + dayOffset, localHour, 0, 0, 0)
  const naive = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), local.getHours())
  const drift = new Date(naive).getHours() - localHour
  return {
    bucketStart: new Date(naive - drift * 3600000).toISOString(),
    orders: 1,
    quantity: 2,
    revenue: 10,
    ...values,
  }
}

function standRow(values: Partial<AnalyticsStandRow>): AnalyticsStandRow {
  return {
    standId: 's1',
    standName: 'Panineria',
    number: 1,
    location: { lat: 1, lng: 2 },
    orders: 4,
    quantity: 9,
    revenue: 80,
    orderRevenue: 80,
    payoutCredits: 0,
    creditRevenue: 40,
    posRevenue: 20,
    cashRevenue: 20,
    prepOrders: 4,
    avgPrepSeconds: 90,
    earnedCredits: 100,
    settledCredits: 40,
    settledEuro: 20,
    loadedCredits: 0,
    grossEuro: 22,
    feeEuro: 2,
    payoutEuro: 20,
    toReturnCredits: 0,
    remainingEarnedCredits: 60,
    settlementCount: 1,
    loadCount: 0,
    settlementCountAllTime: 1,
    lastSettlementAt: null,
    neverSettled: false,
    ...values,
  }
}

function makeData(overrides: Partial<EventAnalytics> = {}): EventAnalytics {
  const base: EventAnalytics = {
    eventId: 'e1',
    eventName: 'Notti Cilentine',
    currencyName: 'Gettone',
    currencySymbol: null,
    exchangeRate: 2,
    window: { from: '2026-10-01', to: '2026-10-03' },
    totals: {
      orders: 10,
      quantity: 25,
      revenue: 200,
      orderRevenue: 150,
      payoutCredits: 50,
      creditRevenue: 120,
      posRevenue: 30,
      cashRevenue: 50,
      avgOrderValue: 20,
      distinctCustomers: 8,
      giftOrders: 1,
      prepOrders: 9,
      avgPrepSeconds: 150,
      settlements: {
        earnedCredits: 180,
        settledCredits: 60,
        settledEuro: 30,
        loadedCredits: 0,
        grossEuro: 33,
        feeEuro: 3,
        payoutEuro: 30,
        toReturnCredits: 15,
        remainingEarnedCredits: 120,
        settlementCount: 2,
        loadCount: 0,
        standsNeverSettled: 1,
      },
    },
    hourly: [bucketAt(0, 18, { orders: 2, quantity: 4, revenue: 30 }), bucketAt(1, 18, { orders: 3, quantity: 6, revenue: 45 }), bucketAt(1, 19, { orders: 1, quantity: 1, revenue: 5 })],
    topProducts: [
      { eventProductId: 'p1', productName: 'Panino', standId: 's1', standName: 'Panineria', number: 1, quantity: 12, revenue: 60 },
    ],
    prepBuckets: [
      { label: '0\'-2\'', count: 3 },
      { label: '2\'-5\'', count: 6 },
    ],
    byStand: [standRow({})],
    tokens: {
      period: {
        loaded: 1000,
        cashRefunded: 120,
        orderRefunded: 0,
        netLoaded: 880,
        spent: 500,
        spentShareOfNetLoaded: 0.568,
        remaining: 380,
      },
      snapshot: {
        inCirculation: 300,
        netFromTransactions: 300,
        gap: 0,
        inCash: 120,
        cashRegisterCount: 1,
        registerFloats: 100,
        legacyFloat: 0,
        movementsIn: 0,
        movementsOut: 0,
      },
      issued: {
        totalCredits: 1000,
        receivedCredits: 880,
        inCashCredits: 120,
        configuredCredits: 1000,
        denominationCount: 3,
        difference: 0,
      },
    },
    tokensByProduct: [],
  }
  return { ...base, ...overrides }
}

const EXPORTED_AT = new Date(2026, 9, 19, 15, 42)

function scopeWith(values: Partial<AnalyticsCsvScope> = {}): AnalyticsCsvScope {
  return { standName: null, hourDayKey: null, exportedAt: EXPORTED_AT, ...values }
}

/* Il separatore e' la virgola: ogni aspettativa di riga passa per `csvRow`,
   quindi un campo che contiene la virgola viene racchiuso e NON compare
   come sottostringa grezza. */
describe('buildAnalyticsCsv', () => {
  it('dichiara periodo, stand, valuta e tasso nella testata', () => {
    const csv = buildAnalyticsCsv(makeData(), scopeWith())
    expect(csv).toContain('Analisi vendite - Notti Cilentine')
    expect(csv).toContain('Periodo,2026-10-01 - 2026-10-03')
    expect(csv).toContain('Stand,tutti')
    expect(csv).toContain('Valuta evento,Gettone')
    expect(csv).toContain('Tasso di cambio,1 EUR = 2 Gettone')
    /* Data/ora con parti numeriche: niente dipende dal locale della macchina. */
    expect(csv).toContain('Esportato il,19/10/2026 15:42')
  })

  it('scrive "intero evento" quando la finestra e\' vuota', () => {
    const csv = buildAnalyticsCsv(makeData({ window: { from: '', to: '' } }), scopeWith())
    expect(csv).toContain('Periodo,intero evento')
  })

  it('elenca le sezioni nell\'ordine della pagina', () => {
    const csv = buildAnalyticsCsv(makeData(), scopeWith())
    const titles = [
      'RIEPILOGO',
      'LIQUIDAZIONI STAND',
      'RESOCONTO GETTONE - MOVIMENTI DEL PERIODO',
      'RESOCONTO GETTONE - SITUAZIONE ADESSO',
      'RESOCONTO GETTONE - EMESSI DAL BANCO',
      'VENDITE PER ORA',
      'TEMPO DI PREPARAZIONE',
      'PRODOTTI PIÙ VENDUTI',
      'DETTAGLIO PER STAND',
    ]
    const positions = titles.map((t) => csv.indexOf(`\r\n${t}\r\n`))
    positions.forEach((p) => expect(p).toBeGreaterThan(-1))
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('separa le righe con CRLF e non lascia newline isolate', () => {
    const csv = buildAnalyticsCsv(makeData(), scopeWith())
    expect(csv).not.toMatch(/(^|[^\r])\n/)
  })

  it('formatta i numeri con punto decimale e i rimborsi col segno meno', () => {
    const csv = buildAnalyticsCsv(makeData({ exchangeRate: 2 }), scopeWith())
    expect(csv).toContain('Fatturato (crediti),200')
    expect(csv).toContain('Fatturato (EUR),100.00')
    expect(csv).toContain('Quota spesa (%),56.8')
    expect(csv).toContain('Rimborsi del banco cambio,-120')
    expect(csv).toContain('Scarto di quadratura,0')
    expect(csv).toContain('Differenza emessi - configurati,0')
  })

  it('scrive "di cui" ordini e liquidazioni, per non far sembrare doppiato il fatturato', () => {
    const csv = buildAnalyticsCsv(makeData(), scopeWith())
    expect(csv).toContain('Fatturato da ordini (crediti),150')
    expect(csv).toContain('Fatturato da liquidazioni (crediti),50')
  })

  it('omette i tagli e la differenza quando non sono configurati', () => {
    const csv = buildAnalyticsCsv(makeData({
      tokens: {
        ...makeData().tokens,
        issued: { totalCredits: 100, receivedCredits: 80, inCashCredits: 20, configuredCredits: null, denominationCount: 0, difference: null },
      },
    }), scopeWith())
    expect(csv).not.toContain('Totale token')
    expect(csv).not.toContain('Differenza emessi')
  })

  it('accorpa le ore per giorno locale e rispetta il filtro giorno', () => {
    /* Due bucket alle 18:00 di due giorni diversi + una fascia alle 19:00. */
    const all = buildAnalyticsCsv(makeData(), scopeWith())
    expect(all).toContain('18:00,5,10,75')
    expect(all).toContain('19:00,1,1,5')
    expect(all).not.toContain('Giorno del grafico orario')

    const day = buildAnalyticsCsv(makeData(), scopeWith({ hourDayKey: '2026-10-02' }))
    expect(day).toContain('Giorno del grafico orario,2 ott')
    expect(day).toContain('18:00,3,6,45')
    expect(day).toContain('19:00,1,1,5')
    /* Il giorno precedente non deve comparire nemmeno sommato. */
    expect(day).not.toContain('18:00,5')
  })

  it('riporta la colonna Liquidazione con le stesse frasi della tabella', () => {
    const csv = buildAnalyticsCsv(makeData({
      byStand: [
        standRow({ standId: 'a', standName: 'Mai liquidato', neverSettled: true, earnedCredits: 90 }),
        standRow({
          standId: 'b',
          standName: 'Parzialmente',
          settlementCount: 2,
          settlementCountAllTime: 3,
          lastSettlementAt: new Date(2026, 9, 1, 18, 30).toISOString(),
        }),
        standRow({ standId: 'c', standName: 'Nessuna liquidazione', settlementCount: 0, earnedCredits: 50 }),
        standRow({ standId: 'd', standName: 'Niente da dire', settlementCount: 0, earnedCredits: 0 }),
      ],
    }), scopeWith())
    expect(csv).toContain('mai liquidato')
    expect(csv).toContain('2 liquidazioni (3 in tutto) · ultima 01/10 18:30')
    expect(csv).toContain('nessuna nel periodo')
    /* Senza guadagni e senza liquidazioni la cella resta vuota di senso. */
    expect(csv).toMatch(/,—(\r\n|$)/)
  })

  it('chiude il dettaglio per stand con la riga TOTALE della pagina', () => {
    const csv = buildAnalyticsCsv(makeData(), scopeWith())
    /* Il tempo di preparazione contiene il `"` della notazione `1'30"`: la
       cella va quindi racchiusa (RFC 4180), ed e' l'unico campo quotato. */
    expect(csv).toContain('1,Panineria,4,9,80,20,20,40,"1\'30""",100,40,60,1 liquidazione')
    expect(csv).toContain('—,TOTALE,10,25,200,50,30,120,"2\'30""",180,60,120,2 totali')
  })

  it('elenca i token per prodotto solo se presenti', () => {
    const without = buildAnalyticsCsv(makeData(), scopeWith())
    expect(without).not.toContain('TOKEN SPESI PER PRODOTTO')

    const withProducts = buildAnalyticsCsv(makeData({
      tokensByProduct: [
        { eventProductId: 'p1', productName: 'Panino', standName: 'Panineria', tokens: 120, share: 0.24, quantity: 6 },
      ],
    }), scopeWith())
    expect(withProducts).toContain('TOKEN SPESI PER PRODOTTO')
    expect(withProducts).toContain('Panino,Panineria,6,120,24')
  })

  it('lascia una riga "Nessun dato" nelle sezioni tabellari vuote', () => {
    const empty = buildAnalyticsCsv(makeData({
      hourly: [],
      topProducts: [],
      byStand: [],
      prepBuckets: [{ label: '0\'-2\'', count: 0 }],
      totals: { ...makeData().totals, prepOrders: 0 },
    }), scopeWith())
    expect(empty).toContain('Nessun dato nel periodo.')
    expect(empty).toContain('Nessun ordine pronto nel periodo.')
  })
})

describe('analyticsCsvFilename', () => {
  it('include stand, evento e finestra, ripuliti dai caratteri cattivi', () => {
    expect(analyticsCsvFilename(makeData(), scopeWith()))
      .toBe('analisi-vendite-tutti-gli-stand-Notti-Cilentine-2026-10-01_2026-10-03.csv')
    expect(analyticsCsvFilename(makeData({ eventName: 'Festa & Sagra', window: { from: '', to: '' } }), scopeWith({ standName: 'Panino "duro"' })))
      .toBe('analisi-vendite-Panino-duro-Festa-Sagra-inizio_fine.csv')
  })

  it('accoda il pezzo di sezione per non sovrascrivere il file unico', () => {
    expect(analyticsCsvFilename(makeData(), scopeWith(), 'dettaglio-stand'))
      .toBe('analisi-vendite-dettaglio-stand-tutti-gli-stand-Notti-Cilentine-2026-10-01_2026-10-03.csv')
    expect(analyticsCsvFilename(makeData(), scopeWith(), 'prodotti-piu-venduti'))
      .toBe('analisi-vendite-prodotti-piu-venduti-tutti-gli-stand-Notti-Cilentine-2026-10-01_2026-10-03.csv')
  })
})

/* I pulsanti in testa alle due tabelle scaricano una sezione sola: stessa
   builder (e dunque stesse righe) del file unico, con la testata di
   perimetro davanti. */
describe('buildStandDetailCsv', () => {
  it('porta la testata di perimetro e SOLO la sezione del dettaglio', () => {
    const csv = buildStandDetailCsv(makeData(), scopeWith())
    expect(csv).toContain('Analisi vendite - Notti Cilentine')
    expect(csv).toContain('Stand,tutti')
    expect(csv).toContain('Esportato il,19/10/2026 15:42')
    expect(csv).toContain('DETTAGLIO PER STAND')
    expect(csv).toContain('—,TOTALE,10,25,')
    /* Le altre sezioni non devono entrare: il file è la tabella, non la pagina. */
    expect(csv).not.toContain('RIEPILOGO')
    expect(csv).not.toContain('PRODOTTI PIÙ VENDUTI')
    expect(csv).not.toContain('VENDITE PER ORA')
  })

  it('rispetta il filtro stand nella testata', () => {
    const csv = buildStandDetailCsv(makeData(), scopeWith({ standName: 'Panineria' }))
    expect(csv).toContain('Stand,Panineria')
    expect(analyticsCsvFilename(makeData(), scopeWith({ standName: 'Panineria' }), 'dettaglio-stand'))
      .toBe('analisi-vendite-dettaglio-stand-Panineria-Notti-Cilentine-2026-10-01_2026-10-03.csv')
  })

  it('lascia la riga "Nessun dato" quando la tabella e\' vuota', () => {
    const csv = buildStandDetailCsv(makeData({ byStand: [] }), scopeWith())
    expect(csv).toContain('DETTAGLIO PER STAND')
    expect(csv).toContain('Nessun dato nel periodo.')
  })
})

describe('buildTopProductsCsv', () => {
  it('porta la testata e SOLO l\'elenco dei prodotti', () => {
    const csv = buildTopProductsCsv(makeData(), scopeWith({ hourDayKey: '2026-10-02' }))
    expect(csv).toContain('Analisi vendite - Notti Cilentine')
    expect(csv).toContain('Giorno del grafico orario,2 ott')
    expect(csv).toContain('PRODOTTI PIÙ VENDUTI')
    expect(csv).toContain('1,Panino,Panineria,12,60')
    expect(csv).not.toContain('DETTAGLIO PER STAND')
    expect(csv).not.toContain('RIEPILOGO')
  })

  it('lascia la riga "Nessun dato" quando non ci sono prodotti', () => {
    const csv = buildTopProductsCsv(makeData({ topProducts: [] }), scopeWith())
    expect(csv).toContain('PRODOTTI PIÙ VENDUTI')
    expect(csv).toContain('Nessun dato nel periodo.')
  })
})
