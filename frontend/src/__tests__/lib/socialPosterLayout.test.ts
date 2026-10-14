import { describe, expect, it, beforeAll } from 'vitest'

/* L'impaginazione dei poster social è geometria, e la geometria si verifica
 * con i numeri: qui ogni chiamata di disegno viene registrata e si controlla
 * che **nulla** esca dal foglio e che la griglia non arrivi sul footer.
 *
 * Non serve un canvas vero: jsdom non lo implementa, quindi il contesto è
 * un registratore di no-op che conserva le coordinate (vedi `recorder`). I
 * pixel restano un controllo a occhio: per quello c'è `frontend/preview`. */

import { generatePoster } from '../../components/SocialMenuExport'
import { generateProductPosterForPreview } from '../../components/SocialProductExport'
import { posterMetrics, POSTER_FORMATS, type PosterFormatId } from '../../lib/socialCanvas'

type Op = { kind: string; args: number[]; text?: string; font?: string }

class Recorder {
  ops: Op[] = []
  state: Record<string, unknown> = { font: '', textAlign: '', textBaseline: '' }

  push(kind: string, args: number[], text?: string) {
    this.ops.push({ kind, args, text, font: String(this.state.font ?? '') })
  }

  measureText(text: string) {
    /* Larghezza plausibile: conta i caratteri per il corpo corrente. Il
       numero esatto non conta, serve solo avere un'estensione del testo. */
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(String(this.state.font ?? ''))?.[1] ?? 10)
    return { width: text.length * size * 0.55 }
  }

  /* Le frecce lexicali prendono `this` (il Recorder) dal getter: nei metodi
   del Proxy servirebbe un alias di `this`, che il lint vieta. */
get proxy() {
  const store: Record<string, unknown> = {}
  return new Proxy(store, {
    get: (t, prop) => {
      const key = String(prop)
      if (key === 'measureText') return (t2: string) => this.measureText(t2)
      if (key in t) return t[key]
      return (...args: unknown[]) => {
        /* `fillText` ha il testo come primo argomento: va tenuto, altrimenti
           non si può distinguere il nome di un prodotto da un altro. */
        if (key === 'fillText') {
          const [text, x, y] = args as [string, number, number]
          this.push(key, [x, y], text)
          return
        }
        this.push(key, args.map((a) => (typeof a === 'number' ? a : 0)))
      }
    },
    set: (t, prop, value) => {
      const key = String(prop)
      if (key === 'font' || key === 'textAlign' || key === 'textBaseline') {
        this.state[key] = value
      }
      t[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

  /** Estensione orizzontale di ogni `fillText`, secondo l'allineamento. */
  textOps() {
    return this.ops.filter((o) => o.kind === 'fillText')
  }

  /** `fillRect` grandi **diversi dal fondo del foglio**: il fondo parte da
   *  x=0 e copre tutta l'altezza, quindi si scarta per non confonderlo con
   *  l'area foto. */
  bigRects(minHeight: number) {
    return this.ops.filter((o) => o.kind === 'fillRect' && o.args[3] >= minHeight && o.args[0] > 0)
  }

  /** Celle prodotto = le miniature quadrate disegnate dalla griglia.
   *  Contare le righe di testo non va bene: un nome che va a capo su due
   *  righe produrrebbe due chiamate per un solo prodotto. */
  productCells() {
    return this.ops.filter(
      (o) => o.kind === 'fillRect' && o.args[2] === o.args[3] && o.args[2] > 0 && o.args[2] <= 120,
    ).length
  }
}

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  crossOrigin = ''
  width = 1600
  height = 900
  set src(_v: string) {
    setTimeout(() => this.onload?.(), 0)
  }
}

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

const products = Array.from({ length: 20 }, (_, i) => ({
  name: `Prodotto numero ${i + 1} con nome abbastanza lungo`,
  coverImage: null,
  price: 5 + (i % 7),
}))

const FORMATS: PosterFormatId[] = ['feed', 'story']

beforeAll(() => {
  globalThis.Image = FakeImage as unknown as typeof Image
})

async function drawMenu(format: PosterFormatId, withPrices: boolean) {
  const rec = new Recorder()
  await generatePoster(rec.proxy, event, stand, products, null, withPrices, format)
  return rec
}

async function drawProduct(format: PosterFormatId, withPrices: boolean, name = 'Panino porchetta') {
  const rec = new Recorder()
  await generateProductPosterForPreview(
    rec.proxy,
    event,
    stand,
    { name, price: 7, coverImage: null },
    withPrices,
    format,
  )
  return rec
}

/* Ogni coordinata usata deve stare nel foglio. Tolleranza di 1px: il
   tracciamento e i raggi dei cerchi sbordano di mezzo pixel. */
function assertInside(rec: Recorder, format: PosterFormatId) {
  const m = posterMetrics(format)
  const problems: string[] = []
  for (const op of rec.ops) {
    // fillRect(x, y, w, h): x,y sono coordinate, w,h sono misure.
    if (op.kind === 'fillRect' || op.kind === 'rect') {
      const [x, y, w, h] = op.args
      if (x < -1 || y < -1 || x + w > m.width + 1 || y + h > m.height + 1) {
        problems.push(`fillRect fuori: ${JSON.stringify(op.args)}`)
      }
      continue
    }
    for (const v of op.args) {
      if (v < -1 || v > Math.max(m.width, m.height) + 1) {
        problems.push(`${op.kind} con coordinata ${v} (${JSON.stringify(op.args)})`)
      }
    }
  }
  expect(problems).toEqual([])
}

describe('formato dei poster social', () => {
  it('espone i due formati con le dimensioni giuste', () => {
    expect(POSTER_FORMATS.feed.width).toBe(1080)
    expect(POSTER_FORMATS.feed.height).toBe(1350)
    expect(POSTER_FORMATS.story.height).toBe(1920)
  })

  it('il footer è ancorato al bordo inferiore in entrambi i formati', () => {
    for (const f of FORMATS) {
      const m = posterMetrics(f)
      expect(m.footerY + m.footerH + 72).toBe(m.height)
    }
  })
})

describe.each(FORMATS)('poster del menu — formato %s', (format) => {
  it('non disegna nulla fuori dal foglio', async () => {
    for (const withPrices of [true, false]) {
      const rec = await drawMenu(format, withPrices)
      assertInside(rec, format)
    }
  })

  it('la griglia e la riga "+N altri" restano sopra il footer', async () => {
    const m = posterMetrics(format)
    const rec = await drawMenu(format, true)
    const rest = rec.textOps().find((o) => o.text?.startsWith('+ '))
    /* Con 20 prodotti la riga "+N altri" c'e' per forza: e' quella che
       storicamente finiva sopra il footer. */
    expect(rest).toBeDefined()
    expect(rest!.args[1]).toBeLessThan(m.footerY)
  })

  it('il contenuto arriva in fondo (il footer non resta a mezz\'altezza)', async () => {
    const m = posterMetrics(format)
    const rec = await drawMenu(format, false)
    /* Il footer scrive luogo e date sotto la propria riga: se il foglio
       diventasse piu' alto senza adattare nulla, quel testo resterebbe a
       meta' immagine. */
    expect(rec.textOps().some((o) => o.args[1] >= m.footerY)).toBe(true)
  })
})

describe('i due formati non sono la stessa immagine', () => {
  it('nel 4:5 stanno 8 prodotti, nel 9:16 almeno 12', async () => {
    const cells = (rec: Recorder) => rec.productCells()
    expect(cells(await drawMenu('feed', true))).toBe(8)
    expect(cells(await drawMenu('story', true))).toBeGreaterThanOrEqual(12)
  })

  it('le dimensioni del canvas sono diverse', async () => {
    const m1 = posterMetrics('feed')
    const m2 = posterMetrics('story')
    expect(m2.height).toBeGreaterThan(m1.height)
    expect(m1.width).toBe(m2.width)
  })
})

describe.each(FORMATS)('poster di un prodotto — formato %s', (format) => {
  it('non disegna nulla fuori dal foglio', async () => {
    for (const withPrices of [true, false]) {
      const rec = await drawProduct(format, withPrices)
      assertInside(rec, format)
    }
  })

  it('con un nome su tre righe la foto non invade il footer', async () => {
    const m = posterMetrics(format)
    const rec = await drawProduct(
      format,
      true,
      'Salsiccia con caciocavallo, cipolla croccante e la salsa speciale della casa',
    )
    const photo = rec.bigRects(200)
    expect(photo.length).toBeGreaterThan(0)
    for (const box of photo) {
      expect(box.args[1] + box.args[3]).toBeLessThanOrEqual(m.footerY)
    }
  })

  it('la foto cresce con l\'altezza del foglio', async () => {
    const heightOf = async (f: PosterFormatId) => {
      const rec = await drawProduct(f, false)
      return rec.bigRects(200)[0].args[3]
    }
    expect(await heightOf('story')).toBeGreaterThan(await heightOf('feed'))
  })
})