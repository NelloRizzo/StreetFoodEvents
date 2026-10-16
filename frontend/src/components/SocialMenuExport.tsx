import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { apiRequest } from '../lib/api'
import {
  buildSocialMenuCaption,
  currencyInitial,
  formatCredits,
  formatEventDateRange,
  formatMonetaLine,
  isBareCurrencySymbol,
} from '../lib/socialMenu'
/* Le primitive di disegno stanno in lib: l'export dei singoli prodotti deve
   produrre immagini con lo stesso formato, e due copie andrebbero tenute
   allineate a mano. */
import {
  drawCircleImage,
  drawEventBand,
  drawPosterFooter,
  drawPrice,
  drawRoundedImage,
  loadImage,
  posterColors,
  posterMetrics,
  wrapText,
  type PosterFormatId,
  type PosterMetrics,
  type SocialPosterEvent,
  type SocialPosterStand,
} from '../lib/socialCanvas'
import type { UploadedImage } from '../lib/upload'
import { useSocialFormat } from '../lib/useSocialFormat'
import { SocialFormatPicker } from './SocialFormatPicker'
import styles from './SocialExport.module.scss'

const INCLUDE_PRICES_KEY = 'sfe-social-include-prices'
/** Condivisa con l'export del prodotto: e' la stessa scelta di cosa mostrare
 *  di un piatto, non due impostazioni da tenere allineate a mano. */
const INCLUDE_DESCRIPTIONS_KEY = 'sfe-social-include-descriptions'

/** Quante colonne ha la griglia prodotti. */
const GRID_COLS = 2
const GRID_X = [95, 545]
const GRID_COL_W = 440

/** Impaginazione del poster del menu.
 *
 *  I numeri sono quelli del formato **4:5** (l'impiaginazione storica, che
 *  resta identica) moltiplicati per `vScale`, il fattore delle distanze
 *  verticali. I corpi dei caratteri e le larghezze restano quelli di base:
 *  a parità di larghezza dell'immagine non è il testo che deve crescere,
 *  è lo spazio fra le cose.
 *
 *  Il numero di righe della griglia non è scritto: arriva dallo spazio fra
 *  l'intestazione e il footer. È quello che fa mostrare 8 prodotti in 4:5 e
 *  14 in 9:16 senza due elenchi di coordinate da tenere allineati — e senza
 *  che un formato più basso finisca per disegnare prodotti sopra il footer. */
function menuLayout(m: PosterMetrics) {
  const v = m.vScale
  const bandBottom = m.bandH
  const bannerH = Math.round(220 * v)
  /* Il logo si sovrappone al banner come prima: il cerchio è centrato sul
     bordo inferiore del banner. */
  const logoY = bandBottom + bannerH
  const logoD = Math.round(150 * (1 + (v - 1) * 0.6))
  const nameY = Math.round((508 * v))
  const standNameLh = Math.round(60 * v)
  const sloganY = Math.round(640 * v)
  const sloganLh = Math.round(36 * v)
  const dividerY = Math.round(706 * v)
  const titleY = Math.round(752 * v)
  const monetaY = Math.round(790 * v)
  const gridTop = Math.round(818 * v)

  /* Riga piu' alta nel formato alto, ma non proporzionale: la cella deve
     continuare a contenere il nome su due righe senza diventare
     illeggibile, e il 4:5 deve mostrare gli stessi 8 prodotti di prima. */
  const rowH = Math.round(74 * (1 + (v - 1) * 0.6))
  const thumb = Math.round(rowH * 0.76)

  /* Spazio riservato alla riga "+N altri" sotto l'ultima riga usata: senza
     questa riserva il "+N altri" finiva sopra il footer. */
  const restLineH = Math.round(32 * v)
  const gridBottom = m.footerY - restLineH - 8
  const rows = Math.max(1, Math.floor((gridBottom - gridTop) / rowH))

  return {
    bandBottom,
    bannerH,
    logoY,
    logoD,
    nameY,
    standNameLh,
    sloganY,
    sloganLh,
    dividerY,
    titleY,
    monetaY,
    gridTop,
    rowH,
    thumb,
    rows,
    priceColW: Math.round(rowH * 1.9),
    nameTop: Math.round((rowH - thumb) / 2) + 5,
    nameLh: Math.round(rowH * 0.38),
  }
}

/* Alias mantenuti: i nomi sono quelli con cui il componente è stato
   introdotto e restano nella sua firma pubblica. */
export type SocialMenuExportEvent = SocialPosterEvent
export type SocialMenuExportStand = SocialPosterStand

export type SocialMenuExportMenuItem = {
  id: string
  product: {
    name: string
    description?: string | null
    price: number
    coverImage?: UploadedImage | null
  } | null
  priceOverride: number | null
}

type SocialProduct = {
  name: string
  description?: string | null
  coverImage: UploadedImage | null
  price: number
}

type Props = {
  open: boolean
  event: SocialMenuExportEvent
  stand: SocialMenuExportStand
  menuItems: SocialMenuExportMenuItem[]
  onClose: () => void
}

export async function generatePoster(
  ctx: CanvasRenderingContext2D,
  event: SocialMenuExportEvent,
  stand: SocialMenuExportStand,
  products: SocialProduct[],
  qrImage: HTMLImageElement | null,
  includePrices: boolean,
  format: PosterFormatId,
): Promise<void> {
  const m = posterMetrics(format)
  const W = m.width
  const H = m.height
  const L = menuLayout(m)
  const colors = posterColors(event)
  const { brand, ink, inkSoft, surface, highlight } = colors
  const currencyName = (event.currencyName ?? '').trim() || '€'
  const monetaLine = formatMonetaLine(event.currencyName, event.exchangeRate)
  const currencyBareSymbol = isBareCurrencySymbol(event.currencyName) ? currencyName : null
  const currencyGlyphInitial = currencyInitial(event.currencyName)

  const bannerImg = stand.coverImage?.url
    ? await loadImage(stand.coverImage.url, true)
    : null
  const logoSource = stand.logo?.url ?? stand.coverImage?.url ?? ''
  const logoImg = await loadImage(logoSource, true)
  const eventLogo = event.logo?.url ? await loadImage(event.logo.url, true) : null
  const currencyImg = event.currencySymbol?.url ? await loadImage(event.currencySymbol.url, true) : null
  const thumbs = await Promise.all(
    products.map((p) =>
      p.coverImage?.url ? loadImage(p.coverImage.url, true) : Promise.resolve(null),
    ),
  )

  ctx.save()
  ctx.fillStyle = surface
  ctx.fillRect(0, 0, W, H)

  // ── Brand band (event) ──
  drawEventBand(ctx, colors, m, eventLogo, event.name)

  // ── Banner stand (se presente) ──
  const bandBottom = L.bandBottom
  const bannerH = L.bannerH
  if (bannerImg) {
    // contenuto: intero, senza ritaglio (object-fit: contain)
    const s = Math.min(W / bannerImg.width, bannerH / bannerImg.height)
    const w = bannerImg.width * s
    const h = bannerImg.height * s
    const bx = (W - w) / 2
    const by = bandBottom + (bannerH - h) / 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, bandBottom, W, bannerH)
    ctx.clip()
    ctx.drawImage(bannerImg, bx, by, w, h)
    ctx.restore()
  }

  // ── Logo stand (sovrapposto al banner) ──
  drawCircleImage(ctx, logoImg, W / 2, L.logoY, L.logoD, stand.name)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink
  ctx.font = '700 54px "Segoe UI", Inter, sans-serif'
  const standNameLines = wrapText(ctx, stand.name, W - 240, 2)
  standNameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, L.nameY + i * L.standNameLh)
  })

  if (stand.slogan) {
    ctx.fillStyle = inkSoft
    ctx.font = 'italic 400 30px "Segoe UI", Inter, sans-serif'
    const sloganLines = wrapText(ctx, stand.slogan, W - 280, 2)
    sloganLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, L.sloganY + i * L.sloganLh)
    })
  }

  // ── Divider + "Il menu" ──
  ctx.fillStyle = highlight
  ctx.fillRect(250, L.dividerY, W - 500, 5)
  ctx.fillStyle = brand
  ctx.font = '700 42px "Segoe UI", Inter, sans-serif'
  ctx.fillText('Il menu', W / 2, L.titleY)

  // ── Moneta evento (legenda, solo con prezzi e moneta non-euro) ──
  const showMonetaLine = includePrices && monetaLine != null
  if (showMonetaLine) {
    ctx.fillStyle = inkSoft
    ctx.font = 'italic 400 27px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(monetaLine, W / 2, L.monetaY)
  }

  // ── Products grid (foto + nome, prezzo opzionale) ──
  // Il tetto non e' scritto: e' il numero di righe ricavato dallo spazio
  // utile (8 prodotti in 4:5, 12 in 9:16). Il "+N altri" copre il resto.
  const MAX_PRODUCTS = L.rows * GRID_COLS
  const list = products.slice(0, MAX_PRODUCTS)
  const remainder = products.length - list.length
  const colWidth = GRID_COL_W
  const colX = GRID_X
  const rowStartY = showMonetaLine ? L.gridTop : L.gridTop - 30
  const rowH = L.rowH
  const thumbSize = L.thumb
  const priceColW = L.priceColW

  list.forEach((p, i) => {
    const row = Math.floor(i / 2)
    const col = i % 2
    const x = colX[col]
    const y = rowStartY + row * rowH
    const hasPrice = includePrices && (p.price ?? 0) > 0

    drawRoundedImage(ctx, thumbs[i], x, y + (rowH - thumbSize) / 2, thumbSize, 18)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    /* Corpo storico (30px): con 32 il nome su due righe entrava nella riga
       sotto, e su un formato piu' stretto la terza riga veniva tagliata. */
    ctx.font = '500 28px "Segoe UI", Inter, sans-serif'
    ctx.fillStyle = ink
    const lines = wrapText(ctx, p.name, colWidth - thumbSize - 24 - (hasPrice ? priceColW : 0), 2)
    lines.forEach((line, li) => {
      ctx.fillText(line, x + thumbSize + 24, y + L.nameTop + li * L.nameLh)
    })

    if (hasPrice) {
      drawPrice(ctx, colors, formatCredits(p.price), x + colWidth - 8, y + rowH / 2, {
        align: 'right',
        bareSymbol: currencyBareSymbol,
        glyphSize: 28,
        currencyImage: currencyImg,
        currencyInitial: currencyGlyphInitial,
        fontSize: 26,
      })
    }
  })

  if (list.length === 0) {
    ctx.fillStyle = inkSoft
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic 400 36px "Segoe UI", Inter, sans-serif'
    ctx.fillText('Il menu è in preparazione', W / 2, rowStartY + rowH)
  } else if (remainder > 0) {
    ctx.fillStyle = brand
    ctx.font = '600 30px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    /* "+N altri" sta sotto l'ultima riga usata, non dopo un numero fisso
       di righe: il tetto cambia con il formato e il resto deve stare dove
       finiscono i prodotti mostrati. */
    const usedRows = Math.ceil(list.length / GRID_COLS)
    ctx.fillText(
      `+ ${remainder} altri`,
      colX[0] + thumbSize + 24,
      rowStartY + usedRows * rowH,
    )
  }

  // ── Bottom: location/date box + QR ──
  drawPosterFooter(ctx, colors, m, {
    locationLabel: (event.location?.city ?? event.location?.label ?? '').trim(),
    dateRange: formatEventDateRange(event.startDate, event.endDate),
    qrImage,
    qrLabel: 'Menu dello stand',
  })

  ctx.restore()
}

export function SocialMenuExport({ open, event, stand, menuItems, onClose }: Props) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(true)
  const [copied, setCopied] = useState(false)
  const [captionText, setCaptionText] = useState<string | null>(null)
  const [includePrices, setIncludePrices] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INCLUDE_PRICES_KEY) === '1'
    } catch {
      return false
    }
  })
  /* Il formato è lo stesso scelto nell'export dei prodotti: la chiave è
     condivisa, quindi non serve portarlo qui dalla pagina. */
  const [format, setFormat] = useSocialFormat()

  useEffect(() => {
    try {
      localStorage.setItem(INCLUDE_PRICES_KEY, includePrices ? '1' : '0')
    } catch {
      /* localStorage non disponibile */
    }
  }, [includePrices])

  const [includeDescriptions, setIncludeDescriptions] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INCLUDE_DESCRIPTIONS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(INCLUDE_DESCRIPTIONS_KEY, includeDescriptions ? '1' : '0')
    } catch {
      /* localStorage non disponibile */
    }
  }, [includeDescriptions])

  const products = useMemo<SocialProduct[]>(() => {
    const out: SocialProduct[] = []
    for (const m of menuItems) {
      if (m.product?.name) {
        out.push({
          name: m.product.name,
          description: m.product.description ?? null,
          coverImage: m.product.coverImage ?? null,
          price: m.priceOverride ?? m.product.price ?? 0,
        })
      }
    }
    return out
  }, [menuItems])

  const menuUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/events/${event.id}/stands/${stand.id}`
  }, [event.id, stand.id])

  const monetaNote = formatMonetaLine(event.currencyName, event.exchangeRate)

  const caption = useMemo(
    () =>
      buildSocialMenuCaption({
        standName: stand.name,
        standSlogan: stand.slogan ?? null,
        eventName: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location?.city ?? event.location?.label ?? null,
        eventTagline: event.shortDescription ?? null,
        products,
        menuUrl,
        includePrices,
        includeDescriptions,
        currencyName: event.currencyName ?? null,
        exchangeRate: event.exchangeRate ?? null,
      }),
    [stand.name, stand.slogan, event.name, event.startDate, event.endDate, event.location, event.shortDescription, products, menuUrl, includePrices, includeDescriptions, event.currencyName, event.exchangeRate],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const load = async () => {
      try {
        const qrResp = await apiRequest<{ qrCode: string }>(
          `/stands/${stand.id}/qrcode?eventId=${event.id}`,
        )
        const qrImg = await loadImage(qrResp.qrCode)
        if (cancelled) return
        setQrUrl(qrResp.qrCode)

        const canvas = document.createElement('canvas')
        canvas.width = posterMetrics(format).width
        canvas.height = posterMetrics(format).height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await generatePoster(ctx, event, stand, products, qrImg, includePrices, format)
        if (cancelled) return
        setPosterUrl(canvas.toDataURL('image/png'))
      } catch {
        /* poster non generabile — restano testo e QR */
      } finally {
        if (!cancelled) setGenerating(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, event, stand, products, includePrices, format])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const downloadPoster = () => {
    if (!posterUrl) return
    const anchor = document.createElement('a')
    anchor.href = posterUrl
    anchor.download = `social-menu-${stand.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}.png`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(captionText ?? caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard non disponibile */
    }
  }

  const downloadCaption = () => {
    const blob = new Blob([captionText ?? caption], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `social-menu-${stand.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const downloadQr = () => {
    if (!qrUrl) return
    const anchor = document.createElement('a')
    anchor.href = qrUrl
    anchor.download = `menu-qr-${stand.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}.png`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  const textareaValue = captionText ?? caption

  return (
    <>
      {createPortal(
        <div className={styles.overlay} onClick={onClose}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Chiudi">
              &times;
            </button>

            <h2 className={styles.title}>Esporta per social</h2>
            <p className={styles.hint}>
              Poster con banner e logo dello stand, prodotti, logo dell&apos;evento e QR per
              raggiungere la pagina.
            </p>

            <SocialFormatPicker format={format} onChange={setFormat} />

            <div className={styles.optionsRow}>
              <label className={styles.optionsLabel}>
                <input
                  type="checkbox"
                  checked={includePrices}
                  onChange={(e) => setIncludePrices(e.target.checked)}
                />
                <span>
                  Includi i prezzi (nella moneta dell&apos;evento)
                  {includePrices && monetaNote ? (
                    <em className={styles.optionsNote}>{monetaNote}</em>
                  ) : null}
                </span>
              </label>
              <label className={styles.optionsLabel}>
                <input
                  type="checkbox"
                  checked={includeDescriptions}
                  onChange={(e) => setIncludeDescriptions(e.target.checked)}
                />
                <span>
                  Includi le descrizioni
                  <em className={styles.optionsNote}>
                    Solo nel testo del post, non nel poster: l&apos;immagine 4:5 ha
                    poco spazio e una riga con la descrizione ne mostrerebbe uno o
                    tre piatti invece degli otto.
                  </em>
                </span>
              </label>
            </div>

            <div className={styles.grid}>
              <div className={styles.posterCol}>
                {generating ? (
                  <div className={styles.loading}>Generazione poster...</div>
                ) : posterUrl ? (
                  <img src={posterUrl} alt="Poster per social" className={styles.poster} />
                ) : (
                  <div className={styles.loading}>Poster non disponibile</div>
                )}
                <button
                  className={styles.primaryBtn}
                  onClick={downloadPoster}
                  disabled={!posterUrl}
                >
                  Scarica poster PNG
                </button>
              </div>

              <div className={styles.textCol}>
                <div className={styles.textSection}>
                  <span className={styles.sectionLabel}>Testo del post</span>
                  <textarea
                    className={styles.caption}
                    value={textareaValue}
                    onChange={(e) => setCaptionText(e.target.value)}
                    rows={12}
                  />
                  <div className={styles.row}>
                    <button className={styles.secondaryBtn} onClick={copyCaption}>
                      {copied ? 'Copiato!' : 'Copia testo'}
                    </button>
                    <button className={styles.secondaryBtn} onClick={downloadCaption}>
                      Scarica testo (.txt)
                    </button>
                  </div>
                </div>

                <div className={styles.qrSection}>
                  <span className={styles.sectionLabel}>QR code del menu</span>
                  {qrUrl ? (
                    <img src={qrUrl} alt="QR menu" className={styles.qr} />
                  ) : (
                    <span className={styles.qrEmpty}>QR non disponibile</span>
                  )}
                  <button
                    className={styles.secondaryBtn}
                    onClick={downloadQr}
                    disabled={!qrUrl}
                  >
                    Scarica QR.png
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
