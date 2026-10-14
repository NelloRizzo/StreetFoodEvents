import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { apiRequest } from '../lib/api'
import {
  currencyInitial,
  fileSlug,
  formatCredits,
  formatEventDateRange,
  formatMonetaLine,
  isBareCurrencySymbol,
} from '../lib/socialMenu'
import {
  POSTER_HEIGHT,
  POSTER_WIDTH,
  drawCircleImage,
  drawEventBand,
  drawPhotoBox,
  drawPosterFooter,
  drawPrice,
  loadImage,
  posterColors,
  wrapText,
  type SocialPosterEvent,
  type SocialPosterStand,
} from '../lib/socialCanvas'
import type { UploadedImage } from '../lib/upload'
import styles from './SocialExport.module.scss'

const INCLUDE_PRICES_KEY = 'sfe-social-include-prices'

/** Stessa chiave del menu: la scelta "mostra i prezzi" è la stessa
 *  preferenza dell'operatore, non una scelta per ogni export. */
type Props = {
  open: boolean
  event: SocialPosterEvent
  stand: SocialPosterStand
  menuItems: {
    id: string
    product: { name: string; price: number; coverImage?: UploadedImage | null } | null
    priceOverride: number | null
  }[]
  onClose: () => void
}

type Product = {
  id: string
  name: string
  coverImage: UploadedImage | null
  price: number
}

type GeneratedImage = {
  id: string
  name: string
  url: string
}

/** Pausa fra un'immagine e l'altra: senza, generare 20 poster in fila blocca
 *  l'interfaccia e non si vede nulla finché non ha finito. */
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Un poster per prodotto, con la stessa impaginazione del poster del menu:
 *  banda dell'evento, logo e nome dello stand, foto e prezzo del prodotto,
 *  riquadro luogo/data e QR verso il menu. Le differenze sono la foto
 *  grande al centro e il nome prodotto al posto del titolo "Il menu". */
async function generateProductPoster(
  ctx: CanvasRenderingContext2D,
  event: SocialPosterEvent,
  stand: SocialPosterStand,
  product: Product,
  productImage: HTMLImageElement | null,
  standLogo: HTMLImageElement | null,
  eventLogo: HTMLImageElement | null,
  currencyImage: HTMLImageElement | null,
  qrImage: HTMLImageElement | null,
  includePrices: boolean,
): Promise<void> {
  const W = POSTER_WIDTH
  const colors = posterColors(event)
  const currencyName = (event.currencyName ?? '').trim() || '€'
  const bareSymbol = isBareCurrencySymbol(event.currencyName) ? currencyName : null

  ctx.save()
  ctx.fillStyle = colors.surface
  ctx.fillRect(0, 0, W, POSTER_HEIGHT)

  drawEventBand(ctx, colors, eventLogo, event.name)

  // ── Logo e nome dello stand (più piccoli del poster del menu: qui il
  //    prodotto è il protagonista) ──
  drawCircleImage(ctx, standLogo, W / 2, 250, 120, stand.name)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = colors.ink
  ctx.font = '700 38px "Segoe UI", Inter, sans-serif'
  const standNameLines = wrapText(ctx, stand.name, W - 280, 2)
  standNameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 340 + i * 46)
  })

  ctx.fillStyle = colors.highlight
  ctx.fillRect(250, 430, W - 500, 5)

  // ── Nome prodotto (max 3 righe) ──
  ctx.fillStyle = colors.ink
  ctx.font = '700 46px "Segoe UI", Inter, sans-serif'
  const nameLines = wrapText(ctx, product.name, W - 200, 3)
  nameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 485 + i * 58)
  })

  let cursor = 485 + nameLines.length * 58 + 10

  // ── Prezzo sotto il nome ──
  if (includePrices && product.price > 0) {
    drawPrice(ctx, colors, formatCredits(product.price), W / 2, cursor + 20, {
      align: 'center',
      bareSymbol,
      glyphSize: 40,
      currencyImage,
      currencyInitial: currencyInitial(event.currencyName),
      fontSize: 40,
    })
    cursor += 74
  }

  // ── Foto del prodotto: cresce con lo spazio rimasto, con un minimo ──
  const photoTop = cursor + 26
  const photoH = Math.max(300, 1090 - photoTop)
  drawPhotoBox(ctx, productImage, 100, photoTop, W - 200, photoH, 28, product.name)

  drawPosterFooter(ctx, colors, {
    locationLabel: (event.location?.city ?? event.location?.label ?? '').trim(),
    dateRange: formatEventDateRange(event.startDate, event.endDate),
    qrImage,
    qrLabel: 'Menu dello stand',
  })

  ctx.restore()
}

export function SocialProductExport({ open, event, stand, menuItems, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [includePrices, setIncludePrices] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INCLUDE_PRICES_KEY) === '1'
    } catch {
      return false
    }
  })
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(INCLUDE_PRICES_KEY, includePrices ? '1' : '0')
    } catch {
      /* localStorage non disponibile */
    }
  }, [includePrices])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const products = useMemo<Product[]>(() => {
    const out: Product[] = []
    for (const m of menuItems) {
      if (m.product?.name) {
        out.push({
          id: m.id,
          name: m.product.name,
          coverImage: m.product.coverImage ?? null,
          price: m.priceOverride ?? m.product.price ?? 0,
        })
      }
    }
    return out
  }, [menuItems])

  const chosen = useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected],
  )

  const monetaNote = formatMonetaLine(event.currencyName, event.exchangeRate)
  const generating = progress != null

  const fileNameFor = (name: string) =>
    `social-prodotto-${fileSlug(stand.name)}-${fileSlug(name)}.png`

  const downloadImage = (image: GeneratedImage) => {
    const anchor = document.createElement('a')
    anchor.href = image.url
    anchor.download = fileNameFor(image.name)
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  const downloadAll = async () => {
    /* I browser scaricano un file per volta e chiedono conferma oltre il
       primo: la pausa evita che le richieste arrivino insieme. */
    for (const image of images) {
      downloadImage(image)
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    }
  }

  const generate = async () => {
    if (chosen.length === 0) return
    setWarning(null)
    setImages([])
    setProgress({ done: 0, total: chosen.length })

    try {
      const qrResponse = await apiRequest<{ qrCode: string }>(
        `/stands/${stand.id}/qrcode?eventId=${event.id}`,
      )
      const qrImage = await loadImage(qrResponse.qrCode)
      const logoSource = stand.logo?.url ?? stand.coverImage?.url ?? ''
      const [standLogo, eventLogo, currencyImage] = await Promise.all([
        logoSource ? loadImage(logoSource, true) : Promise.resolve(null),
        event.logo?.url ? loadImage(event.logo.url, true) : Promise.resolve(null),
        event.currencySymbol?.url ? loadImage(event.currencySymbol.url, true) : Promise.resolve(null),
      ])

      let failed = 0
      for (const [index, product] of chosen.entries()) {
        const canvas = document.createElement('canvas')
        canvas.width = POSTER_WIDTH
        canvas.height = POSTER_HEIGHT
        const ctx = canvas.getContext('2d')
        let url: string | null = null
        if (ctx) {
          const productImage = product.coverImage?.url
            ? await loadImage(product.coverImage.url, true)
            : null
          await generateProductPoster(
            ctx,
            event,
            stand,
            product,
            productImage,
            standLogo,
            eventLogo,
            currencyImage,
            qrImage,
            includePrices,
          )
          url = canvas.toDataURL('image/png')
        }
        if (!url) {
          failed += 1
        } else {
          setImages((prev) => [...prev, { id: product.id, name: product.name, url }])
        }
        setProgress({ done: index + 1, total: chosen.length })
        await yieldToUi()
      }
      if (failed > 0) {
        setWarning(
          `${failed} ${failed === 1 ? 'immagine non è stata generata' : 'immagini non sono state generate'}: il browser non ha reso il canvas.`,
        )
      }
    } catch {
      setWarning('Generazione non riuscita: nessuna immagine prodotta.')
    } finally {
      setProgress(null)
    }
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    /* Le immagini già prodotte erano per una selezione diversa: non vale
       la pena mostrarle accanto a un'altra scelta. */
    setImages([])
  }

  if (!open) return null

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Chiudi">
          &times;
        </button>

        <h2 className={styles.title}>Esporta i prodotti per social</h2>
        <p className={styles.hint}>
          Un&apos;immagine per prodotto, con lo stesso formato del menu dello stand: banda
          dell&apos;evento, logo dello stand, foto e prezzo del prodotto, QR verso il menu.
        </p>

        {products.length === 0 ? (
          <div className={styles.loading}>Questo stand non ha ancora prodotti in menu.</div>
        ) : (
          <>
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

              <span className={styles.counter}>
                {chosen.length} di {products.length} prodotti selezionati
              </span>

              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setSelected(new Set(products.map((p) => p.id)))
                  setImages([])
                }}
                disabled={generating}
              >
                Seleziona tutti
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setSelected(new Set())
                  setImages([])
                }}
                disabled={generating || chosen.length === 0}
              >
                Deseleziona tutti
              </button>
            </div>

            <div className={styles.pickerGrid}>
              {products.map((product) => (
                <label
                  key={product.id}
                  className={`${styles.pickerCard} ${selected.has(product.id) ? styles.pickerCardOn : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    disabled={generating}
                    onChange={() => toggle(product.id)}
                  />
                  {product.coverImage ? (
                    <img src={product.coverImage.url} alt="" className={styles.pickerThumb} />
                  ) : (
                    <span className={styles.pickerThumb} aria-hidden="true">
                      {product.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={styles.pickerName}>{product.name}</span>
                  {product.price > 0 && (
                    <span className={styles.pickerPrice}>{formatCredits(product.price)}</span>
                  )}
                </label>
              ))}
            </div>

            <div className={styles.row}>
              <button
                className={styles.primaryBtn}
                onClick={() => void generate()}
                disabled={generating || chosen.length === 0}
              >
                {generating
                  ? `Generazione ${progress?.done ?? 0} di ${progress?.total ?? 0}...`
                  : `Genera ${chosen.length} ${chosen.length === 1 ? 'immagine' : 'immagini'}`}
              </button>
              {images.length > 1 && (
                <button className={styles.secondaryBtn} onClick={() => void downloadAll()}>
                  Scarica tutte ({images.length})
                </button>
              )}
            </div>

            {warning && <p className={styles.warning}>{warning}</p>}

            {images.length > 1 && (
              <p className={styles.hint}>
                Il browser scarica un file alla volta: se chiede conferma per i download multipli,
                scegli &quot;consenti&quot;.
              </p>
            )}

            {images.length > 0 && (
              <div className={styles.previewGrid}>
                {images.map((image) => (
                  <figure key={image.id} className={styles.preview}>
                    <img src={image.url} alt={`Poster ${image.name}`} className={styles.previewImg} />
                    <figcaption className={styles.previewName}>{image.name}</figcaption>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => downloadImage(image)}
                    >
                      Scarica PNG
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}