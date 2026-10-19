import { describe, expect, it } from 'vitest'

import { buildVisitorsStandCsv, visitorsCsvFilename } from '../../lib/visitorsCsv'
import type { VisitorsEstimate, VisitorStandEstimate } from '../../lib/visitors'

/* Tre copie che coprono i tre casi della pagina: stand normale (mix proprio),
   stand solo-liquidato (mix dell'evento, stima dedotta) e stand fermo. */
function standRow(values: Partial<VisitorStandEstimate>): VisitorStandEstimate {
  return {
    standId: 's1',
    standName: 'Panineria',
    number: 1,
    hasOrders: true,
    ordersCount: 12,
    distinctCustomers: 9,
    categories: [
      { label: 'Panini', quantity: 12, coefficient: 1, estimatedVisitors: 12, settledCredits: 40 },
      { label: 'Bibite', quantity: 3, coefficient: 0.5, estimatedVisitors: 1.5, settledCredits: 10 },
    ],
    categoriesMix: 'stand',
    estimationBasis: 'orders',
    revenue: 80,
    revenueSource: 'orders',
    estimatedVisitorsFromSettlements: null,
    estimatedVisitorsTotal: 13.5,
    earnedCredits: 100,
    settledCredits: 50,
    ...values,
  }
}

function makeData(overrides: Partial<VisitorsEstimate> = {}): VisitorsEstimate {
  const base: VisitorsEstimate = {
    eventId: 'e1',
    eventName: 'Notti Cilentine',
    currencyName: 'Gettone',
    currencySymbol: null,
    exchangeRate: 2,
    window: { from: '2026-10-01', to: '2026-10-03' },
    coefficientMap: {},
    defaultCoefficient: 1,
    tokensPerVisitor: 10,
    overlap: { multiCategoryBasketShare: 0.25, mixedBaskets: 3, totalBaskets: 12 },
    totals: {
      productEstimated: 100,
      productEstimatedUnweighted: 112,
      tokenBasedEstimated: 90,
      settlementBasedEstimated: 70,
      distinctTokenBuyers: 8,
      distinctOrderCustomers: 9,
      nonCancelledOrders: 12,
      netTokensSold: 900,
      settledCredits: 110,
      unattributedSettledCredits: 0,
      earnedCredits: 220,
      settlementOnlyStands: 1,
      settlementOnlyRevenue: 120,
      settlementOnlyEstimatedVisitors: 7.5,
    },
    categories: [],
    stands: [
      standRow({}),
      standRow({
        standId: 's2',
        standName: 'Griglia',
        number: 2,
        hasOrders: false,
        ordersCount: 0,
        distinctCustomers: 0,
        categories: [
          { label: 'Panini', quantity: 0, coefficient: 1, estimatedVisitors: 7.5, settledCredits: 60 },
        ],
        categoriesMix: 'event',
        estimationBasis: 'settlements',
        revenue: 120,
        revenueSource: 'settlements',
        estimatedVisitorsFromSettlements: 7.5,
        estimatedVisitorsTotal: 7.5,
        earnedCredits: 120,
        settledCredits: 60,
      }),
      /* Nome con la virgola: va racchiuso (RFC 4180), il file resta leggibile. */
      standRow({
        standId: 's3',
        standName: 'Chiosco, il gelato',
        number: null,
        hasOrders: false,
        ordersCount: 0,
        distinctCustomers: 0,
        categories: [],
        categoriesMix: null,
        estimationBasis: null,
        revenue: 0,
        revenueSource: null,
        estimatedVisitorsFromSettlements: null,
        estimatedVisitorsTotal: 0,
        earnedCredits: 0,
        settledCredits: 0,
      }),
    ],
  }
  return { ...base, ...overrides }
}

const EXPORTED_AT = new Date(2026, 9, 19, 15, 42)

describe('buildVisitorsStandCsv', () => {
  it('dichiara periodo, valuta, tasso e data di esportazione nella testata', () => {
    const csv = buildVisitorsStandCsv(makeData(), { exportedAt: EXPORTED_AT })
    expect(csv).toContain('Stima visitatori - Notti Cilentine')
    expect(csv).toContain('Periodo,2026-10-01 - 2026-10-03')
    expect(csv).toContain('Valuta evento,Gettone')
    expect(csv).toContain('Tasso di cambio,1 EUR = 2 Gettone')
    expect(csv).toContain('Esportato il,19/10/2026 15:42')
  })

  it('scrive "intero evento" quando la finestra e\' vuota', () => {
    const csv = buildVisitorsStandCsv(makeData({ window: { from: '', to: '' } }), { exportedAt: EXPORTED_AT })
    expect(csv).toContain('Periodo,intero evento')
  })

  it('apre il dettaglio per stand con la testata della tabella', () => {
    const csv = buildVisitorsStandCsv(makeData(), { exportedAt: EXPORTED_AT })
    expect(csv).toContain('DETTAGLIO PER STAND')
    expect(csv).toContain('N.,Stand,Ordini,Clienti,Quantità per categoria,Guadagnati (Gettone),Liquidati (Gettone),Fatturato (Gettone),Stima visitatori,Note')
  })

  it('espande le categorie come in pagina e tiene il punto decimale', () => {
    const csv = buildVisitorsStandCsv(makeData(), { exportedAt: EXPORTED_AT })
    /* Il `<details>` chiuso ("2 categorie") qui va aperto: un file deve tornare
       utile senza che nessuno clicchi. `0.5` con il PUNTO: una virgola
       decimale finirebbe tra virgolette e in Excel sarebbe testo (le colonne
       numeriche adiacenti sono separate dalla virgola di riga, non c'entra). */
    expect(csv).toContain('1,Panineria,12,9,Panini: 12 × 1 = 12; Bibite: 3 × 0.5 = 1.5,100,50,80,13.5,')
    expect(csv).not.toContain('Bibite: 3 × 0,5')
  })

  it('riporta i badge della riga nella colonna Note', () => {
    const csv = buildVisitorsStandCsv(makeData(), { exportedAt: EXPORTED_AT })
    /* Stand solo-liquidato: nessun ordine, fatturato da liquidazione, stima
       dedotta, crediti ripartiti col mix globale. */
    expect(csv).toContain(
      '2,Griglia,0,0,Panini: 0 × 1 = 7.5,120,60,120,7.5,nessun ordine; da liquidazione; stima dedotta; crediti ripartiti sulle percentuali dell\'evento',
    )
    /* Stand fermo: solo "nessun ordine" (il nome ha la virgola, quindi va
       racchiuso). */
    expect(csv).toContain('—,"Chiosco, il gelato",0,0,—,0,0,0,0,nessun ordine')
  })

  it('chiude con le due righe finali DISTINTE della pagina', () => {
    const csv = buildVisitorsStandCsv(makeData(), { exportedAt: EXPORTED_AT })
    /* Somma grezza: 12+0+0 ordini, 13.5+7.5+0 stime, 80+120+0 fatturato. */
    expect(csv).toContain('—,Somma delle righe,12,9,,220,110,200,21,somma grezza delle righe; non è il totale evento')
    /* Il totale corretto è il numero dell'evento (100), MAI la somma (21):
       le due righe restano separate con la nota che lo spiega. */
    expect(csv).toContain('—,Totale evento (corretto),,,,,,,100,corregge la sovrapposizione fra categorie: non è la somma delle righe')
  })

  it('separa le righe con CRLF e non lascia newline isolate', () => {
    const csv = buildVisitorsStandCsv(makeData(), { exportedAt: EXPORTED_AT })
    expect(csv).not.toMatch(/(^|[^\r])\n/)
  })

  it('lascia una riga "Nessun dato disponibile." (la frase della pagina)', () => {
    const csv = buildVisitorsStandCsv(makeData({ stands: [] }), { exportedAt: EXPORTED_AT })
    expect(csv).toContain('DETTAGLIO PER STAND')
    expect(csv).toContain('Nessun dato disponibile.')
    expect(csv).not.toContain('Somma delle righe')
  })
})

describe('visitorsCsvFilename', () => {
  it('include evento e finestra, ripuliti dai caratteri cattivi', () => {
    expect(visitorsCsvFilename(makeData()))
      .toBe('stima-visitatori-Notti-Cilentine-2026-10-01_2026-10-03.csv')
    expect(visitorsCsvFilename(makeData({ eventName: 'Festa & Sagra', window: { from: '', to: '' } })))
      .toBe('stima-visitatori-Festa-Sagra-inizio_fine.csv')
  })
})
