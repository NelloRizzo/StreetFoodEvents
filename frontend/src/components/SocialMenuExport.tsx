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
  POSTER_HEIGHT,
  POSTER_WIDTH,
  drawCircleImage,
  drawEventBand,
  drawPosterFooter,
  drawPrice,
  drawRoundedImage,
  loadImage,
  posterColors,
  wrapText,
  type SocialPosterEvent,
  type SocialPosterStand,
} from '../lib/socialCanvas'
import type { UploadedImage } from '../lib/upload'
import styles from './SocialExport.module.scss'

const INCLUDE_PRICES_KEY = 'sfe-social-include-prices'

/* Alias mantenuti: i nomi sono quelli con cui il componente è stato
   introdotto e restano nella sua firma pubblica. */
export type SocialMenuExportEvent = SocialPosterEvent
export type SocialMenuExportStand = SocialPosterStand

export type SocialMenuExportMenuItem = {
  id: string
  product: {
    name: string
    price: number
    coverImage?: UploadedImage | null
  } | null
  priceOverride: number | null
}

type SocialProduct = {
  name: string
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
): Promise<void> {
  const W = POSTER_WIDTH
  const H = POSTER_HEIGHT
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
  drawEventBand(ctx, colors, eventLogo, event.name)

  // ── Banner stand (se presente) ──
  const bandBottom = 140
  const bannerH = 220
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
  drawCircleImage(ctx, logoImg, W / 2, 360, 150, stand.name)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink
  ctx.font = '700 50px "Segoe UI", Inter, sans-serif'
  const standNameLines = wrapText(ctx, stand.name, W - 240, 2)
  standNameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 508 + i * 60)
  })

  if (stand.slogan) {
    ctx.fillStyle = inkSoft
    ctx.font = 'italic 400 28px "Segoe UI", Inter, sans-serif'
    const sloganLines = wrapText(ctx, stand.slogan, W - 280, 2)
    sloganLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, 640 + i * 36)
    })
  }

  // ── Divider + "Il menu" ──
  ctx.fillStyle = highlight
  ctx.fillRect(250, 706, W - 500, 5)
  ctx.fillStyle = brand
  ctx.font = '700 36px "Segoe UI", Inter, sans-serif'
  ctx.fillText('Il menu', W / 2, 752)

  // ── Moneta evento (legenda, solo con prezzi e moneta non-euro) ──
  const showMonetaLine = includePrices && monetaLine != null
  if (showMonetaLine) {
    ctx.fillStyle = inkSoft
    ctx.font = 'italic 400 26px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(monetaLine, W / 2, 790)
  }

  // ── Products grid (foto + nome, prezzo opzionale) ──
  const MAX_PRODUCTS = 8
  const list = products.slice(0, MAX_PRODUCTS)
  const remainder = products.length - list.length
  const colWidth = 440
  const colX = [95, 545]
  const rowStartY = showMonetaLine ? 818 : 788
  const rowH = 80
  const thumbSize = 58
  const priceColW = 150

  list.forEach((p, i) => {
    const row = Math.floor(i / 2)
    const col = i % 2
    const x = colX[col]
    const y = rowStartY + row * rowH
    const hasPrice = includePrices && (p.price ?? 0) > 0

    drawRoundedImage(ctx, thumbs[i], x, y + 4, thumbSize, 14)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = '500 30px "Segoe UI", Inter, sans-serif'
    ctx.fillStyle = ink
    const lines = wrapText(ctx, p.name, colWidth - thumbSize - 20 - (hasPrice ? priceColW : 0), 2)
    lines.forEach((line, li) => {
      ctx.fillText(line, x + thumbSize + 20, y + (li === 0 ? 10 : 44))
    })

    if (hasPrice) {
      drawPrice(ctx, colors, formatCredits(p.price), x + colWidth - 8, y + 32, {
        align: 'right',
        bareSymbol: currencyBareSymbol,
        glyphSize: 30,
        currencyImage: currencyImg,
        currencyInitial: currencyGlyphInitial,
      })
    }
  })

  if (list.length === 0) {
    ctx.fillStyle = inkSoft
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic 400 32px "Segoe UI", Inter, sans-serif'
    ctx.fillText('Il menu è in preparazione', W / 2, 970)
  } else if (remainder > 0) {
    ctx.fillStyle = brand
    ctx.font = '600 28px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`+ ${remainder} altri`, colX[0] + thumbSize + 20, rowStartY + 4 * rowH)
  }

  // ── Bottom: location/date box + QR ──
  drawPosterFooter(ctx, colors, {
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

  useEffect(() => {
    try {
      localStorage.setItem(INCLUDE_PRICES_KEY, includePrices ? '1' : '0')
    } catch {
      /* localStorage non disponibile */
    }
  }, [includePrices])

  const products = useMemo<SocialProduct[]>(() => {
    const out: SocialProduct[] = []
    for (const m of menuItems) {
      if (m.product?.name) {
        out.push({
          name: m.product.name,
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
        currencyName: event.currencyName ?? null,
        exchangeRate: event.exchangeRate ?? null,
      }),
    [stand.name, stand.slogan, event.name, event.startDate, event.endDate, event.location, event.shortDescription, products, menuUrl, includePrices, event.currencyName, event.exchangeRate],
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
        canvas.width = POSTER_WIDTH
        canvas.height = POSTER_HEIGHT
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await generatePoster(ctx, event, stand, products, qrImg, includePrices)
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
  }, [open, event, stand, products, includePrices])

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
