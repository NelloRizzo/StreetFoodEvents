import { beforeEach, describe, expect, it, vi } from 'vitest'

/* Export dei singoli prodotti: il file non si può disegnare in jsdom, quindi
 * il canvas è un registratore di no-op e le immagini sono finte. Qui si
   verifica il comportamento (quale prodotto genera quale immagine, quante
   richieste di QR, come si chiamano i file), non i pixel: quelli sono
   coperti dal confronto vecchio/nuovo fatto a mano sul refactor. */

const apiRequest = vi.fn((path: string) => {
  apiPaths.push(path)
  return Promise.resolve({ qrCode: 'data:image/png;base64,QR' })
})

let apiPaths: string[] = []

vi.mock('../../lib/api', () => ({ apiRequest: (p: string) => apiRequest(p) }))

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SocialProductExport } from '../../components/SocialProductExport'
import type { UploadedImage } from '../../lib/upload'
/* Anche la checkbox dei prezzi sta dentro una <label>: per prendere solo i
 * prodotti si filtra sulla classe del picker (gli hash cambiano da build a
 * build, quindi si importa lo stesso module.scss del componente). */
import styles from '../../components/SocialExport.module.scss'

const coverImage: UploadedImage = {
  url: 'https://img/patatine.png',
  publicId: 'patatine',
  width: 800,
  height: 600,
  format: 'png',
  bytes: 1000,
}

/* Il tipo e' dichiarato: senza, TypeScript inferirebbe da `{ url }` un tipo
 * più stretto di UploadedImage e il fixture non sarebbe assegnabile. */
type MenuItem = {
  id: string
  priceOverride: number | null
  product: { name: string; price: number; coverImage?: UploadedImage | null } | null
}

const menuItems: MenuItem[] = [
  {
    id: 'ep1',
    priceOverride: null,
    product: { name: 'Panino della casa', price: 5, coverImage: null },
  },
  {
    id: 'ep2',
    priceOverride: 8,
    product: { name: 'Salsiccia e caciocavallo', price: 7, coverImage: null },
  },
  {
    id: 'ep3',
    priceOverride: null,
    product: { name: 'Patatine', price: 3, coverImage },
  },
]

const event = {
  id: 'evt1',
  name: 'Festa di prova',
  logo: null,
  startDate: '2026-09-10T00:00:00.000Z',
  endDate: '2026-09-12T00:00:00.000Z',
  location: { city: 'Roma', label: 'Piazza Roma' },
  shortDescription: null,
  currencyName: 'Token',
  currencySymbol: null,
  exchangeRate: 1,
  themeBrand: null,
  themeText: null,
  themeSurface: null,
  themeHighlight: null,
}

const stand = {
  id: 'st1',
  name: 'Stand Uno',
  slogan: null,
  logo: null,
  coverImage: null,
}

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  crossOrigin = ''
  width = 1200
  height = 800
  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0)
  }
}

let downloads: string[] = []
let postersDrawn = 0

beforeEach(() => {
  apiRequest.mockClear()
  apiPaths = []
  downloads = []
  postersDrawn = 0
  localStorage.clear()
  globalThis.Image = FakeImage as unknown as typeof Image

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    postersDrawn += 1
    const noop = () => undefined
    const target: Record<string, unknown> = {
      measureText: (text: string) => ({ width: text.length * 9 }),
    }
    return new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop as string]
        t[prop as string] = noop
        return noop
      },
      set(t, prop, value) {
        t[prop as string] = value
        return true
      },
    }) as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
    () => 'data:image/png;base64,POSTER',
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download)
  })
})

const renderModal = (items = menuItems) =>
  render(
    <SocialProductExport
      open
      event={event}
      stand={stand}
      menuItems={items}
      onClose={() => {}}
    />,
  )

const checkboxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[]
const productChecks = () =>
  checkboxes().filter((c) => c.closest(`.${styles.pickerCard}`))

const generate = async (count: number) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Genera ${count} immagin`) }))
  await waitFor(() =>
    expect(screen.getAllByAltText(/^Poster /)).toHaveLength(
      count,
    ),
  )
}

describe('export prodotti per social', () => {
  it('non genera nulla se nessun prodotto è selezionato', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /Genera 0 immagini/ })).toBeDisabled()
  })

  it('sceglie i prodotti uno a uno e conta', () => {
    renderModal()
    expect(screen.getByText(/0 di 3 prodotti selezionati/)).toBeInTheDocument()

    fireEvent.click(productChecks()[1])
    expect(screen.getByText(/1 di 3 prodotti selezionati/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seleziona tutti' }))
    expect(screen.getByText(/3 di 3 prodotti selezionati/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Deseleziona tutti' }))
    expect(screen.getByText(/0 di 3 prodotti selezionati/)).toBeInTheDocument()
  })

  it('genera una immagine per prodotto selezionato', async () => {
    renderModal()
    fireEvent.click(productChecks()[0])
    fireEvent.click(productChecks()[2])

    await generate(2)

    expect(screen.getByAltText('Poster Panino della casa')).toBeInTheDocument()
    expect(screen.getByAltText('Poster Patatine')).toBeInTheDocument()
    expect(screen.queryByAltText('Poster Salsiccia e caciocavallo')).toBeNull()
    /* Un canvas per prodotto selezionato, non uno per prodotto del menu. */
    expect(postersDrawn).toBe(2)
  })

  it('il prodotto senza immagine genera comunque la sua immagine', async () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Seleziona tutti' }))
    await generate(3)
    /* Senza foto il poster mostra l'iniziale: un'immagine in meno sarebbe
       un prodotto sparito senza che l'operatore capisca perché. */
    expect(screen.getByAltText('Poster Panino della casa')).toBeInTheDocument()
  })

  it('il QR del menu viene chiesto una volta sola per tutte le immagini', async () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Seleziona tutti' }))
    await generate(3)

    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith('/stands/st1/qrcode?eventId=evt1')
  })

  it('i file si chiamano con stand e prodotto, e "Scarica tutte" li scarica tutti', async () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Seleziona tutti' }))
    await generate(3)

    fireEvent.click(screen.getAllByRole('button', { name: 'Scarica PNG' })[1])
    expect(downloads).toEqual(['social-prodotto-Stand-Uno-Salsiccia-e-caciocavallo.png'])

    fireEvent.click(screen.getByRole('button', { name: /Scarica tutte \(3\)/ }))
    await waitFor(() => expect(downloads).toHaveLength(4))
    /* downloads[0] è il download singolo di prima: gli altri sono i tre
       prodotti nell'ordine del menu. */
    expect(downloads.slice(1)).toEqual([
      'social-prodotto-Stand-Uno-Panino-della-casa.png',
      'social-prodotto-Stand-Uno-Salsiccia-e-caciocavallo.png',
      'social-prodotto-Stand-Uno-Patatine.png',
    ])
  })

  it('cambiare la selezione scarta le immagini già generate', async () => {
    renderModal()
    fireEvent.click(productChecks()[0])
    await generate(1)
    expect(screen.getByAltText('Poster Panino della casa')).toBeInTheDocument()

    fireEvent.click(productChecks()[1])
    /* Le immagini vecchie erano per un'altra selezione: mostrarle sarebbe
       stato un invio sbagliato. */
    expect(screen.queryByAltText(/^Poster /)).toBeNull()
  })

  it('senza prodotti spiega il motivo invece di offrire una griglia vuota', () => {
    renderModal([])
    expect(screen.getByText(/non ha ancora prodotti in menu/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Genera/ })).toBeNull()
  })
})