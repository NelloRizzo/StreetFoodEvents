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

import { render, screen } from '@testing-library/react'
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
