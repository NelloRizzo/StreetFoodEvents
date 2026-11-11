import { describe, expect, it, vi } from 'vitest'

const analyticsPayload = {
  eventId: 'evt1',
  eventName: 'Festa',
  currencyName: 'Token',
  currencySymbol: null,
  exchangeRate: 1,
  window: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-03T23:59:59.999Z' },
  totals: {
    orders: 5,
    quantity: 12,
    revenue: 100,
    orderRevenue: 100,
    payoutCredits: 0,
    creditRevenue: 40,
    posRevenue: 20,
    cashRevenue: 40,
    avgOrderValue: 20,
    distinctCustomers: 3,
    giftOrders: 1,
    cancelledOrders: 2,
    prepOrders: 4,
    avgPrepSeconds: 120,
    settlements: {
      earnedCredits: 100,
      settledCredits: 60,
      settledEuro: 60,
      loadedCredits: 0,
      grossEuro: 0,
      feeEuro: 0,
      payoutEuro: 0,
      toReturnCredits: 0,
      remainingEarnedCredits: 40,
      settlementCount: 1,
      loadCount: 0,
      standsNeverSettled: 0,
    },
  },
  hourly: [
    { bucketStart: '2026-09-01T18:00:00.000Z', orders: 3, quantity: 7, revenue: 60 },
    { bucketStart: '2026-09-01T19:00:00.000Z', orders: 2, quantity: 5, revenue: 40 },
  ],
  topProducts: [
    { eventProductId: 'p1', productName: 'Panino', standId: 's1', standName: 'Stand Uno', number: 1, quantity: 5, revenue: 50 },
  ],
  prepBuckets: [
    { label: "0'-2'", count: 2 },
    { label: "2'-5'", count: 1 },
    { label: "5'-10'", count: 1 },
    { label: "10'-15'", count: 0 },
    { label: "15'-20'", count: 0 },
    { label: "20'-30'", count: 0 },
    { label: "oltre 30'", count: 0 },
  ],
  byStand: [
    {
      standId: 's1',
      standName: 'Stand Uno',
      number: 1,
      location: { lat: 41.9, lng: 12.5 },
      orders: 5,
      quantity: 12,
      revenue: 100,
      orderRevenue: 100,
      payoutCredits: 0,
      creditRevenue: 40,
      posRevenue: 20,
      cashRevenue: 40,
      prepOrders: 4,
      avgPrepSeconds: 120,
      earnedCredits: 100,
      settledCredits: 60,
      settledEuro: 60,
      loadedCredits: 0,
      grossEuro: 0,
      feeEuro: 0,
      payoutEuro: 0,
      toReturnCredits: 0,
      remainingEarnedCredits: 40,
      settlementCount: 1,
      loadCount: 0,
      settlementCountAllTime: 1,
      lastSettlementAt: null,
      neverSettled: false,
    },
  ],
  tokens: {
    period: {
      loaded: 100,
      cashRefunded: 10,
      orderRefunded: 0,
      netLoaded: 90,
      spent: 40,
      spentShareOfNetLoaded: 0.44,
      remaining: 50,
    },
    snapshot: {
      inCirculation: 50,
      netFromTransactions: 50,
      gap: 0,
      inCash: 10,
      cashRegisterCount: 1,
      registerFloats: 5,
      legacyFloat: 0,
      movementsIn: 0,
      movementsOut: 0,
    },
    issued: {
      totalCredits: 100,
      receivedCredits: 90,
      inCashCredits: 10,
      configuredCredits: 100,
      denominationCount: 2,
      difference: 0,
    },
  },
  tokensByProduct: [
    { eventProductId: 'p1', productName: 'Panino', standName: 'Stand Uno', tokens: 40, share: 1, quantity: 5 },
  ],
}

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(async (path: string) => {
    if (path.startsWith('/stands')) return { items: [{ id: 's1', name: 'Stand Uno', numbers: [{ eventId: 'evt1', number: 1 }] }] }
    return analyticsPayload
  }),
}))

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EventAnalyticsPage } from '../../pages/EventAnalyticsPage'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/events/evt1/analytics']}>
      <Routes>
        <Route path="admin/events/:eventId/analytics" element={<EventAnalyticsPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('EventAnalyticsPage', () => {
  it('mostra le metriche principali e il dettaglio annullati', async () => {
    renderPage()
    expect(await screen.findByText(/Analisi vendite — Festa/)).toBeTruthy()
    expect(screen.getByText(/2 annullati/)).toBeTruthy()
    expect(screen.getByText(/art\.\/scontrino/)).toBeTruthy()
  })

  it('mostra il grafico delle vendite per ora', async () => {
    renderPage()
    expect(await screen.findByText('Vendite per ora')).toBeTruthy()
  })
})