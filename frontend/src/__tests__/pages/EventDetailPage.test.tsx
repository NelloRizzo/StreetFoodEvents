import { beforeEach, describe, expect, it, vi } from 'vitest'

const eventBase = {
  id: 'evt1',
  name: 'Festa di prova',
  location: { label: 'Piazza Roma', city: 'Roma', googleMapsUrl: null, coordinates: null },
  startDate: '2026-09-10T00:00:00.000Z',
  endDate: '2026-09-12T00:00:00.000Z',
  currencyName: 'Token',
  currencySymbol: null,
  shortDescription: null,
  longDescription: null,
  url: null as string | null,
  coverImage: null,
  logo: null,
  regulationDocument: null,
  adhesionEnabled: false,
  gallery: [],
  themeBrand: null,
  themeText: null,
  themeSurface: null,
  themeHighlight: null,
  defaultFrameId: null,
}

const apiRequest = vi.fn(async (path: string) => {
  if (path.startsWith('/events/')) return { item: eventBase }
  if (path.startsWith('/stands')) return { items: [] }
  throw new Error('unexpected ' + path)
})

vi.mock('../../lib/api', () => ({ apiRequest: (p: string) => apiRequest(p) }))

vi.mock('../../lib/reviews', () => ({
  fetchReviewsSummary: async () => ({ event: { count: 0, average: null }, stands: [] }),
}))
vi.mock('../../lib/favorites', () => ({
  fetchFavorites: async () => [],
  createFavorite: async () => {},
  deleteFavorite: async () => {},
}))

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '../../features/theme/ThemeProvider'
import { EventDetailPage } from '../../pages/EventDetailPage'

const renderEventPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/events/evt1']}>
        <Routes>
          <Route path="events/:eventId" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )

/* Il link è <a href>: l'attributo va letto via getAttribute, perché
   jsdom non espone la normalizzazione dell'href assoluta. */
const siteLink = () => screen.queryByRole('link', { name: /Sito ufficiale/i })

describe('pagina evento — link al sito ufficiale', () => {
  beforeEach(() => {
    apiRequest.mockClear()
    eventBase.url = null
  })

  it('non mostra nulla quando l\'evento non ha un sito', async () => {
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })
    expect(siteLink()).toBeNull()
  })

  it('mostra il link in nuova scheda quando il sito è presente', async () => {
    eventBase.url = 'https://www.festadiprova.it'
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })

    const link = siteLink()
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('https://www.festadiprova.it/')
    expect(link?.getAttribute('target')).toBe('_blank')
    /* noopener: la nuova scheda non deve poter pilotare questa via window.opener */
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('aggiunge https a un dominio scritto senza schema', async () => {
    eventBase.url = 'festadiprova.it'
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })
    expect(siteLink()?.getAttribute('href')).toBe('https://festadiprova.it/')
  })

  it('NON rende un href con schema javascript: (stored-XSS dal form admin)', async () => {
    eventBase.url = 'javascript:alert(document.cookie)'
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })
    expect(siteLink()).toBeNull()
  })
})
