import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { apiRequest } from '../lib/api'
import { buildSocialMenuCaption, formatEventDateRange } from '../lib/socialMenu'
import type { UploadedImage } from '../lib/upload'
import styles from './SocialMenuExport.module.scss'

const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1350

export type SocialMenuExportEvent = {
  id: string
  name: string
  logo: UploadedImage | null
  startDate: string
  endDate: string
  location?: { label?: string | null; city?: string | null } | null
  shortDescription?: string | null
  themeBrand?: string | null
  themeText?: string | null
  themeSurface?: string | null
  themeHighlight?: string | null
}

export type SocialMenuExportStand = {
  id: string
  name: string
  slogan?: string | null
  logo: UploadedImage | null
}

export type SocialMenuExportMenuItem = {
  id: string
  product: { name: string } | null
}

type Props = {
  open: boolean
  event: SocialMenuExportEvent
  stand: SocialMenuExportStand
  menuItems: SocialMenuExportMenuItem[]
  onClose: () => void
}

function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function drawRoundRect(
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

function drawCircleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  d: number,
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
  }
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.restore()
}

function wrapText(
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

async function generatePoster(
  ctx: CanvasRenderingContext2D,
  event: SocialMenuExportEvent,
  stand: SocialMenuExportStand,
  productNames: string[],
  qrImage: HTMLImageElement | null,
): Promise<void> {
  const W = POSTER_WIDTH
  const H = POSTER_HEIGHT
  const brand = event.themeBrand ?? '#bf5a2a'
  const ink = event.themeText ?? '#14261f'
  const inkSoft = event.themeText ?? '#587065'
  const surface = event.themeSurface ?? '#fffaf2'
  const highlight = event.themeHighlight ?? '#f4c978'

  ctx.save()
  ctx.fillStyle = surface
  ctx.fillRect(0, 0, W, H)

  // ── Brand band (event) ──
  ctx.save()
  ctx.fillStyle = brand
  ctx.fillRect(0, 0, W, 185)

  const eventLogo = await loadImage(event.logo?.url ?? '', true)
  if (eventLogo) {
    drawCircleImage(ctx, eventLogo, 105, 92, 96)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 44px "Segoe UI", Inter, sans-serif'
  const evNameLines = wrapText(ctx, event.name, W - 180 - 60, 1)
  ctx.fillText(evNameLines[0] ?? '', 180, 80)

  const dateRange = formatEventDateRange(event.startDate, event.endDate)
  if (dateRange) {
    ctx.font = '600 30px "Segoe UI", Inter, sans-serif'
    ctx.fillText(dateRange, 180, 132)
  }
  ctx.restore()

  // ── Stand logo + name ──
  const standLogo = await loadImage(stand.logo?.url ?? '', true)
  drawCircleImage(ctx, standLogo, W / 2, 285, 180)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink
  ctx.font = '700 56px "Segoe UI", Inter, sans-serif'
  const standNameLines = wrapText(ctx, stand.name, W - 220, 2)
  standNameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 440 + i * 66)
  })

  if (stand.slogan) {
    ctx.fillStyle = inkSoft
    ctx.font = 'italic 400 30px "Segoe UI", Inter, sans-serif'
    const sloganLines = wrapText(ctx, stand.slogan, W - 260, 2)
    sloganLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, 570 + i * 38)
    })
  }

  // ── Divider + "Il menu" ──
  ctx.fillStyle = highlight
  ctx.fillRect(250, 642, W - 500, 5)
  ctx.fillStyle = brand
  ctx.font = '700 38px "Segoe UI", Inter, sans-serif'
  ctx.fillText('Il menu', W / 2, 694)

  // ── Products grid (no prices) ──
  const MAX_PRODUCTS = 12
  const list = productNames.slice(0, MAX_PRODUCTS)
  const remainder = productNames.length - list.length
  const colWidth = 440
  const colX = [95, 545]
  const maxRows = Math.ceil(list.length / 2)
  const rowStartY = 740
  const rowH = 70

  ctx.font = '500 30px "Segoe UI", Inter, sans-serif'
  ctx.fillStyle = ink

  list.forEach((pname, i) => {
    const row = Math.floor(i / 2)
    const col = i % 2
    const x = colX[col]
    const y = rowStartY + row * rowH

    ctx.save()
    ctx.fillStyle = brand
    ctx.beginPath()
    ctx.arc(x + 14, y + 8, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const lines = wrapText(ctx, pname, colWidth - 44, 2)
    lines.forEach((line, li) => {
      ctx.fillText(line, x + 34, y + li * 35)
    })
  })

  if (list.length === 0) {
    ctx.fillStyle = inkSoft
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic 400 32px "Segoe UI", Inter, sans-serif'
    ctx.fillText('Il menu è in preparazione', W / 2, 900)
  } else if (remainder > 0) {
    ctx.fillStyle = brand
    ctx.font = '600 30px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`+ ${remainder} altri`, colX[0] + 34, rowStartY + maxRows * rowH)
  }

  // ── Bottom: location/date box + QR ──
  const locLabel = (event.location?.city ?? event.location?.label ?? '').trim()

  ctx.save()
  ctx.fillStyle = brand
  drawRoundRect(ctx, 95, 1170, 700, 120, 24)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if (locLabel) {
    ctx.font = '700 36px "Segoe UI", Inter, sans-serif'
    ctx.fillText(locLabel, 150, 1210)
  }
  if (dateRange) {
    ctx.font = '500 32px "Segoe UI", Inter, sans-serif'
    ctx.fillText(dateRange, 150, locLabel ? 1255 : 1230)
  }
  ctx.restore()

  if (qrImage) {
    const qrSize = 150
    const qx = 830
    const qy = 1160
    ctx.save()
    ctx.fillStyle = '#ffffff'
    drawRoundRect(ctx, qx, qy, qrSize, qrSize, 16)
    ctx.fill()
    ctx.clip()
    ctx.drawImage(qrImage, qx + 6, qy + 6, qrSize - 12, qrSize - 12)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = brand
    ctx.lineWidth = 4
    drawRoundRect(ctx, qx, qy, qrSize, qrSize, 16)
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = brand
    ctx.font = '600 24px "Segoe UI", Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Menu dello stand', qx + qrSize / 2, qy + qrSize + 22)
  }

  ctx.restore()
}

export function SocialMenuExport({ open, event, stand, menuItems, onClose }: Props) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(true)
  const [copied, setCopied] = useState(false)
  const [captionText, setCaptionText] = useState<string | null>(null)

  const productNames = useMemo(
    () => menuItems.map((m) => m.product?.name ?? '').filter(Boolean),
    [menuItems],
  )

  const menuUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/events/${event.id}/stands/${stand.id}`
  }, [event.id, stand.id])

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
        productNames,
        menuUrl,
      }),
    [stand.name, stand.slogan, event.name, event.startDate, event.endDate, event.location, event.shortDescription, productNames, menuUrl],
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
        await generatePoster(ctx, event, stand, productNames, qrImg)
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
  }, [open, event, stand, productNames])

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
              Poster con il menu dello stand, logo dell&apos;evento e QR per raggiungere la pagina.
            </p>

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