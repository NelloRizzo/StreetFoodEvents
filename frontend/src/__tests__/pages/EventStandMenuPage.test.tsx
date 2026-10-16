import { beforeEach, describe, expect, it, vi } from 'vitest'

/* La descrizione prodotto sta gia' nel payload (`productId` popolato per
   /event-products, `product.description` per /events/:id/menu): qui si
   verifica solo che arrivi a schermo anche in elenco, non solo nel modale. */

const DESCRIPTION = 'Pane con cotto, salsa speciale della casa'

const eventBase = {
  id: 'evt1',
  name: 'Festa di prova',
  logo: null,
  startDate: '2026-09-10T00:00:00.000Z',
  endDate: '2026-09-12T00:00:00.000Z',
  location: null,
  shortDescription: null,
  currencyName: 'Token',
  currencySymbol: null,
  exchangeRate: 1,
  themeBrand: null,
  themeText: null,
  themeSurface: null,
  themeHighlight: null,
}

const standOne = {
  id: 'st1',
  name: 'Stand Uno',
  slogan: null,
  description: null,
  coverImage: null,
  logo: null,
  gallery: [],
  numbers: [{ eventId: 'evt1', number: 1, showOnMap: true }],
}

const standTwo = {
  ...standOne,
  id: 'st2',
  name: 'Stand Due',
  numbers: [{ eventId: 'evt1', number: 2, showOnMap: true }],
}

/* Descrizione del prodotto principale: cambiata da ogni test. */
let productDescription: string | null = DESCRIPTION
let categoryDescription: string | null = null
/* Prodotti in menu: `null` = fixture standard (costruita al momento della
   fetch, cosi' i test che cambiano la descrizione sono visti), `[]` = stand
   senza menu. */
let eventProducts: unknown[] | null
/* Utente corrente: i due pulsanti di export compaiono solo per chi puo'
   esportare (platform-admin o proprietario dello stand). */
let authUser: { firstName: string; lastName: string; isPlatformAdmin?: boolean } | null = null

const apiRequest = vi.fn(async (path: string) => {
  if (path.startsWith('/events/evt1/menu')) {
    return {
      categories: ['Panini'],
      items: [
        {
          standId: 'st1',
          standName: 'Stand Uno',
          standNumber: 1,
          productId: 'p9',
          eventProductId: 'ep9',
          name: 'Panino categoria',
          description: categoryDescription,
          price: 6,
          ingredients: ['pane'],
          allergens: [],
          isFrozen: false,
          coverImage: null,
          categoryIds: ['Panini'],
          stationIds: ['s1'],
        },
      ],
    }
  }
  if (path.startsWith('/events/')) return { item: eventBase }
  if (path === '/stands/st1') return { item: standOne }
  if (path.startsWith('/event-products')) {
    /* La fixture e' costruita qui e non in beforeEach: un test che cambia
       `productDescription` deve vedere il valore nuovo nella fetch. */
    return { items: eventProducts ?? buildMenu() }
  }
  if (path.startsWith('/stands')) return { items: [standOne, standTwo] }
  throw new Error('unexpected ' + path)
})

vi.mock('../../lib/api', () => ({ apiRequest: (p: string) => apiRequest(p) }))
vi.mock('../../lib/reviews', () => ({
  fetchReviewsSummary: async () => ({ event: { count: 0, average: null }, stands: [] }),
}))
/* useAuth lancia fuori dal provider: l'utente e' variabile perche' i
   pulsanti di export social compaiono solo se l'operatore puo' esportare. */
vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: authUser != null, user: authUser }),
}))

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '../../features/theme/ThemeProvider'
import { EventStandMenuPage } from '../../pages/EventStandMenuPage'
/* La classe e' quella del module.scss: gli hash cambiano da build a build,
   quindi si importa lo stesso identico modulo invece di copiare il nome. */
import styles from '../../pages/EventStandMenuPage.module.scss'

const renderPage = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/events/evt1/stands/st1']}>
        <Routes>
          <Route path="events/:eventId/stands/:standId" element={<EventStandMenuPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )

const descNodes = () => document.querySelectorAll(`.${styles.menuDescription}`)

/* La classe dei secondi meta e' usata anche dalla riga "Stand: N — Nome",
   quindi si filtrano le righe che cominciano con l'etichetta. */
const ingredientNodes = () =>
  [...document.querySelectorAll(`.${styles.menuIngredients}`)].filter((el) =>
    el.textContent?.startsWith('Ingredienti: '),
  )

/* Fixture del menu letta al momento della fetch, così un test può cambiare
   i prodotti senza toccare il mock dell'API. */
const buildMenu = () => [
  {
    id: 'ep1',
    eventId: 'evt1',
    standId: 'st1',
    productId: 'p1',
    product: {
      id: 'p1',
      name: 'Panino della casa',
      description: productDescription,
      price: 5,
      ingredients: ['pane', 'cotto'],
      allergens: [],
      isFrozen: false,
      coverImage: null,
    },
    stationIds: ['s1'],
    priceOverride: null,
  },
]

const resetFixture = () => {
  apiRequest.mockClear()
  productDescription = DESCRIPTION
  categoryDescription = null
  authUser = null
  eventProducts = null
}

describe('menu stand — descrizione del prodotto in elenco', () => {
  beforeEach(() => {
    resetFixture()
  })

  it('mostra la descrizione nella card, senza dover aprire il modale', async () => {
    renderPage()
    await screen.findByText('Panino della casa')

    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()
    expect(descNodes()).toHaveLength(1)
  })

  it('non rende nessun elemento quando la descrizione manca', async () => {
    productDescription = null
    renderPage()
    await screen.findByText('Panino della casa')

    expect(descNodes()).toHaveLength(0)
  })

  it('non rende nessun elemento quando la descrizione e\' una stringa vuota', async () => {
    /* Il campo arriva dal form admin anche come "" (non solo null): senza il
       controllo truthy comparirebbe una riga vuota sotto il nome. */
    productDescription = ''
    renderPage()
    await screen.findByText('Panino della casa')

    expect(descNodes()).toHaveLength(0)
  })

  it('il modale mostra la descrizione per esteso', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('Panino della casa'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(DESCRIPTION)
  })
})

describe('menu stand — etichetta degli ingredienti', () => {
  beforeEach(() => {
    resetFixture()
  })

  it('la riga ingredienti inizia con "Ingredienti: "', async () => {
    renderPage()
    await screen.findByText('Panino della casa')

    const lines = ingredientNodes()
    expect(lines).toHaveLength(1)
    expect(lines[0].textContent).toBe('Ingredienti: pane, cotto')
  })

  it('la riga "Stand:" della vista per categoria NON ha l\'etichetta', async () => {
    renderPage()
    await screen.findByText('Panino della casa')

    fireEvent.click(screen.getByRole('button', { name: /Per categoria/i }))
    await screen.findByText('Panino categoria')

    /* Nella vista per categoria la stessa classe disegna anche "Stand: N" */
    const standLine = screen.getByText(/^Stand: /)
    expect(standLine.textContent?.startsWith('Ingredienti: ')).toBe(false)
    expect(ingredientNodes()).toHaveLength(1)
  })
})

describe('menu stand — descrizione nella vista per categoria', () => {
  beforeEach(() => {
    resetFixture()
    categoryDescription = 'Con tagliere di affettati e mostarda'
  })

  it('la mostra anche quando i prodotti sono raggruppati per categoria', async () => {
    renderPage()
    await screen.findByText('Panino della casa')

    /* Il bottone "Per categoria" compare solo con piu' di uno stand. */
    fireEvent.click(screen.getByRole('button', { name: /Per categoria/i }))

    await screen.findByText('Panino categoria')
    expect(screen.getByText('Con tagliere di affettati e mostarda')).toBeInTheDocument()
    /* La vista per categoria sostituisce quella dello stand (ternary in
       pagina), quindi qui c'e' solo la card del prodotto categorizzato. */
    expect(descNodes()).toHaveLength(1)
  })
})

describe('menu stand — pulsanti di export social', () => {
  beforeEach(() => {
    resetFixture()
    authUser = { firstName: 'Mario', lastName: 'Rossi', isPlatformAdmin: true }
  })

  it('quello dei prodotti sta accanto a quello del menu', async () => {
    renderPage()
    await screen.findByText('Panino della casa')

    const menuBtn = screen.getByRole('button', { name: 'Esporta social' })
    const prodottiBtn = screen.getByRole('button', { name: 'Esporta prodotti' })
    /* DOCUMENT_POSITION_FOLLOWING = 4: sta subito dopo nell'ordine del DOM. */
    expect(menuBtn.compareDocumentPosition(prodottiBtn) & 4).toBe(4)
  })

  it('quello dei prodotti spiega perche\' e\' disabilitato se il menu e\' vuoto', async () => {
    eventProducts = []
    renderPage()
    /* Il nome dello stand e' anche nei chip in alto: si cerca l'h1. */
    await screen.findByRole('heading', { name: 'Stand Uno', level: 1 })

    const btn = screen.getByRole('button', { name: 'Esporta prodotti' })
    /* Un bottone morto e' un vicolo cieco: il title dice il motivo. */
    expect(btn).toBeDisabled()
    expect(btn.getAttribute('title')).toBe('Nessun prodotto in menu da esportare')
  })

  it('nessuno dei due compare per chi non puo\' esportare', async () => {
    authUser = null
    renderPage()
    await screen.findByText('Panino della casa')

    expect(screen.queryByRole('button', { name: 'Esporta social' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Esporta prodotti' })).toBeNull()
  })

  /* I due pulsanti stanno su una riga tutta loro, SOTTO l'header: dentro
     l'header rubavano larghezza al nome della manifestazione, che sul
     telefono si rimpiccioliva. La classe e' module-scoped e quindi il nome
     cambia a ogni build, pero' il confronto fra classi dei due elementi
     regge: quello del bottone non puo' essere fra le classi del contenitore
     del nome evento. */
  it('i due pulsanti stanno fuori dall\'header, in una riga separata', async () => {
    renderPage()
    await screen.findByText('Panino della casa')

    const eventName = screen.getByText(/Festa di prova/)
    const eventTitle = eventName.closest('p')
    expect(eventTitle).not.toBeNull()
    const headerText = eventTitle!.parentElement!

    const menuBtn = screen.getByRole('button', { name: 'Esporta social' })
    const prodottiBtn = screen.getByRole('button', { name: 'Esporta prodotti' })

    expect(headerText.contains(menuBtn)).toBe(false)
    expect(headerText.contains(prodottiBtn)).toBe(false)

    /* E condividono lo stesso genitore, quello della riga dedicata. */
    expect(menuBtn.parentElement).toBe(prodottiBtn.parentElement)
    expect(menuBtn.parentElement!.contains(headerText)).toBe(false)
  })
})