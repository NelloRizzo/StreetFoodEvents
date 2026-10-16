import { beforeEach, describe, expect, it, vi } from 'vitest'

/* Le note del supervisore su questa pagina:
 *  - il form di associazione non deve piu' chiedere l'evento (e' quello
 *    attivo nella barra laterale);
 *  - "Nuovo prodotto" e "Aggiungi esistente" stanno in un pannello, non
 *    spinti in fondo alla pagina.
 *
 *  Il mock risponde a tutte le chiamate che la pagina fa all'avvio: senza,
 *  ogni effetto lancerebbe un errore e il test misurerebbe il mock, non la
 *  pagina. */

const created: { path: string; body: unknown }[] = []

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(async (path: string, init?: { bodyJson?: unknown }) => {
    if (init?.bodyJson) created.push({ path, body: init.bodyJson })

    if (path === '/stands/s1') {
      return {
        item: {
          id: 's1',
          name: "Panino d'Oro",
          slogan: null,
          description: null,
          logo: null,
          coverImage: null,
          eventIds: ['evt1', 'evt2'],
        },
      }
    }
    if (path.startsWith('/stations')) return { items: [{ id: 'st1', name: 'Banco 1', sequenceOrder: 1 }] }
    if (path.startsWith('/event-products')) return { items: [] }
    if (path.startsWith('/aliases')) return { items: [] }
    if (path.startsWith('/events/')) {
      return { item: { themeBrand: null, themeText: null, themeSurface: null, themeHighlight: null } }
    }
    if (path === '/events') {
      return {
        items: [
          // Due edizioni della stessa manifestazione: e' il caso per cui la
          // data accanto al nome serve.
          { id: 'evt1', name: 'Street Food', startDate: '2026-09-10T00:00:00.000Z', currencyName: 'Token', currencySymbol: null },
          { id: 'evt2', name: 'Street Food', startDate: '2027-09-10T00:00:00.000Z', currencyName: 'Token', currencySymbol: null },
        ],
      }
    }
    if (path === '/products') {
      return { items: [{ id: 'p1', name: 'Panino porchetta', price: 8, currencyName: '€' }] }
    }
    throw new Error('unexpected ' + path)
  }),
}))

vi.mock('../../lib/favorites', () => ({
  fetchFavorites: vi.fn(async () => ({ items: [] })),
  createFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
}))

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AdminEventContext } from '../../layouts/AdminEventContext'
import { ThemeProvider } from '../../features/theme/ThemeProvider'
import { StandDetailPage } from '../../pages/StandDetailPage'

const renderPage = (selectedEventId: string | null = 'evt1') =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/admin/stands/s1']}>
        <AdminEventContext.Provider
          value={
            {
              selectedEventId,
              selectedEvent: null,
              events: [],
            } as never
          }
        >
          <Routes>
            <Route path="/admin/stands/:standId" element={<StandDetailPage />} />
          </Routes>
        </AdminEventContext.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('pagina dello stand — i due moduli prodotto', () => {
  beforeEach(() => {
    created.length = 0
  })

  it('il modulo di associazione non chiede piu\' quale evento usare', async () => {
    renderPage('evt1')
    await screen.findByRole('heading', { name: "Panino d'Oro", level: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi esistente' }))

    /* Non deve esserci una select per l'evento: la scelta e' unica, sta
       nella barra laterale. */
    expect(screen.queryByLabelText('Evento')).toBeNull()
    /* L'evento attivo e' comunque dichiarato a schermo, con la sua data:
       con due edizioni della stessa manifestazione la differenza si vede
       li'. */
    expect(screen.getByText('Street Food — 10/09/2026')).toBeTruthy()
  })

  it('associa il prodotto all\'evento attivo, non a quello scelto nel form', async () => {
    renderPage('evt2')
    await screen.findByRole('heading', { name: "Panino d'Oro", level: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi esistente' }))
    await userEvent.selectOptions(screen.getByLabelText('Prodotto'), 'p1')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Banco 1' }))

    const submit = screen.getByRole('button', { name: 'Associa' })
    /* Il pulsante sta nel footer del pannello, fuori dal <form>: invia con
       l'attributo `form=`. Se l'attributo mancasse, il click non produrrebbe
       nessuna chiamata e il test qui sotto fallirebbe. */
    await waitFor(() => expect(submit).not.toBeDisabled())
    await userEvent.click(submit)

    await waitFor(() => {
      const call = created.find((c) => c.path === '/event-products')
      expect(call).toBeDefined()
      expect((call!.body as { eventId: string }).eventId).toBe('evt2')
    })
  })

  it('senza evento attivo non si puo\' associare, e si dice perche\'', async () => {
    renderPage(null)
    await screen.findByRole('heading', { name: "Panino d'Oro", level: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi esistente' }))

    expect(screen.getByText(/Nessun evento attivo/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Associa' })).toBeDisabled()
  })

  it('i due moduli si aprono in un pannello, non in fondo alla pagina', async () => {
    renderPage('evt1')
    await screen.findByRole('heading', { name: "Panino d'Oro", level: 1 })

    /* Il pannello ha un ruolo di dialogo: e' questo che distingue l'avere
       spostato i moduli dal solo aver cambiato una classe. */
    expect(screen.queryByRole('dialog')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Nuovo prodotto' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByLabelText('Nome *')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})