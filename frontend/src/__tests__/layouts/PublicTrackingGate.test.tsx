import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiRequest = vi.fn(async (path: string) => {
  if (path === '/auth/me/roles') return { isPlatformAdmin: true, roles: [{ slug: 'event-admin', scope: 'event' }] }
  if (path === '/events/evt1') {
    return { item: { id: 'evt1', name: 'Festa', startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-03T00:00:00.000Z' } }
  }
  return { item: null }
})

vi.mock('../../lib/api', () => ({ apiRequest: (p: string) => apiRequest(p) }))

vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', firstName: 'Ada', lastName: 'B' }, logout: vi.fn() }),
}))

/* Il modale di tracking fa polling: in questi test non deve partire. */
vi.mock('../../components/OrderTrackingModal', () => ({
  OrderTrackingModal: () => <div data-testid="tracking-modal" />,
}))

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'

/* isCustomersPwa() legge window.location.pathname, che in jsdom e' '/': per
   testare la variante PWA si sposta la history su un path /customers/... . */
const setPath = (path: string) => window.history.pushState({}, '', path)

const renderEventPage = (path: string) => {
  setPath(path)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="events/:eventId" element={<div>evento</div>} />
          <Route path="customers/events/:eventId" element={<div>evento</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const trackBtn = () => screen.queryByRole('button', { name: /tracking/i })

describe('tracking ordini — disponibilita\' per contesto', () => {
  beforeEach(() => {
    apiRequest.mockClear()
    setPath('/')
  })

  it('NON mostra il toggle tracking nella PWA clienti, nemmeno ad admin', async () => {
    renderEventPage('/customers/events/evt1')

    await screen.findByText('evento')
    expect(trackBtn()).toBeNull()
    expect(screen.queryByTestId('tracking-modal')).toBeNull()
  })

  it('non chiama /auth/me/roles nella PWA (nessun gating dei ruoli)', async () => {
    renderEventPage('/customers/events/evt1')
    await screen.findByText('evento')

    await waitFor(() => {
      expect(apiRequest.mock.calls.map((c) => String(c[0]))).not.toContain('/auth/me/roles')
    })
  })

  it('mostra il toggle tracking nel sito operatore per un admin', async () => {
    renderEventPage('/events/evt1')

    await waitFor(() => expect(trackBtn()).not.toBeNull(), { timeout: 3000 })
    expect(trackBtn()?.getAttribute('aria-label')).toBe('Abilita tracking')
  })
})
