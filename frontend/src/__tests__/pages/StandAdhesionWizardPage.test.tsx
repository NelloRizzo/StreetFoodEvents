import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(async (path: string) => {
    if (path.includes('/adhesions/mine')) return { item: null }
    if (path === '/events/evt1') {
      return {
        item: {
          id: 'evt1', name: 'Festa', startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-03T00:00:00.000Z',
          currencyName: 'Token', participationFee: 50, deposit: 20,
        },
      }
    }
    if (path === '/auth/me/stands') return { stands: [] }
    if (path === '/auth/me/roles') return { isPlatformAdmin: true, roles: [] }
    throw new Error('unexpected ' + path)
  }),
}))

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StandAdhesionWizardPage } from '../../pages/StandAdhesionWizardPage'

describe('StandAdhesionWizardPage', () => {
  it('renders the wizard content', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/events/evt1/stand-adhesion']}>
        <StandAdhesionWizardPage />
      </MemoryRouter>,
    )
    const title = await screen.findByText(/Modulo di adesione alla manifestazione/)
    expect(title).toBeTruthy()
    expect(screen.getByText(/Dati mancanti per l'invio/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Invia per approvazione/ })).toBeTruthy()
  })
})