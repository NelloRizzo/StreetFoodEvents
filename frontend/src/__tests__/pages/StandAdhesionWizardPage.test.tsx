import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(async (path: string) => {
    if (path.includes('/adhesions/mine')) return { item: null }
    if (path === '/events/evt1') {
      return {
        item: {
          id: 'evt1', name: 'Festa', startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-03T00:00:00.000Z',
          currencyName: 'Token', participationFee: 50, deposit: 20,
          participationFeeDeadline: null, depositDeadline: null,
          regulationDocument: { url: 'https://example.com/regolamento.pdf' },
        },
      }
    }
    if (path === '/events/evt2') {
      return {
        item: {
          id: 'evt2', name: 'Festa senza regolamento', startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-03T00:00:00.000Z',
          currencyName: 'Token', participationFee: 50, deposit: 20,
          participationFeeDeadline: null, depositDeadline: null,
          regulationDocument: null,
        },
      }
    }
    if (path === '/auth/me/stands') return { stands: [] }
    if (path === '/auth/me/roles') return { isPlatformAdmin: true, roles: [] }
    throw new Error('unexpected ' + path)
  }),
}))

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { StandAdhesionWizardPage } from '../../pages/StandAdhesionWizardPage'

const renderWizard = (eventId: string) =>
  render(
    <MemoryRouter initialEntries={[`/events/${eventId}/stand-adhesion`]}>
      <Routes>
        <Route path="events/:eventId/stand-adhesion" element={<StandAdhesionWizardPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('StandAdhesionWizardPage', () => {
  it('renders the wizard content', async () => {
    renderWizard('evt1')
    const title = await screen.findByText(/Modulo di adesione alla manifestazione/)
    expect(title).toBeTruthy()
    expect(screen.getByText(/Dati mancanti per l'invio/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Invia per approvazione/ })).toBeTruthy()
  })

  it('shows the regulation notice when the event has no regulation document', async () => {
    renderWizard('evt2')
    const notice = await screen.findByText(/pubblicato il regolamento/i)
    expect(notice).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Invia per approvazione/ })).toBeNull()
  })
})