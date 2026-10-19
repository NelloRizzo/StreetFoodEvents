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
import { ALLERGEN_LABELS } from '../../lib/allergens'
import { posterMetrics, POSTER_FORMATS, type PosterFormatId } from '../../lib/socialCanvas'

type Op = {
  kind: string
  args: number[]
  text?: string
  font?: string
  /* Allineamento del contesto al momento del disegno: la descrizione non lo
     imposta da sola, quindi un `fillText` che si appoggia a un `textAlign`
     cambiato da un disegno precedente si vede solo qui. */
  textAlign?: string
}

class Recorder {
  ops: Op[] = []
  state: Record<string, unknown> = { font: '', textAlign: '', textBaseline: '' }
  /* Stack di `save`/`restore`: senza, il contesto finto non ha memoria e un
     disegno che cambia l'allineamento e poi lo ripristina sembra non averlo
     cambiato. E' quello che nascondeva il difetto della descrizione: il
     glifo moneta fa save/center/restore, e sul canvas vero quel restore
     riporta l'allineamento a `left` impostato dal prezzo. */
  stack: Record<string, unknown>[] = []

  push(kind: string, args: number[], text?: string) {
    this.ops.push({
      kind,
      args,
      text,
      font: String(this.state.font ?? ''),
      textAlign: String(this.state.textAlign ?? ''),
    })
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
      /* `save`/`restore` come sul canvas vero. */
      if (key === 'save') {
        return () => {
          this.stack.push({ ...this.state })
        }
      }
      if (key === 'restore') {
        return () => {
          const prev = this.stack.pop()
          if (prev) this.state = prev
        }
      }
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
   *  righe produrrebbe due chiamate per un solo prodotto.
   *  `maxSize` e' il tetto del lato: la griglia storica ha miniature piccole,
   *  quella a colonna singola sono piu' grandi e senza un tetto proprio il
   *  conteggio darebbe zero. */
  productCells(maxSize = 120) {
    return this.ops.filter(
      (o) => o.kind === 'fillRect' && o.args[2] === o.args[3] && o.args[2] > 0 && o.args[2] <= maxSize,
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
  description:
    'Descrizione lunga del prodotto, con ingredienti e una frase che sul canvas occupa piu' +
    ' di una riga perche' +
    ' serve a vedere il comportamento con il testo vero.',
  coverImage: null,
  price: 5 + (i % 7),
}))

const FORMATS: PosterFormatId[] = ['feed', 'story']

/** Tutti e 14 gli allergeni: il caso peggiore di elenco lungo. Nel poster
 *  diventano "Allergeni: Glutine, Crostacei, ..." (134 caratteri, 3 righe
 *  a 50 per riga): deve uscire per intero, mai tagliato a metà. */
const ALL_ALLERGEN_KEYS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'tree-nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupins',
  'molluscs',
]

/** Ingredienti lunghi abbastanza da occupare 7 righe (309 caratteri):
 *  servono a stringere il budget del 4:5 fino al punto in cui qualcosa
 *  deve cedere. */
const LONG_INGREDIENTS = [
  'farina tipo 0',
  'acqua',
  'lievito madre',
  'sale marino',
  'pomodoro pelato',
  'mozzarella di bufala',
  'basilico fresco',
  'olio extravergine',
  'origano',
  'pepe nero',
  'aglio',
  'zucchero',
  'vino bianco',
  'burro fuso',
  'cipolla di Tropea',
  'paprika dolce',
  'semi di sesamo',
  'aceto di vino rosso',
  'peperoncino calabrese',
  'sale affumicato',
]

beforeAll(() => {
  globalThis.Image = FakeImage as unknown as typeof Image
})

async function drawMenu(format: PosterFormatId, withPrices: boolean) {
  const rec = new Recorder()
  await generatePoster(rec.proxy, event, stand, products, null, withPrices, format)
  return rec
}

/** Il prodotto porta sempre i dettagli nel fixture: è `withDetails` (cioè
 *  la checkbox dell'export) a decidere se finiscono sull'immagine, non
 *  l'assenza dei dati. */
async function drawProduct(
  format: PosterFormatId,
  withPrices: boolean,
  name = 'Panino porchetta',
  withDescriptions = false,
  withDetails = false,
  extras: { ingredients?: string[]; allergens?: string[] } = {},
) {
  const rec = new Recorder()
  await generateProductPosterForPreview(
    rec.proxy,
    event,
    stand,
    {
      name,
      price: 7,
      coverImage: null,
      description: products[0].description,
      ingredients: extras.ingredients ?? LONG_INGREDIENTS,
      allergens: extras.allergens ?? ALL_ALLERGEN_KEYS,
    },
    withPrices,
    format,
    withDescriptions,
    withDetails,
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

describe.each(FORMATS)('poster di un prodotto con la descrizione — formato %s', (format) => {
  it('non disegna nulla fuori dal foglio', async () => {
    for (const withPrices of [true, false]) {
      const rec = await drawProduct(format, withPrices, 'Panino porchetta', true)
      assertInside(rec, format)
    }
  })

  /* La descrizione non imposta `textAlign`: si appoggia a quello della testa
     del poster. Se un disegno fra i due (il prezzo) lo cambia e non lo
     ripristina, ogni riga parte dal centro e va a destra — che e' il difetto
     riferito sulla nota del supervisore. */
  it('la descrizione resta centrata anche sotto il prezzo', async () => {
    const rec = await drawProduct(format, true, 'Panino porchetta', true)
    const desc = rec.textOps().filter((o) => o.text?.startsWith('Descrizione lunga del prodotto'))
    expect(desc.length).toBeGreaterThan(0)
    for (const line of desc) {
      expect(line.textAlign, `riga "${line.text}"`).toBe('center')
    }
  })

  /* La descrizione sta fra il prezzo e la foto: e' il posto dove non
     copre niente, e la foto si stringe di conseguenza. */
  it('la descrizione non arriva sul footer', async () => {
    const m = posterMetrics(format)
    const rec = await drawProduct(format, true, 'Panino porchetta', true)
    const lines = rec.textOps().filter((o) => o.text?.startsWith('Descrizione lunga del prodotto'))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line.args[1]).toBeLessThan(m.footerY)
    }
  })

  it('senza descrizioni la descrizione non viene scritta', async () => {
    const rec = await drawProduct(format, true, 'Panino porchetta', false)
    expect(rec.textOps().some((o) => o.text?.startsWith('Descrizione lunga del prodotto'))).toBe(false)
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

/* Corpi usati dai blocchi centrali: la descrizione e gli ingredienti
   condividono lo stesso font (sono lo stesso tipo di testo), mentre gli
   allergeni sono l'unico testo in grassetto 30px del poster. Le righe di
   continuazione non ripetono l'intestazione, quindi il modo affidabile di
   raggrupparle è il font con cui vengono disegnate, non il prefisso. */
const TEXT_FONT = '400 30px "Segoe UI", Inter, sans-serif'
const ALLERGEN_FONT = '700 30px "Segoe UI", Inter, sans-serif'

/** I tre blocchi di testo centrale, come liste di righe complete. */
function detailBlocks(rec: Recorder) {
  const shared = rec.textOps().filter((o) => o.font === TEXT_FONT)
  const fromIngredients = shared.findIndex((o) => o.text?.startsWith('Ingredienti:'))
  return {
    desc: fromIngredients >= 0 ? shared.slice(0, fromIngredients) : shared,
    ingredients: fromIngredients >= 0 ? shared.slice(fromIngredients) : [],
    allergens: rec.textOps().filter((o) => o.font === ALLERGEN_FONT),
  }
}

describe.each(FORMATS)('poster del prodotto con ingredienti ed allergeni — formato %s', (format) => {
  it('non disegna nulla fuori dal foglio', async () => {
    for (const withPrices of [true, false]) {
      const rec = await drawProduct(format, withPrices, 'Panino porchetta', true, true)
      assertInside(rec, format)
    }
  })

  it('scrive gli ingredienti e gli allergeni per intero, elenco completo', async () => {
    const rec = await drawProduct(format, true, 'Panino porchetta', true, true)
    const { ingredients, allergens } = detailBlocks(rec)
    /* Ricomporere le righe con lo spazio deve dare la stringa intera: se una
       riga fosse stata tagliata a metà (o un blocco chiuso prima della fine)
       il confronto non torna. Gli allergeni in particolare non si tagliano
       mai — sono dato di sicurezza alimentare. */
    expect(ingredients.map((o) => o.text).join(' ')).toBe(`Ingredienti: ${LONG_INGREDIENTS.join(', ')}`)
    expect(allergens.map((o) => o.text).join(' ')).toBe(
      `Allergeni: ${ALL_ALLERGEN_KEYS.map((k) => ALLERGEN_LABELS[k]).join(', ')}`,
    )
  })

  it('tutto il testo dei dettagli resta sopra il footer', async () => {
    const m = posterMetrics(format)
    const rec = await drawProduct(format, true, 'Panino porchetta', true, true)
    const { desc, ingredients, allergens } = detailBlocks(rec)
    const lines = [...desc, ...ingredients, ...allergens]
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line.args[1], `riga "${line.text}"`).toBeLessThan(m.footerY)
    }
  })

  it('senza la checkbox nessuno di quei testi viene scritto', async () => {
    /* I dati sono nel prodotto: a mancare deve essere la scelta, non il
       dato — altrimenti il test passerebbe anche con la checkbox rotta. */
    const rec = await drawProduct(format, true, 'Panino porchetta', true, false)
    expect(rec.textOps().some((o) => o.text?.startsWith('Ingredienti:'))).toBe(false)
    expect(rec.textOps().some((o) => o.text?.startsWith('Allergeni:'))).toBe(false)
    /* Le descrizioni hanno una scelta a parte e restano. */
    expect(rec.textOps().some((o) => o.text?.startsWith('Descrizione lunga'))).toBe(true)
  })
})

/* Il contenuto massimo (prezzo + descrizione + ingredienti a 7 righe +
   tutti gli allergeni) costringe a scegliere cosa cede, e il 4:5 e' piu'
   stretto del 9:16: li si verifica il compromesso invece di fidarsi del
   budget. Valori calcolati: nel 4:5 il budget e' 11 righe (3 allergeni +
   7 ingredienti + 1 di descrizione, con la foto residua a 5px che quindi
   sparisce), nel 9:16 e' 18 e sta tutto con la foto ancora a 196px. */
describe('con tutti i dettagli il formato decide cosa cede', () => {
  it('nel 4:5 la descrizione si accorcia a una riga con "…" e la foto sparisce', async () => {
    const rec = await drawProduct('feed', true, 'Panino porchetta', true, true)
    const desc = detailBlocks(rec).desc
    expect(desc).toHaveLength(1)
    expect(desc[0].text?.endsWith('…')).toBe(true)
    /* La foto senza immagine copre tutta l'area (x=100, larghezza piena):
       qui non c'è nessun rettangolo in quella posizione. Senza la soglia
       minima il riquadro resterebbe una lisca da 5px che sembrerebbe un
       difetto di rendering. */
    expect(rec.ops.filter((o) => o.kind === 'fillRect' && o.args[0] === 100)).toHaveLength(0)
  })

  it('nel 9:16 c\'e\' spazio per tutto e la foto resta', async () => {
    const m = posterMetrics('story')
    const rec = await drawProduct('story', true, 'Panino porchetta', true, true)
    const desc = detailBlocks(rec).desc
    expect(desc).toHaveLength(4)
    /* Nessun taglio: la descrizione esce intera, come senza dettagli. */
    expect(desc.some((l) => l.text?.endsWith('…'))).toBe(false)
    const photo = rec.bigRects(70)
    expect(photo).toHaveLength(1)
    expect(photo[0].args[1] + photo[0].args[3]).toBeLessThanOrEqual(m.footerY)
  })
})