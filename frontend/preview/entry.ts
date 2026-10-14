/* Anteprima dei poster social, disegnati su un canvas vero.
   Serve a guardare l'impaginazione dei due formati: si avvia con il dev
   server di Vite e si fotografa con Chrome headless.
   File di verifica, non viene committato. */
import { generatePoster } from '../src/components/SocialMenuExport'
import { generateProductPosterForPreview } from '../src/components/SocialProductExport'
import type { PosterFormatId } from '../src/lib/socialCanvas'

const event = {
  id: 'evt1',
  name: 'Festa di Sapone',
  logo: null,
  startDate: '2026-09-10T00:00:00.000Z',
  endDate: '2026-09-12T00:00:00.000Z',
  location: { city: 'Roma', label: 'Piazza Roma' },
  shortDescription: null,
  currencyName: 'Token',
  currencySymbol: null,
  exchangeRate: 2,
  themeBrand: '#bf5a2a',
  themeText: '#14261f',
  themeSurface: '#fffaf2',
  themeHighlight: '#f4c978',
}

const stand = {
  id: 'st1',
  name: 'Osteria del Porto',
  slogan: 'Street food sul molo',
  logo: null,
  coverImage: null,
}

const many = [
  { name: 'Panino porchetta', coverImage: null, price: 5 },
  { name: 'Salsiccia e caciocavallo', coverImage: null, price: 7 },
  { name: 'Focaccia con cipolla', coverImage: null, price: 4 },
  { name: 'Hamburger del porto', coverImage: null, price: 9 },
  { name: 'Patatine', coverImage: null, price: 3 },
  { name: 'Fried calamari', coverImage: null, price: 8 },
  { name: 'Bruschetta', coverImage: null, price: 3 },
  { name: "Tiramisù della casa", coverImage: null, price: 5 },
  { name: 'Insalata di polpo', coverImage: null, price: 7 },
  { name: 'Panzerotto', coverImage: null, price: 3 },
  { name: 'Spaghetto alle vongole', coverImage: null, price: 8 },
  { name: 'Cannolo siciliano', coverImage: null, price: 3 },
  { name: 'Frittata', coverImage: null, price: 3 },
]

const one = [{ name: 'Panino porchetta', coverImage: null, price: 5 }]

const longName = [
  {
    name: 'Salsiccia con caciocavallo, cipolla croccante e la salsa speciale della casa',
    coverImage: null,
    price: 7,
  },
]

const W = 1080

async function canvasFor(label: string, h: number) {
  const cap = document.createElement('h2')
  cap.textContent = label
  document.body.appendChild(cap)
  const c = document.createElement('canvas')
  c.width = W
  c.height = h
  document.body.appendChild(c)
  return c.getContext('2d')!
}

type Case = 'menu' | 'menu-empty' | 'prod' | 'prod-long'

async function run() {
  const params = new URLSearchParams(location.search)
  const format = (params.get('format') === 'feed' ? 'feed' : 'story') as PosterFormatId
  const which = (params.get('case') ?? 'menu') as Case
  const h = format === 'story' ? 1920 : 1350

  const ctx = await canvasFor(`${which} — ${format} (${W}x${h})`, h)
  if (which === 'menu') await generatePoster(ctx, event, stand, many, null, true, format)
  else if (which === 'menu-empty') await generatePoster(ctx, event, stand, [], null, false, format)
  else if (which === 'prod') await generateProductPosterForPreview(ctx, event, stand, one[0], true, format)
  else await generateProductPosterForPreview(ctx, event, stand, longName[0], false, format)

  document.title = 'done'
}

void run()