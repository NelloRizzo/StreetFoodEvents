import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { apiRequest } from '../lib/api'
import {
  currencyInitial,
  fileSlug,
  formatCredits,
  formatEventDateRange,
  formatMonetaLine,
  hasStandShortLink,
  isBareCurrencySymbol,
  standQrQuery,
  stripHtml,
  type StandShortLinks,
} from '../lib/socialMenu'
import {
  drawCircleImage,
  drawEventBand,
  drawPhotoBox,
  drawPosterFooter,
  drawPrice,
  fitPhotoBox,
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
import { ShortLinkNotice } from './ShortLinkNotice'
import styles from './SocialExport.module.scss'

const INCLUDE_PRICES_KEY = 'sfe-social-include-prices'
/** Condivisa con l'export del menu: e' la stessa scelta, non due da tenere
 *  allineate (come per i prezzi e per il formato). */
const INCLUDE_DESCRIPTIONS_KEY = 'sfe-social-include-descriptions'

/** Stessa chiave del menu: la scelta "mostra i prezzi" è la stessa
 *  preferenza dell'operatore, non una scelta per ogni export. */
type Props = {
  open: boolean
  event: SocialPosterEvent
  stand: SocialPosterStand
  menuItems: {
    id: string
    product: { name: string; description?: string | null; price: number; coverImage?: UploadedImage | null } | null
    priceOverride: number | null
  }[]
  onClose: () => void
  /** Link brevi dello stand e dell'evento, se esistono. */
  shortLinks?: StandShortLinks
}

type Product = {
  id: string
  name: string
  description?: string | null
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

/** Impaginazione del poster di un singolo prodotto.
 *
 *  Come per il menu: numeri scritti per il formato 4:5, distanze verticali
 *  riscalate da `vScale`. La foto, però, è l'unica parte che *guadagna*
 *  davvero spazio nel formato più alto, perché prende tutto quello che
 *  resta fra il prezzo e il footer. */
function productLayout(m: PosterMetrics) {
  const v = m.vScale
  return {
    logoY: Math.round(250 * v),
    logoD: Math.round(120 * (1 + (v - 1) * 0.6)),
    nameY: Math.round(340 * v),
    nameLh: Math.round(58 * v),
    dividerY: Math.round(430 * v),
    titleY: Math.round(485 * v),
    nameFont: 46,
    descFont: 30,
    descLh: Math.round(38 * v),
  }
}

/** Un poster per prodotto, con la stessa impaginazione del poster del menu:
 *  banda dell'evento, logo e nome dello stand, foto e prezzo del prodotto,
 *  riquadro luogo/data e QR verso il menu.
 *
 *  La foto è l'unica parte che si espande con il formato: prende tutto lo
 *  spazio fra il prezzo e il footer, e si stringe attorno alla foto reale
 *  per non lasciare bande vuote dentro il riquadro. */
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
  format: PosterFormatId,
  includeDescriptions = false,
): Promise<void> {
  const m = posterMetrics(format)
  const W = m.width
  const L = productLayout(m)
  const colors = posterColors(event)
  const currencyName = (event.currencyName ?? '').trim() || '€'
  const bareSymbol = isBareCurrencySymbol(event.currencyName) ? currencyName : null

  ctx.save()
  ctx.fillStyle = colors.surface
  ctx.fillRect(0, 0, W, m.height)

  drawEventBand(ctx, colors, m, eventLogo, event.name)

  // ── Logo e nome dello stand (più piccoli del poster del menu: qui il
  //    prodotto è il protagonista) ──
  drawCircleImage(ctx, standLogo, W / 2, L.logoY, L.logoD, stand.name)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = colors.ink
  ctx.font = '700 38px "Segoe UI", Inter, sans-serif'
  const standNameLines = wrapText(ctx, stand.name, W - 280, 2)
  standNameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, L.nameY + i * L.nameLh)
  })

  ctx.fillStyle = colors.highlight
  ctx.fillRect(250, L.dividerY, W - 500, 5)

  // ── Nome prodotto (max 3 righe) ──
  ctx.fillStyle = colors.ink
  ctx.font = `700 ${L.nameFont}px "Segoe UI", Inter, sans-serif`
  const nameLines = wrapText(ctx, product.name, W - 200, 3)
  nameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, L.titleY + i * L.nameLh)
  })

  let cursor = L.titleY + nameLines.length * L.nameLh + Math.round(20 * m.vScale)

  // ── Prezzo sotto il nome ──
  if (includePrices && product.price > 0) {
    drawPrice(ctx, colors, formatCredits(product.price), W / 2, cursor, {
      align: 'center',
      bareSymbol,
      glyphSize: 40,
      currencyImage,
      currencyInitial: currencyInitial(event.currencyName),
      fontSize: 40,
    })
    cursor += Math.round(74 * m.vScale)
  }

  // ── Descrizione (facoltativa), fra prezzo e foto ──
  /* Sta sotto il prezzo e la foto si stringe di conseguenza: la foto e'
     l'unica parte che si espande con il formato alto, quindi una descrizione
     lunga si vede meglio in 9:16 che in 4:5. */
  if (includeDescriptions && product.description) {
    ctx.fillStyle = colors.inkSoft
    ctx.font = `400 ${L.descFont}px "Segoe UI", Inter, sans-serif`
    /* La descrizione e' HTML (gia' sanitizzato dal server): qui si stacca il
       testo. Quattro righe: oltre, la foto non avrebbe piu' spazio. */
    const descLines = wrapText(ctx, stripHtml(product.description), W - 240, 4)
    descLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, cursor + i * L.descLh)
    })
    cursor += descLines.length * L.descLh + Math.round(16 * m.vScale)
  }

  // ── Foto: si stringe attorno alla foto reale (niente bande vuote dentro)
  //    e arriva fino al footer ──
  const gap = Math.round(26 * m.vScale)
  const area = { x: 100, y: cursor + gap, w: W - 200, h: m.footerY - gap - (cursor + gap) }
  const box = fitPhotoBox(productImage, area)
  drawPhotoBox(ctx, productImage, box.x, box.y, box.w, box.h, 28, product.name)

  drawPosterFooter(ctx, colors, m, {
    locationLabel: (event.location?.city ?? event.location?.label ?? '').trim(),
    dateRange: formatEventDateRange(event.startDate, event.endDate),
    qrImage,
    qrLabel: 'Menu dello stand',
  })

  ctx.restore()
}

/** Esposto solo per lo script di anteprima (`frontend/preview/`), che
 *  disegna il poster su un canvas vero per controllarne l'impaginazione. */
export async function generateProductPosterForPreview(
  ctx: CanvasRenderingContext2D,
  event: SocialPosterEvent,
  stand: SocialPosterStand,
  product: { name: string; description?: string | null; price: number; coverImage?: UploadedImage | null },
  includePrices: boolean,
  format: PosterFormatId,
  includeDescriptions = false,
) {
  const productImage = product.coverImage?.url ? await loadImage(product.coverImage.url, true) : null
  await generateProductPoster(
    ctx,
    event,
    stand,
    {
      id: 'preview',
      name: product.name,
      description: product.description ?? null,
      coverImage: product.coverImage ?? null,
      price: product.price,
    },
    productImage,
    null,
    null,
    null,
    null,
    includePrices,
    format,
    includeDescriptions,
  )
}

export function SocialProductExport({ open, event, stand, menuItems, shortLinks, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [includePrices, setIncludePrices] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INCLUDE_PRICES_KEY) === '1'
    } catch {
      return false
    }
  })
  /* Stessa chiave dell'export del menu: e' la stessa scelta di cosa mettere
     nell'immagine, non due impostazioni da tenere allineate a mano. */
  const [includeDescriptions, setIncludeDescriptions] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INCLUDE_DESCRIPTIONS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  /* Stessa chiave dell'export del menu: il formato non si sceglie due volte. */
  const [format, setFormat] = useSocialFormat()

  /* Le anteprime sono immagini: cambiando formato quelle già generate sono
     del formato vecchio, e mostrarle accanto alla nuova scelta sarebbe
     un invio sbagliato. */
  const changeFormat = (next: PosterFormatId) => {
    setFormat(next)
    setImages([])
  }

  useEffect(() => {
    try {
      localStorage.setItem(INCLUDE_PRICES_KEY, includePrices ? '1' : '0')
    } catch {
      /* localStorage non disponibile */
    }
  }, [includePrices])

  useEffect(() => {
    try {
      localStorage.setItem(INCLUDE_DESCRIPTIONS_KEY, includeDescriptions ? '1' : '0')
    } catch {
      /* localStorage non disponibile */
    }
  }, [includeDescriptions])

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
          description: m.product.description ?? null,
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
        standQrQuery({ eventId: event.id, standId: stand.id, shortLinks }),
      )
      const qrImage = await loadImage(qrResponse.qrCode)
      const logoSource = stand.logo?.url ?? stand.coverImage?.url ?? ''
      const [standLogo, eventLogo, currencyImage] = await Promise.all([
        logoSource ? loadImage(logoSource, true) : Promise.resolve(null),
        event.logo?.url ? loadImage(event.logo.url, true) : Promise.resolve(null),
        event.currencySymbol?.url ? loadImage(event.currencySymbol.url, true) : Promise.resolve(null),
      ])

      let failed = 0
      const m = posterMetrics(format)
      for (const [index, product] of chosen.entries()) {
        const canvas = document.createElement('canvas')
        canvas.width = m.width
        canvas.height = m.height
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
            format,
            includeDescriptions,
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
            <SocialFormatPicker format={format} onChange={changeFormat} />

            {!hasStandShortLink(shortLinks) && <ShortLinkNotice />}

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
                    Va fra il prezzo e la foto: su una descrizione lunga la foto
                    si stringe, quindi in 4:5 resta piu&apos; spazio che in 9:16.
                  </em>
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