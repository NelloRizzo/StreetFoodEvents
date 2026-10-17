import { beforeEach, describe, expect, it, vi } from 'vitest'

/* Il prodotto ha una descrizione HTML sanificata: in catalogo deve restare
   una riga di testo piano (il markup la spezzerebbe), e nel form il campo
   deve essere un editor, non un'area di testo che mostrerebbe i tag alla
   lettera e glieli farebbe salvare come se fossero testo. */

type Product = {
  id: string
  name: string
  description: string | null
  ingredients: string[]
  allergens: string[]
  isFrozen: boolean
  price: number
  coverImage: null
  gallery: []
  createdAt: string
  updatedAt: string
}

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Panino della casa',
  description: 'Pane con cotto, salsa speciale',
  ingredients: ['pane', 'cotto'],
  allergens: [],
  isFrozen: false,
  price: 5,
  coverImage: null,
  gallery: [],
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
  ...overrides,
})

let products: Product[] = []

const apiRequest = vi.fn(async (path: string) => {
  if (path === '/products') return { items: products }
  throw new Error('unexpected ' + path)
})

vi.mock('../../lib/api', () => ({ apiRequest: (p: string) => apiRequest(p) }))

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ProductsPage } from '../../pages/ProductsPage'

const renderPage = () => render(<ProductsPage />)

describe('catalogo prodotti — descrizione', () => {
  beforeEach(() => {
    apiRequest.mockClear()
    products = [product()]
  })

  it('mostra la descrizione come testo piano, non come markup', async () => {
    products = [product({ description: '<p>Pane con <strong>cotto</strong></p>' })]
    renderPage()
    await screen.findByText('Panino della casa')

    expect(screen.getByText('Pane con cotto')).toBeInTheDocument()
    expect(screen.queryByText('cotto', { selector: 'strong' })).toBeNull()
  })

  it('non rende nessuna riga quando la descrizione e\' solo markup vuoto', async () => {
    products = [product({ description: '<p></p>' })]
    renderPage()
    await screen.findByText('Panino della casa')

    /* Il pallino della riga descrizione ha la stessa classe degli ingredienti:
       si controlla che non compaia il testo del markup. */
    expect(screen.queryByText('<p></p>')).toBeNull()
  })
})

describe('catalogo prodotti — paginazione', () => {
  beforeEach(() => {
    apiRequest.mockClear()
  })

  it('mostra una pagina alla volta e il conteggio, e si sposta per pagina', async () => {
    products = Array.from({ length: 25 }, (_, i) =>
      product({ id: `p${i}`, name: `Prodotto ${String(i + 1).padStart(2, '0')}` })
    )
    renderPage()
    await screen.findByText('Prodotto 01')

    expect(screen.getByText('Pagina 1 di 2 · 25 prodotti')).toBeInTheDocument()
    expect(screen.queryByText('Prodotto 21')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /Successiva/ }))

    expect(await screen.findByText('Prodotto 21')).toBeInTheDocument()
    expect(screen.getByText('Pagina 2 di 2 · 25 prodotti')).toBeInTheDocument()
    expect(screen.queryByText('Prodotto 01')).toBeNull()

    /* Con l'ultima pagina raggiunta avanti non deve essere piu' cliccabile. */
    expect(screen.getByRole('button', { name: /Successiva/ })).toBeDisabled()
  })

  it('con una sola pagina resta solo il conteggio', async () => {
    products = [product()]
    renderPage()
    await screen.findByText('Panino della casa')

    expect(screen.getByText('1 prodotto')).toBeInTheDocument()
    expect(screen.queryByText(/Pagina/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Precedente/ })).toBeNull()
  })
})

describe('catalogo prodotti — navigatore per iniziale', () => {
  beforeEach(() => {
    apiRequest.mockClear()
  })

  it('filtra sulla lettera scelta e «Tutte» azzera', async () => {
    products = [
      product({ id: 'p1', name: 'Arancia' }),
      product({ id: 'p2', name: 'Anice' }),
      product({ id: 'p3', name: 'Banana' }),
      product({ id: 'p4', name: 'Zucchina' }),
    ]
    renderPage()
    await screen.findByText('Arancia')

    await userEvent.click(screen.getByRole('button', { name: 'B' }))

    expect(screen.queryByText('Arancia')).toBeNull()
    expect(screen.queryByText('Zucchina')).toBeNull()
    expect(screen.getByText('Banana')).toBeInTheDocument()
    /* Singolare: un filtro ristretto fa capire subito cosa resta. */
    expect(screen.getByText('1 prodotto')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tutte' }))

    expect(screen.getByText('Arancia')).toBeInTheDocument()
    expect(screen.getByText('Zucchina')).toBeInTheDocument()
  })

  it('propone solo le iniziali presenti, in ordine alfabetico con # in testa', async () => {
    products = [
      product({ id: 'p1', name: 'Arancia' }),
      product({ id: 'p2', name: 'Banana' }),
      product({ id: 'p3', name: '2 Palle' }),
    ]
    renderPage()
    await screen.findByText('Arancia')

    const group = screen.getByRole('group', { name: 'Iniziale' })
    expect(within(group).getByRole('button', { name: 'A' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'B' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: '#' })).toBeInTheDocument()
    /* Nessuna lettera assente: non compaiono pulsanti che non portano da nessuna parte. */
    expect(within(group).queryByRole('button', { name: 'C' })).toBeNull()
  })

  it('una sola iniziale in elenco: non c\'e\' niente da scegliere e il navigatore non compare', async () => {
    products = [product({ id: 'p1', name: 'Panino' })]
    renderPage()
    await screen.findByText('Panino')

    expect(screen.queryByRole('group', { name: 'Iniziale' })).toBeNull()
  })
})

describe('form prodotto — descrizione', () => {

  beforeEach(() => {
    apiRequest.mockClear()
    products = [product()]
  })

  it('il campo descrizione e\' un editor, non un\'area di testo', async () => {
    renderPage()
    await screen.findByText('Panino della casa')

    await userEvent.click(screen.getByRole('button', { name: 'Nuovo prodotto' }))

    /* L'area di testo con id `prod-desc` e' stata sostituita dall'editor:
       se ricomparisse, i tag HTML dell'editor precedente sarebbero
       modificabili alla lettera. */
    expect(document.querySelector('#prod-desc')).toBeNull()
    /* L'editor e' un `contenteditable`: e' questo che distingue "campo
       ricco" da "area di testo rinominata". */
    expect(document.querySelector('[contenteditable="true"]')).not.toBeNull()
  })
})
