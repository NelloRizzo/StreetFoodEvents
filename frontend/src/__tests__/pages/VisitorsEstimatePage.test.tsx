import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(async () => payload),
}))

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { VisitorsEstimatePage } from '../../pages/VisitorsEstimatePage'

const stand = (over: Record<string, unknown>) => ({
  standId: 's1',
  standName: 'Stand',
  number: 1,
  hasOrders: true,
  ordersCount: 2,
  distinctCustomers: 2,
  categories: [],
  earnedCredits: 0,
  settledCredits: 0,
  estimatedVisitorsTotal: 0,
  ...over,
})

const payload = {
  eventId: 'evt1',
  eventName: 'Festa',
  currencyName: 'Token',
  currencySymbol: null,
  exchangeRate: 1,
  window: { from: '2026-09-01', to: '2026-09-03' },
  coefficientMap: { Panini: 1 },
  defaultCoefficient: 1,
  tokensPerVisitor: 10,
  overlap: { multiCategoryBasketShare: 0, mixedBaskets: 0, totalBaskets: 2 },
  totals: {
    productEstimated: 2,
    productEstimatedUnweighted: 2,
    tokenBasedEstimated: 2,
    settlementBasedEstimated: 4,
    distinctTokenBuyers: 2,
    distinctOrderCustomers: 2,
    nonCancelledOrders: 2,
    netTokensSold: 20,
    settledCredits: 40,
    unattributedSettledCredits: 0,
    earnedCredits: 40,
    settlementOnlyStands: 1,
    settlementOnlyRevenue: 40,
    settlementOnlyEstimatedVisitors: 4,
  },
  categories: [],
  stands: [
    stand({
      standId: 's1',
      standName: 'Stand Con Ordini',
      categories: [
        { label: 'Panini', quantity: 2, coefficient: 1, estimatedVisitors: 2, settledCredits: 10 },
      ],
      revenue: 20,
      revenueSource: 'orders',
      estimationBasis: 'orders',
      categoriesMix: 'stand',
      estimatedVisitorsFromSettlements: null,
      estimatedVisitorsTotal: 2,
    }),
    stand({
      standId: 's2',
      standName: 'Stand Solo Liquidazione',
      hasOrders: false,
      ordersCount: 0,
      settledCredits: 40,
      categories: [
        { label: 'Panini', quantity: 0, coefficient: 1, estimatedVisitors: 0, settledCredits: 35.6 },
      ],
      revenue: 40,
      revenueSource: 'settlements',
      estimationBasis: 'settlements',
      categoriesMix: 'event',
      estimatedVisitorsFromSettlements: 4,
      estimatedVisitorsTotal: 4,
    }),
  ],
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/events/evt1/visitors']}>
      <Routes>
        <Route path="admin/events/:eventId/visitors" element={<VisitorsEstimatePage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('VisitorsEstimatePage', () => {
  it('distingue la stima ricavata dalle quantita\' da quella dedotta dalla liquidazione', async () => {
    renderPage()

    expect(await screen.findByText('Stand Solo Liquidazione')).toBeTruthy()
    expect(screen.getByText('da liquidazione')).toBeTruthy()
    expect(screen.getByText('stima dedotta')).toBeTruthy()
    /* Il mix globale va dichiarato: e' la differenza fra "questo stand ha
     * venduto panini" e "l'evento ha venduto panini". */
    expect(screen.getByText(/mix di fatturato dell'evento/)).toBeTruthy()
  })

  it('non somma i visitatori dedotti al totale prodotti', async () => {
    renderPage()

    expect(await screen.findByText('Totale evento (corretto)')).toBeTruthy()
    /* La somma delle righe (2 + 4) e' il totale grezzo, il totale evento e' la
     * sola stima da prodotti: i 4 dedotti hanno una base diversa. */
    expect(screen.getByText('Somma delle righe')).toBeTruthy()
    const note = document.body.textContent ?? ''
    expect(note).toContain('Non vanno aggiunti alla stima prodotti')
  })
})
