import { describe, expect, it } from 'vitest'

/* Prezzo e simbolo della moneta devono stare separati, e il gruppo va
 * allineato come richiesto. Il difetto che questo test copre era invisibile
 * al confronto delle immagini: il numero e il glifo si **sovrapponevano**,
 * perché la posizione del testo era calcolata come se l'allineamento fosse
 * sempre "right" e il poster del singolo prodotto usa "center". */

import { drawPrice, posterColors, type PosterColors } from '../../lib/socialCanvas'

type Geom = { texts: { text: string; x: number; y: number }[]; circles: { cx: number; cy: number; r: number }[] }

const CHAR_WIDTH = 10

function recorder() {
  const geom: Geom = { texts: [], circles: [] }
  const store: Record<string, unknown> = {
    measureText: (t: string) => ({ width: t.length * CHAR_WIDTH }),
  }
  const ctx = new Proxy(store, {
    get: (t, prop) => {
      const key = String(prop)
      if (key in t) return t[key]
      return (...args: unknown[]) => {
        if (key === 'fillText') {
          const [text, x, y] = args as [string, number, number]
          geom.texts.push({ text, x, y })
        }
        if (key === 'arc') {
          const [cx, cy, r] = args as [number, number, number]
          geom.circles.push({ cx, cy, r })
        }
        return undefined
      }
    },
    set: (t, prop, value) => {
      t[prop as string] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, geom }
}

const colors: PosterColors = posterColors({
  id: 'e',
  name: 'E',
  logo: null,
  startDate: '2026-01-01',
  endDate: '2026-01-02',
  currencyName: 'Token',
})

const base = {
  bareSymbol: null,
  glyphSize: 40,
  currencyImage: null,
  currencyInitial: 'T',
  fontSize: 40,
}

describe('drawPrice — distanza fra prezzo e simbolo della moneta', () => {
  it('il glifo non tocca il numero, in nessuno dei tre allineamenti', () => {
    const expectedGap = Math.round(base.fontSize * 0.3)
    for (const align of ['left', 'right', 'center'] as const) {
      const { ctx, geom } = recorder()
      drawPrice(ctx, colors, '5', 540, 700, { ...base, align })

      const number = geom.texts[0]
      const circle = geom.circles[0]
      expect(number.text).toBe('5')
      const numberRight = number.x + '5'.length * CHAR_WIDTH
      const glyphLeft = circle.cx - circle.r
      expect(glyphLeft - numberRight).toBe(expectedGap)
    }
  })

  it('anche col simbolo nudo (€) il gap e\' lo stesso', () => {
    const { ctx, geom } = recorder()
    drawPrice(ctx, colors, '5', 540, 700, { ...base, align: 'center', bareSymbol: '€' })

    const [number, symbol] = geom.texts
    expect(symbol.text).toBe('€')
    const numberRight = number.x + CHAR_WIDTH
    expect(symbol.x - numberRight).toBe(Math.round(base.fontSize * 0.3))
  })

  it('il gap cresce col corpo del carattere', () => {
    const small = recorder()
    drawPrice(small.ctx, colors, '5', 540, 700, { ...base, align: 'center', fontSize: 26 })
    const large = recorder()
    drawPrice(large.ctx, colors, '5', 540, 700, { ...base, align: 'center', fontSize: 60 })

    const gapOf = (g: Geom) =>
      g.circles[0].cx - g.circles[0].r - (g.texts[0].x + CHAR_WIDTH)
    expect(gapOf(small.geom)).toBe(Math.round(26 * 0.3))
    expect(gapOf(large.geom)).toBe(Math.round(60 * 0.3))
  })

  it('l\'allineamento riguarda il gruppo numero+simbolo', () => {
    const width = (align: 'left' | 'right' | 'center') => {
      const { ctx, geom } = recorder()
      drawPrice(ctx, colors, '5', 540, 700, { ...base, align })
      const groupLeft = geom.texts[0].x
      const groupRight = geom.circles[0].cx + geom.circles[0].r
      return { groupLeft, groupRight }
    }

    expect(width('left').groupLeft).toBe(540)
    /* Centrato: il centro del gruppo, non del numero. Con un numero stretto
       e il glifo largo, centrare solo il numero sposta tutto a sinistra. */
    const centered = width('center')
    const groupWidth = centered.groupRight - centered.groupLeft
    expect(centered.groupLeft + groupWidth / 2).toBe(540)
    expect(width('right').groupRight).toBe(540)
  })
})