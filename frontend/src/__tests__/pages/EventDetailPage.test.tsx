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

import { fireEvent, render, screen } from '@testing-library/react'
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

/* Le azioni dell'hero sono in tre fasce: i link esterni (sito ufficiale,
   Google Maps), l'adesione stand e i QR sono dentro il menu "Altro", quindi
   vanno aperti prima di cercarli.
   Le voci del menu portano role="menuitem" esplicito, quindi si cercano con
   quel ruolo e non con "link". */
const openAltro = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Altro/i }))
}

const siteLink = () => screen.queryByRole('menuitem', { name: /Sito ufficiale/i })

describe('pagina evento — link al sito ufficiale', () => {
  beforeEach(() => {
    apiRequest.mockClear()
    eventBase.url = null
  })

  it('non mostra nulla quando l\'evento non ha un sito', async () => {
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })
    await openAltro()
    expect(siteLink()).toBeNull()
  })

  it('mostra il link in nuova scheda quando il sito è presente', async () => {
    eventBase.url = 'https://www.festadiprova.it'
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })
    await openAltro()

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
    await openAltro()
    expect(siteLink()?.getAttribute('href')).toBe('https://festadiprova.it/')
  })

  it('NON rende un href con schema javascript: (stored-XSS dal form admin)', async () => {
    eventBase.url = 'javascript:alert(document.cookie)'
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })
    await openAltro()
    expect(siteLink()).toBeNull()
  })
})

describe('pagina evento — icone e ordine delle azioni', () => {
  beforeEach(() => {
    apiRequest.mockClear()
    eventBase.url = null
  })

  it('il cuore dei preferiti è la PRIMA azione, prima di Menù e Mappa', async () => {
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })

    const fav = screen.getByRole('button', { name: /Aggiungi ai preferiti/i })
    const menu = screen.getByRole('link', { name: 'Menù' })
    const mappa = screen.getByRole('link', { name: 'Mappa' })

    /* DOCUMENT_POSITION_FOLLOWING = 4: sta prima nell'ordine del documento. */
    expect(fav.compareDocumentPosition(menu) & 4).toBe(4)
    expect(fav.compareDocumentPosition(mappa) & 4).toBe(4)
  })

  it('le azioni sono icone con l\'etichetta come hint (title)', async () => {
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })

    const menu = screen.getByRole('link', { name: 'Menù' })
    expect(menu.getAttribute('title')).toBe('Menù')
    expect(screen.getByRole('link', { name: 'Mappa' }).getAttribute('title')).toBe('Mappa')
    expect(screen.getByRole('link', { name: 'Galleria' }).getAttribute('title')).toBe('Galleria')
    /* "Scatta foto" non e' presente: l'evento fixture e' gia' terminato e il
       bottone viene nascosto di proposito. */
    expect(screen.queryByRole('button', { name: 'Scatta foto' })).toBeNull()
  })

  it('l\'icona è decorativa e il testo resta nel DOM per il desktop', async () => {
    renderEventPage()
    await screen.findByRole('heading', { name: 'Festa di prova', level: 1 })

    /* L'icona ha aria-hidden per non finire nel nome accessibile, ma il testo
       esiste: sotto il breakpoint e' nascosto solo via CSS. */
    const menu = screen.getByRole('link', { name: 'Menù' })
    expect(menu.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(menu.textContent).toContain('Menù')
  })
})
