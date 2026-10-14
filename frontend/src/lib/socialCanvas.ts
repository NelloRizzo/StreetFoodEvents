import type { UploadedImage } from './upload'

/** Geometria e primitive di disegno degli export social.
 *
 *  Stanno in una lib e non dentro `SocialMenuExport` perché anche l'export
 *  dei singoli prodotti deve produrre immagini con lo **stesso** formato di
 *  quelle del menu: due copie delle stesse funzioni andrebbero tenute
 *  allineate a mano, e un divergimento si vede solo sull'immagine scaricata.
 *
 *  I valori qui sotto sono quelli storici di `SocialMenuExport`: cambiarli
 *  cambia l'aspetto delle immagini già scaricate dagli stand. */

export const POSTER_WIDTH = 1080
export const POSTER_HEIGHT = 1350

/** Banda di testa: logo e nome dell'evento. */
const BAND_H = 140
/** Blocco basso: luogo/data a sinistra, QR del menu a destra. */
const FOOTER_Y = 1160
const FOOTER_H = 118
const FOOTER_X = 95
const FOOTER_W = 700
const QR_SIZE = 118
const QR_X = POSTER_WIDTH - FOOTER_X - QR_SIZE
const QR_Y = FOOTER_Y - 4

export type SocialPosterEvent = {
  id: string
  name: string
  logo: UploadedImage | null
  startDate: string
  endDate: string
  location?: { label?: string | null; city?: string | null } | null
  shortDescription?: string | null
  currencyName: string
  currencySymbol?: UploadedImage | null
  exchangeRate?: number | null
  themeBrand?: string | null
  themeText?: string | null
  themeSurface?: string | null
  themeHighlight?: string | null
}

export type SocialPosterStand = {
  id: string
  name: string
  slogan?: string | null
  logo: UploadedImage | null
  coverImage: UploadedImage | null
}

export type PosterColors = {
  brand: string
  ink: string
  inkSoft: string
  surface: string
  highlight: string
}

/** Colori presi dal tema evento; il fallback è lo stesso di prima, quindi un
 *  evento senza tema produce lo stesso poster di sempre. */
export function posterColors(event: SocialPosterEvent): PosterColors {
  return {
    brand: event.themeBrand ?? '#bf5a2a',
    ink: event.themeText ?? '#14261f',
    inkSoft: event.themeText ?? '#587065',
    surface: event.themeSurface ?? '#fffaf2',
    highlight: event.themeHighlight ?? '#f4c978',
  }
}

export function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    } else {
      line = candidate
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function clipRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.save()
  drawRoundRect(ctx, x, y, w, h, r)
  ctx.clip()
}

/** Miniatura quadrata: ritaglio "cover", immagine centrata. */
export function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  radius: number,
) {
  clipRoundRect(ctx, x, y, size, size, radius)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, size, size)
  if (img) {
    const s = Math.max(size / img.width, size / img.height)
    const w = img.width * s
    const h = img.height * s
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h)
  }
  ctx.restore()
  ctx.save()
  drawRoundRect(ctx, x, y, size, size, radius)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
}

/** Foto grande: contiene tutto il prodotto ("contain") e, senza immagine,
 *  la iniziale del nome — un rettangolo bianco vuoto su un social non si
 *  distingue da un'immagine rotta. */
export function drawPhotoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fallbackInitial: string,
) {
  ctx.save()
  drawRoundRect(ctx, x, y, w, h, radius)
  ctx.clip()
  ctx.fillStyle = img ? '#ffffff' : '#f1ebde'
  ctx.fillRect(x, y, w, h)
  if (img) {
    const s = Math.min(w / img.width, h / img.height)
    const iw = img.width * s
    const ih = img.height * s
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
  } else {
    ctx.fillStyle = '#587065'
    ctx.font = '700 120px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(fallbackInitial.charAt(0).toUpperCase(), x + w / 2, y + h / 2)
  }
  ctx.restore()
  ctx.save()
  drawRoundRect(ctx, x, y, w, h, radius)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
}

export function drawCircleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  d: number,
  initial: string,
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  if (img) {
    ctx.clip()
    const s = Math.max(d / img.width, d / img.height)
    const w = img.width * s
    const h = img.height * s
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  } else {
    ctx.clip()
    ctx.fillStyle = '#f1ebde'
    ctx.fill()
    ctx.fillStyle = '#587065'
    ctx.font = '700 52px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initial.charAt(0).toUpperCase(), cx, cy + 2)
  }
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.restore()
}

/** Glifo della moneta dell'evento: immagine caricata dal form, oppure
 *  iniziale in cerchio. Usato solo se il nome moneta non è già un simbolo. */
export function drawCurrencyGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  d: number,
  img: HTMLImageElement | null,
  initial: string,
  brand: string,
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  if (img) {
    ctx.clip()
    const s = Math.max(d / img.width, d / img.height)
    const w = img.width * s
    const h = img.height * s
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  } else {
    ctx.fillStyle = brand
    ctx.font = '700 18px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initial, cx, cy + 1)
  }
  ctx.beginPath()
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
  ctx.strokeStyle = brand
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

/** Banda di testa comune a tutti i poster: colore del tema, logo evento in
 *  cerchio e nome dell'evento. Il nome è troncato a una riga come prima. */
export function drawEventBand(
  ctx: CanvasRenderingContext2D,
  colors: PosterColors,
  eventLogo: HTMLImageElement | null,
  eventName: string,
) {
  ctx.save()
  ctx.fillStyle = colors.brand
  ctx.fillRect(0, 0, POSTER_WIDTH, BAND_H)

  if (eventLogo) {
    drawCircleImage(ctx, eventLogo, 92, 70, 76, eventName)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 40px "Segoe UI", Inter, sans-serif'
  const evNameLines = wrapText(ctx, eventName, POSTER_WIDTH - 165 - 40, 1)
  ctx.fillText(evNameLines[0] ?? '', 165, 70)
  ctx.restore()
}

/** Blocco basso comune: riquadro brand con luogo e date, QR del menu a
 *  destra con la sua didascalia. */
export function drawPosterFooter(
  ctx: CanvasRenderingContext2D,
  colors: PosterColors,
  opts: {
    locationLabel: string
    dateRange: string
    qrImage: HTMLImageElement | null
    qrLabel: string
  },
) {
  ctx.save()
  ctx.fillStyle = colors.brand
  drawRoundRect(ctx, FOOTER_X, FOOTER_Y, FOOTER_W, FOOTER_H, 24)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if (opts.locationLabel) {
    ctx.font = '700 34px "Segoe UI", Inter, sans-serif'
    ctx.fillText(opts.locationLabel, 150, 1200)
  }
  if (opts.dateRange) {
    ctx.font = '500 30px "Segoe UI", Inter, sans-serif'
    ctx.fillText(opts.dateRange, 150, opts.locationLabel ? 1244 : 1220)
  }
  ctx.restore()

  if (!opts.qrImage) return

  ctx.save()
  ctx.fillStyle = '#ffffff'
  drawRoundRect(ctx, QR_X, QR_Y, QR_SIZE, QR_SIZE, 16)
  ctx.fill()
  ctx.clip()
  ctx.drawImage(opts.qrImage, QR_X + 5, QR_Y + 5, QR_SIZE - 10, QR_SIZE - 10)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = colors.brand
  ctx.lineWidth = 4
  drawRoundRect(ctx, QR_X, QR_Y, QR_SIZE, QR_SIZE, 16)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = colors.brand
  ctx.font = '600 22px "Segoe UI", Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(opts.qrLabel, QR_X + QR_SIZE / 2, QR_Y + QR_SIZE + 20)
}

/** Prezzo in crediti con glifo della moneta. Il simbolo nudo ('€') va
 *  scritto accanto al numero, l'iniziale è disegnata a parte. Il numero
 *  arriva già formattato (`formatCredits`): qui si disegna, non si decide
 *  come si scrive. */
export function drawPrice(
  ctx: CanvasRenderingContext2D,
  colors: PosterColors,
  formattedPrice: string,
  x: number,
  y: number,
  opts: {
    align: 'left' | 'right' | 'center'
    bareSymbol: string | null
    glyphSize: number
    currencyImage: HTMLImageElement | null
    currencyInitial: string
    fontSize?: number
  },
) {
  ctx.fillStyle = colors.brand
  ctx.font = `700 ${opts.fontSize ?? 26}px "Segoe UI", Inter, sans-serif`
  /* L'ordine dei setter è quello del vecchio codice del poster del menu:
     identico a schermo, ma tiene la sequenza di disegno identica. */
  ctx.textAlign = opts.align
  ctx.textBaseline = 'middle'

  if (opts.bareSymbol) {
    ctx.fillText(`${formattedPrice} ${opts.bareSymbol}`, x, y)
    return
  }

  const gap = 7
  const glyphSize = opts.glyphSize
  ctx.fillText(formattedPrice, x - gap - glyphSize, y)
  drawCurrencyGlyph(
    ctx,
    x - glyphSize / 2,
    y,
    glyphSize,
    opts.currencyImage,
    opts.currencyInitial,
    colors.brand,
  )
}