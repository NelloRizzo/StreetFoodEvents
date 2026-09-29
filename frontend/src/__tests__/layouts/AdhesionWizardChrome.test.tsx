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
    if (path === '/auth/me/stands') return { stands: [] }
    if (path === '/auth/me/roles') return { isPlatformAdmin: true, roles: [] }
    /* evento SENZA regolamento: il wizard mostra il gate di indisponibilita' */
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
    /* evento con termine adesione gia' scaduto: serve per il test del
       banner di blocco, dove il wizard e' comunque renderizzato */
    if (path === '/events/evt3') {
      return {
        item: {
          id: 'evt3', name: 'Festa chiusa', startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-03T00:00:00.000Z',
          currencyName: 'Token', participationFee: 50, deposit: 20,
          participationFeeDeadline: null, depositDeadline: null,
          adhesionDeadline: '2020-01-01T00:00:00.000Z',
          regulationDocument: { url: 'https://example.com/regolamento.pdf' },
        },
      }
    }
    throw new Error('unexpected ' + path)
  }),
}))

vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(async () => {}),
  }),
}))

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { StandAdhesionWizardPage } from '../../pages/StandAdhesionWizardPage'

/* Il wizard di adesione online e' montato sotto PublicLayout sia nel sito
   operatore (/events/:eventId/stand-adhesion) sia nella PWA clienti: la
   chrome pubblica (navbar + bottom bar) deve restare visibile, e la pagina
   deve offrire un modo per tornare alla scheda dell'evento. */
const renderWizardInPublicLayout = (eventId = 'evt1') =>
  render(
    <MemoryRouter initialEntries={[`/events/${eventId}/stand-adhesion`]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="events/:eventId/stand-adhesion" element={<StandAdhesionWizardPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

describe('Wizard adesione online — chrome pubblica', () => {
  it('mostra la navbar pubblica sulla rotta del wizard', async () => {
    renderWizardInPublicLayout()

    // navbar: header con link alla home
    const brand = await screen.findByLabelText('Street Food Events home')
    expect(brand).toBeTruthy()
    expect(brand.getAttribute('href')).toBe('/')
  })

  it('offre un pulsante per tornare alla pagina dell\'evento', async () => {
    renderWizardInPublicLayout()

    await screen.findByLabelText('Street Food Events home')
    const back = screen.getByRole('link', { name: /Torna all'evento/i })
    expect(back.getAttribute('href')).toBe('/events/evt1')
  })

  /* Il gate "regolamento non pubblicato" e il gate "termine scaduto" sono
     schermate che bloccano il wizard: senza la via d'uscita l'utente
     rimarrebbe intrappolato nella pagina. */
  it('mostra la via d\'uscita anche quando il wizard e\' bloccato (termine scaduto)', async () => {
    renderWizardInPublicLayout('evt3')

    expect(await screen.findByText(/Non è più possibile compilare/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Torna all'evento/i })).toBeTruthy()
  })

  it('mostra la via d\'uscita anche quando il regolamento non e\' pubblicato', async () => {
    renderWizardInPublicLayout('evt2')

    expect(await screen.findByText(/pubblicato il regolamento/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Torna all'evento/i })).toBeTruthy()
  })
})
