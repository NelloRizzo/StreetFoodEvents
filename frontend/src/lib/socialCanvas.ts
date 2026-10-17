import type { UploadedImage } from './upload'

/** Geometria e primitive di disegno degli export social.
 *
 *  Stanno in una lib e non dentro `SocialMenuExport` perché anche l'export
 *  dei singoli prodotti deve produrre immagini con lo **stesso** formato di
 *  quelle del menu: due copie delle stesse funzioni andrebbero tenute
 *  allineate a mano, e un divergimento si vede solo sull'immagine scaricata.
 *
 *  **Due formati, non uno.** Un'immagine 4:5 caricata in una storia viene
 *  ritagliata: il footer con il QR (cioè la parte che porta al menu)
 *  cadrebbe via. Quindi il formato è scelto dall'operatore e ognuno dei due
 *  ha il suoposto. Tutto ciò che è ancorato ai bordi — banda in alto,
 *  footer in basso — si calcola da `posterMetrics`, mentre la sagoma di
 *  ciascun poster (nome, foto, prezzi) adatta le proprie coordinate
 *  all'altezza utile. */

export type PosterFormatId = 'feed' | 'story'

export type PosterFormat = {
  id: PosterFormatId
  /** Etichetta mostrata all'operatore. */
  label: string
  /** Dove si usa, per chi non ha familiarità con le sigle. */
  hint: string
  width: number
  height: number
}

export const POSTER_FORMATS: Record<PosterFormatId, PosterFormat> = {
  feed: {
    id: 'feed',
    label: '4:5',
    hint: 'Post',
    width: 1080,
    height: 1350,
  },
  story: {
    id: 'story',
    label: '9:16',
    hint: 'Storie e reel',
    width: 1080,
    height: 1920,
  },
}

/** Il formato di partenza: 9:16, cioè quello per cui si è chiesto il
 *  cambio (storie e reel, che si vedono a schermo intero). Chi non sceglie
 *  nulla ottiene immagini diverse da quelle storiche: è una scelta, e per
 *  tornare indietro basta selezionare 4:5 nei due export. */
export const DEFAULT_FORMAT: PosterFormatId = 'story'

export type PosterMetrics = PosterFormat & {
  /** Fattore delle **distanze verticali** rispetto al formato 4:5.
   *
   *  Non scala tutto: a parità di larghezza dell'immagine (1080 in entrambi
   *  i formati) un corpo dei caratteri più grande sarebbe sproporzionato,
   *  perché sul telefono le due immagini si vedono alla stessa
   *  larghezza. Crescono quindi i **spazi**, che è quello che serve a un
   *  formato più alto: più aria e, nel menu, più prodotti in elenco. */
  vScale: number
  /** Altezza della banda di testa (logo e nome dell'evento). */
  bandH: number
  /** Y del blocco basso: luogo/data a sinistra, QR del menu a destra. */
  footerY: number
  footerH: number
}

/** Altezza del formato di riferimento: i disegni sono scritti per il 4:5 e
 *  le distanze verticali si riscalano da lì. */
const BASE_HEIGHT = POSTER_FORMATS.feed.height
/** Quanto del salto di altezza si traduce in spazio. Mezzo: oltre, gli
 *  elementi resterebbero troppo distanti fra loro; meno, il formato alto
 *  sembrerebbe affollato. */
const V_SCALE_WEIGHT = 0.5

/** Geometria ancorata ai bordi di un formato. Il footer è calcolato dalla
 *  fine del foglio, non da una coordinata fissa: cambiarne l'altezza o il
 *  margine sposta tutto il blocco senza toccare i disegni dentro, che sono
 *  calcolati da `footerY`. */
export function posterMetrics(format: PosterFormatId): PosterMetrics {
  const f = POSTER_FORMATS[format] ?? POSTER_FORMATS[DEFAULT_FORMAT]
  const vScale = 1 + (f.height / BASE_HEIGHT - 1) * V_SCALE_WEIGHT
  const footerH = 118
  const bottomMargin = 72
  return {
    ...f,
    vScale,
    bandH: Math.round(140 * vScale),
    footerH,
    footerY: f.height - bottomMargin - footerH,
  }
}

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
  metrics: PosterMetrics,
  eventLogo: HTMLImageElement | null,
  eventName: string,
) {
  const W = metrics.width
  ctx.save()
  ctx.fillStyle = colors.brand
  ctx.fillRect(0, 0, W, metrics.bandH)

  if (eventLogo) {
    drawCircleImage(ctx, eventLogo, 100, metrics.bandH / 2, 92, eventName)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 46px "Segoe UI", Inter, sans-serif'
  const evNameLines = wrapText(ctx, eventName, W - 200 - 40, 1)
  ctx.fillText(evNameLines[0] ?? '', 200, metrics.bandH / 2)
  ctx.restore()
}

/** Blocco basso comune: riquadro brand con luogo e date, QR del menu a
 *  destra con la sua didascalia. Le posizioni dentro il riquadro sono
 *  calcolate da `footerY`: il blocco si può spostare senza riscriverlo. */
export function drawPosterFooter(
  ctx: CanvasRenderingContext2D,
  colors: PosterColors,
  metrics: PosterMetrics,
  opts: {
    locationLabel: string
    dateRange: string
    qrImage: HTMLImageElement | null
    qrLabel: string
  },
) {
  const footerX = 95
  const footerW = 700
  const qrSize = 118
  const qrX = metrics.width - footerX - qrSize
  const qrY = metrics.footerY - 4

  ctx.save()
  ctx.fillStyle = colors.brand
  drawRoundRect(ctx, footerX, metrics.footerY, footerW, metrics.footerH, 24)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if (opts.locationLabel) {
    ctx.font = '700 34px "Segoe UI", Inter, sans-serif'
    ctx.fillText(opts.locationLabel, 150, metrics.footerY + 40)
  }
  if (opts.dateRange) {
    ctx.font = '500 30px "Segoe UI", Inter, sans-serif'
    ctx.fillText(opts.dateRange, 150, metrics.footerY + (opts.locationLabel ? 84 : 60))
  }
  ctx.restore()

  if (!opts.qrImage) return

  ctx.save()
  ctx.fillStyle = '#ffffff'
  drawRoundRect(ctx, qrX, qrY, qrSize, qrSize, 16)
  ctx.fill()
  ctx.clip()
  ctx.drawImage(opts.qrImage, qrX + 5, qrY + 5, qrSize - 10, qrSize - 10)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = colors.brand
  ctx.lineWidth = 4
  drawRoundRect(ctx, qrX, qrY, qrSize, qrSize, 16)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = colors.brand
  ctx.font = '600 26px "Segoe UI", Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(opts.qrLabel, qrX + qrSize / 2, qrY + qrSize + 26)
}

export type Rect = { x: number; y: number; w: number; h: number }

/** Riquadro che contiene **senza tagliare** la foto, centrato nell'area data.
 *  In 9:16 un riquadro alto e stretto con dentro una foto panoramica
 *  lascerebbe due bande vuote *dentro* il riquadro bianco: sembrerebbe un
 *  errore di caricamento. Qui il riquadro si stringe attorno alla foto e
 *  attorno a lui resta il colore del poster. */
export function fitPhotoBox(img: HTMLImageElement | null, area: Rect): Rect {
  if (!img || !(img.width > 0) || !(img.height > 0)) return area
  const ratio = img.width / img.height
  let w = area.w
  let h = w / ratio
  if (h > area.h) {
    h = area.h
    w = h * ratio
  }
  return {
    x: area.x + (area.w - w) / 2,
    y: area.y + (area.h - h) / 2,
    w,
    h,
  }
}

/** Prezzo in crediti con glifo della moneta (o con il simbolo nudo, '€').
 *
 *  Il numero arriva già formattato (`formatCredits`): qui si disegna, non si
 *  decide come si scrive.
 *
 *  **Numero e simbolo sono due pezzi misurati, non una stringa con uno
 *  spazio**: lo spazio dipende dal carattere di spaziatura del font e sui
 *  numeri in grassetto al telefono risulta invisibile. Qui la distanza è
 *  un numero (proporzionale al corpo) e vale per entrambi i casi.
 *
 *  **L'allineamento riguarda il gruppo numero+simbolo**, non il numero: la
 *  versione precedente posizionava il testo come se fosse sempre allineato a
 *  destra, quindi con `center` (il poster di un singolo prodotto) il glifo
 *  entrava dentro il numero. */
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
  const fontSize = opts.fontSize ?? 26
  /* Stacco numero/simbolo: abbastanza da leggersi su uno schermo di
     telefono, e scala col corpo come tutto il resto del poster. */
  const gap = Math.round(fontSize * 0.3)

  /* `save`/`restore` attorno a tutto il corpo: il prezzo cambia `textAlign`
     e `textBaseline` per misurare e posizionare il gruppo numero+simbolo, e
     senza ripristino quei valori restano sul contesto condiviso e rovinano
     cio' che viene disegnato dopo. E' successo alla descrizione del
     prodotto, che si appoggia al `center` della testa del poster: partiva
     dal centro e proseguiva verso destra. */
  ctx.save()
  ctx.fillStyle = colors.brand
  ctx.font = `700 ${fontSize}px "Segoe UI", Inter, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  const textWidth = ctx.measureText(formattedPrice).width
  const symbolWidth = opts.bareSymbol
    ? ctx.measureText(opts.bareSymbol).width
    : opts.glyphSize
  const total = textWidth + gap + symbolWidth

  const left = opts.align === 'right' ? x - total : opts.align === 'center' ? x - total / 2 : x

  ctx.fillText(formattedPrice, left, y)

  if (opts.bareSymbol) {
    ctx.fillText(opts.bareSymbol, left + textWidth + gap, y)
  } else {
    drawCurrencyGlyph(
      ctx,
      left + textWidth + gap + opts.glyphSize / 2,
      y,
      opts.glyphSize,
      opts.currencyImage,
      opts.currencyInitial,
      colors.brand,
    )
  }
  ctx.restore()
}