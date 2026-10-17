import { beforeEach, describe, expect, it, vi } from 'vitest'

/* Pagina del menu dell'evento: stessa esigenza della pagina del singolo
   stand, quindi gli stessi fixture e le stesse aspettative sulle card. */

const DESCRIPTION = 'Salsiccia, caciocavallo e peperoncino'

/* Il tipo e' dichiarato a parte: senza, TypeScript inferirebbe
   `description: string` dai valori iniziali e il test "senza descrizione"
   non assegnerebbe piu' null. */
type MenuItem = {
  standId: string
  standName: string
  standNumber: number | null
  standCoverImage: null
  standLogo: null
  eventProductId: string
  name: string
  description: string | null
  price: number
  ingredients: string[]
  allergens: string[]
  isFrozen: boolean
  coverImage: null
  categoryIds: string[]
}

const productBase: MenuItem = {
  standId: 'st1',
  standName: 'Stand Uno',
  standNumber: 1,
  standCoverImage: null,
  standLogo: null,
  eventProductId: 'ep1',
  name: 'Salsiccia e caciocavallo',
  description: DESCRIPTION,
  price: 7,
  ingredients: ['salsiccia', 'caciotta'],
  allergens: [],
  isFrozen: false,
  coverImage: null,
  categoryIds: ['Special'],
}

type MenuResponse = {
  event: {
    id: string
    name: string
    currencyName: string
    currencySymbol: null
    exchangeRate: number
  }
  categories: string[]
  items: MenuItem[]
  byCategory: Record<string, MenuItem[]>
}

let menuResponse: MenuResponse = {
  event: {
    id: 'evt1',
    name: 'Festa di prova',
    currencyName: 'Token',
    currencySymbol: null,
    exchangeRate: 1,
  },
  categories: ['Special'],
  items: [productBase],
  byCategory: { Special: [productBase] },
}

const apiRequest = vi.fn(async (path: string) => {
  if (path.startsWith('/events/')) return menuResponse
  throw new Error('unexpected ' + path)
})

vi.mock('../../lib/api', () => ({ apiRequest: (p: string) => apiRequest(p) }))

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '../../features/theme/ThemeProvider'
import { EventMenuPage } from '../../pages/EventMenuPage'
import styles from '../../pages/EventStandMenuPage.module.scss'

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/events/evt1/menu']}>
        <Routes>
          <Route path="events/:eventId/menu" element={<EventMenuPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )

const descNodes = () => document.querySelectorAll(`.${styles.menuDescription}`)

/* Stessa classe anche per la riga "Stand: N — Nome": si filtra per
   l'inizio del testo, altrimenti il test passerebbe anche senza
   etichetta. */
const ingredientNodes = () =>
  [...document.querySelectorAll(`.${styles.menuIngredients}`)].filter((el) =>
    el.textContent?.startsWith('Ingredienti: '),
  )

const allergenNodes = () =>
  [...document.querySelectorAll(`.${styles.menuAllergens}`)].filter((el) =>
    el.textContent?.startsWith('Allergeni: '),
  )

describe('menu evento — descrizione del prodotto in elenco', () => {
  beforeEach(() => {
    apiRequest.mockClear()
    menuResponse = {
      event: menuResponse.event,
      categories: ['Special'],
      items: [productBase],
      byCategory: { Special: [productBase] },
    }
  })

  it('la mostra nella vista per stand', async () => {
    renderPage()
    await screen.findByText('Salsiccia e caciocavallo')

    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()
    expect(descNodes()).toHaveLength(1)
  })

  it('la mostra anche nella vista per categorie', async () => {
    renderPage()
    await screen.findByText('Salsiccia e caciocavallo')

    fireEvent.click(screen.getByRole('tab', { name: /Per categorie/i }))

    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()
    expect(descNodes()).toHaveLength(1)
  })

  it('non rende nessun elemento quando il prodotto non ha descrizione', async () => {
    const senzaDescrizione: MenuItem = { ...productBase, description: null }
    menuResponse = {
      ...menuResponse,
      items: [senzaDescrizione],
      byCategory: { Special: [senzaDescrizione] },
    }
    renderPage()
    await screen.findByText('Salsiccia e caciocavallo')

    expect(descNodes()).toHaveLength(0)
  })

  it('la riga ingredienti inizia con "Ingredienti: " in entrambe le viste', async () => {
    renderPage()
    await screen.findByText('Salsiccia e caciocavallo')
    expect(ingredientNodes()[0].textContent).toBe('Ingredienti: salsiccia, caciotta')

    fireEvent.click(screen.getByRole('tab', { name: /Per categorie/i }))
    expect(ingredientNodes()).toHaveLength(1)
    expect(ingredientNodes()[0].textContent).toBe('Ingredienti: salsiccia, caciotta')
  })

  it('la riga "Stand:" della vista per categorie resta senza etichetta', async () => {
    renderPage()
    await screen.findByText('Salsiccia e caciocavallo')
    fireEvent.click(screen.getByRole('tab', { name: /Per categorie/i }))

    /* Nella vista per categorie la stessa classe disegna anche "Stand: N",
       che non e' una lista di ingredienti. */
    expect(screen.getByText(/^Stand: /).textContent?.startsWith('Ingredienti: ')).toBe(false)
    expect(ingredientNodes()).toHaveLength(1)
  })

  /* La descrizione e' HTML sanificato: in elenco resta testo piano (una riga
     sola, il markup la spezzerebbe), nel modale si vede come markup. */
  it('in elenco il markup della descrizione diventa testo piano', async () => {
    const conHtml: MenuItem = { ...productBase, description: '<p>Con <strong>peperoncino</strong> piccante</p>' }
    menuResponse = { ...menuResponse, items: [conHtml], byCategory: { Special: [conHtml] } }
    renderPage()
    await screen.findByText('Salsiccia e caciocavallo')

    const line = descNodes()[0]
    expect(line.textContent).toBe('Con peperoncino piccante')
    expect(line.querySelector('strong')).toBeNull()
  })

  it('nel modale il markup della descrizione viene reso', async () => {
    const conHtml: MenuItem = { ...productBase, description: '<p>Con <strong>peperoncino</strong> piccante</p>' }
    menuResponse = { ...menuResponse, items: [conHtml], byCategory: { Special: [conHtml] } }
    renderPage()
    fireEvent.click(await screen.findByText('Salsiccia e caciocavallo'))

    const dialog = await screen.findByRole('dialog')
    const strong = dialog.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong!.textContent).toBe('peperoncino')
  })
})

describe('menu evento — allergeni in elenco', () => {
  beforeEach(() => {
    apiRequest.mockClear()
    const conAllergeni: MenuItem = { ...productBase, allergens: ['gluten', 'milk'] }
    menuResponse = {
      event: menuResponse.event,
      categories: ['Special'],
      items: [conAllergeni],
      byCategory: { Special: [conAllergeni] },
    }
  })

  it('mostra la riga allergeni con le etichette nella vista per stand', async () => {
    renderPage()
    await screen.findByText('Salsiccia e caciocavallo')

    const lines = allergenNodes()
    expect(lines).toHaveLength(1)
    expect(lines[0].textContent).toBe('Allergeni: Glutine, Latte')
  })

  it('la mostra anche nella vista per categorie', async () => {
    renderPage()
    await screen.findByText('Salsiccia e caciocavallo')

    fireEvent.click(screen.getByRole('tab', { name: /Per categorie/i }))

    expect(allergenNodes()).toHaveLength(1)
    expect(allergenNodes()[0].textContent).toBe('Allergeni: Glutine, Latte')
  })
})