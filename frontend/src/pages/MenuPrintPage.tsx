import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { currencyBadgeHtml } from '../components/CurrencyDisplay'
import styles from './MenuPrintPage.module.scss'

type ImageData = { url: string; publicId: string; width: number; height: number; format: string; bytes: number }

type EventRef = { id: string; name: string; currencyName: string; logo: ImageData | null; coverImage: ImageData | null }

type Stand = {
  id: string
  name: string
  slogan: string | null
  description: string | null
  coverImage: ImageData | null
  gallery: ImageData[]
  eventIds: string[]
}

type ProductInfo = {
  id: string
  name: string
  description: string | null
  price: number
  ingredients: string[]
  allergens: string[]
  isFrozen: boolean
  coverImage: ImageData | null
  gallery: ImageData[]
}

type EventProductItem = {
  id: string
  productId: string
  product: ProductInfo
  priceOverride: number | null
  available: boolean
  stationIds: string[]
}

type MenuProduct = {
  standId: string
  standName: string
  standNumber: number | null
  name: string
  description: string | null
  price: number
  ingredients: string[]
  allergens: string[]
  isFrozen: boolean
  coverImage: ImageData | null
  categoryIds: string[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function imgHtml(img: ImageData | null, alt: string): string {
  if (!img) return ''
  return `<img src="${esc(img.url)}" alt="${esc(alt)}" style="display:block;width:100%;height:auto;border-radius:8px;object-fit:cover" />`
}

function buildMenuHtml(
  event: EventRef,
  stands: { stand: Stand; products: EventProductItem[] }[]
): string {
  const eventLogo = event.logo
    ? `<img src="${esc(event.logo.url)}" alt="${esc(event.name)}" style="display:block;max-height:80px;margin:0 auto 0.5rem" />`
    : ''
  const priceBadge = currencyBadgeHtml(event.currencyName || '€')

  const standsHtml = stands.map(({ stand, products }, i) => {
    const cover = stand.coverImage
      ? `<div style="max-width:100%;margin-bottom:1.5rem;text-align:center;overflow:hidden;border-radius:12px">
          <img src="${esc(stand.coverImage.url)}" alt="${esc(stand.name)}" style="display:block;margin:0 auto;width:auto;max-width:100%;height:auto;max-height:70mm;object-fit:contain;border-radius:12px" />
        </div>`
      : ''

    const slogan = stand.slogan
      ? `<p style="font-size:0.85rem;color:#587065;margin:0.25rem 0 0;font-style:italic">${esc(stand.slogan)}</p>`
      : ''

    const description = stand.description
      ? `<div style="font-size:0.95rem;color:#264137;line-height:1.6;margin-top:1.25rem">${stand.description}</div>`
      : ''

    const productsHtml = products.length > 0
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;margin-top:1.5rem">
          ${products.map((ep) => {
            const price = ep.priceOverride ?? ep.product.price
            const prodCover = ep.product.coverImage
              ? `<div style="border-radius:8px;overflow:hidden;margin-bottom:0.6rem">${imgHtml(ep.product.coverImage, ep.product.name)}</div>`
              : ''
            const ingredients = ep.product.ingredients.length > 0
              ? `<p style="font-size:0.78rem;color:#587065;margin:0.25rem 0 0;line-height:1.4">${esc(ep.product.ingredients.join(', '))}</p>`
              : ''
            const allergens = ep.product.allergens.length > 0
              ? `<p style="font-size:0.75rem;color:#c0392b;margin:0.15rem 0 0;font-weight:600">Allergeni: ${esc(ep.product.allergens.join(', '))}</p>`
              : ''
            const frozenBadge = ep.product.isFrozen
              ? '<span style="color:#2980b9;font-weight:900;margin-left:0.25rem">*</span>'
              : ''
            const desc = ep.product.description
              ? `<p style="font-size:0.8rem;color:#587065;margin:0.15rem 0 0;font-style:italic">${esc(ep.product.description)}</p>`
              : ''
            return `<div style="border:1px solid #ddd;border-radius:12px;padding:0.75rem;background:#fff;break-inside:avoid">
              ${prodCover}
              <h3 style="font-size:1rem;margin:0 0 0.2rem;color:#14261f">${esc(ep.product.name)}${frozenBadge}</h3>
              ${desc}
              ${ingredients}
              ${allergens}
              <p style="font-size:1.05rem;font-weight:700;color:#bf5a2a;margin:0.4rem 0 0">${price.toFixed(2)} ${priceBadge}</p>
            </div>`
          }).join('')}
        </div>`
      : '<p style="color:#587065;font-size:0.9rem;font-style:italic;margin-top:1rem">Nessun prodotto disponibile per questo stand.</p>'

    const galleryHtml = stand.gallery && stand.gallery.length > 0
      ? `<div style="margin-top:2rem">
          <h3 style="font-size:1.15rem;color:#14261f;margin:0 0 0.75rem;border-bottom:2px solid rgba(191,90,42,0.15);padding-bottom:0.4rem">Galleria</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.75rem">
            ${stand.gallery.map((img) => imgHtml(img, `${stand.name} — galleria`)).join('')}
          </div>
        </div>`
      : ''

    const pageBreak = i > 0 ? 'page-break-before:always;' : ''

    return `<div style="${pageBreak}padding:2rem 2.5rem">
      <div style="text-align:center;margin-bottom:1.5rem">
        <h2 style="font-size:1.8rem;color:#14261f;margin:0">${esc(stand.name)}</h2>
        ${slogan}
      </div>
      ${cover}
      ${description}
      ${productsHtml}
      ${galleryHtml}
    </div>`
  }).join('')

  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Menu — ${esc(event.name)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-family:'Segoe UI','Inter','Helvetica Neue',Arial,sans-serif;font-size:13px;color:#264137;background:#f5f0eb}
body{background:#fffaf2;max-width:100%}
@media print{@page{size:A3 landscape;margin:1cm}A3 landscape;margin:1cm}}
@media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media print{.no-print{display:none!important}}
.header{text-align:center;padding:1.5rem 2rem;border-bottom:2px solid rgba(191,90,42,0.15);margin-bottom:0.5rem}
.header h1{font-size:2.5rem;color:#14261f;margin:0}
.header p{font-size:0.9rem;color:#587065;margin:0.2rem 0 0}
</style></head><body>
<div class="header no-print" style="text-align:center;padding:1rem 2rem;border-bottom:2px solid rgba(191,90,42,0.15)">
  <a href="#" onclick="window.print();return false" style="display:inline-block;padding:0.6rem 1.4rem;border:2px solid #bf5a2a;border-radius:999px;color:#bf5a2a;font-weight:700;text-decoration:none;font-size:0.9rem;margin-bottom:0.5rem">Stampa menu</a>
  <h1 style="font-size:1.2rem;color:#14261f;margin:0">${esc(event.name)} &mdash; Menu stand</h1>
</div>
<div class="header" style="text-align:center;padding:1.5rem 2rem;border-bottom:2px solid rgba(191,90,42,0.15)">
  ${eventLogo}
  <h1 style="font-size:2.5rem;color:#14261f;margin:0">${esc(event.name)}</h1>
  <p style="font-size:0.9rem;color:#587065;margin:0.2rem 0 0">Menu stand</p>
</div>
${standsHtml}
</body></html>`
}

function categoryMenuFullHtml(
  event: EventRef,
  categories: string[],
  products: MenuProduct[]
): string {
  const eventLogo = event.logo
    ? `<img src="${esc(event.logo.url)}" alt="${esc(event.name)}" style="display:block;max-height:80px;margin:0 auto 0.5rem" />`
    : ''
  const priceBadge = currencyBadgeHtml(event.currencyName || '€')
  const defaultCat = 'Senza categoria'
  const label = (c: string) => (c === defaultCat ? 'Altri Prodotti' : c)

  const byCategory: Record<string, MenuProduct[]> = {}
  const categorySet = new Set(categories)
  for (const c of [defaultCat, ...categories]) {
    byCategory[c] = []
  }
  for (const p of products) {
    const cats = p.categoryIds.filter((c) => categorySet.has(c))
    if (cats.length > 0) {
      for (const c of cats) if (byCategory[c]) byCategory[c].push(p)
    } else {
      byCategory[defaultCat].push(p)
    }
  }

  const sections = Object.keys(byCategory)
    .map((cat) => ({ cat, items: byCategory[cat] }))
    .filter((s) => s.items.length > 0)

  const sectionsHtml = sections.map(({ cat, items }) => {
    const allergenBadge = '*'
    const cards = items.map((p) => {
      const prodCover = p.coverImage
        ? `<div style="border-radius:8px;overflow:hidden;margin-bottom:0.6rem">${imgHtml(p.coverImage, p.name)}</div>`
        : ''
      const ingredients = p.ingredients.length > 0
        ? `<p style="font-size:0.78rem;color:#587065;margin:0.25rem 0 0;line-height:1.4">${esc(p.ingredients.join(', '))}</p>`
        : ''
      const allergens = p.allergens.length > 0
        ? `<p style="font-size:0.75rem;color:#c0392b;margin:0.15rem 0 0;font-weight:600">Allergeni: ${esc(p.allergens.join(', '))}</p>`
        : ''
      const frozen = p.isFrozen
        ? `<span style="color:#2980b9;font-weight:900;margin-left:0.25rem">${allergenBadge}</span>`
        : ''
      const desc = p.description
        ? `<p style="font-size:0.8rem;color:#587065;margin:0.15rem 0 0;font-style:italic">${esc(p.description)}</p>`
        : ''
      const standLabel = p.standNumber != null ? `#${p.standNumber} ${p.standName}` : p.standName
      return `<div style="border:1px solid #ddd;border-radius:12px;padding:0.75rem;background:#fff;break-inside:avoid">
        ${prodCover}
        <p style="font-size:0.72rem;font-weight:700;color:#bf5a2a;text-transform:uppercase;letter-spacing:0.03em;margin:0 0 0.2rem">${esc(standLabel)}</p>
        <h3 style="font-size:1rem;margin:0 0 0.2rem;color:#14261f">${esc(p.name)}${frozen}</h3>
        ${desc}
        ${ingredients}
        ${allergens}
        <p style="font-size:1.05rem;font-weight:700;color:#bf5a2a;margin:0.4rem 0 0">${p.price.toFixed(2)} ${priceBadge}</p>
      </div>`
    }).join('')
    return `<section style="page-break-before:always;padding:2rem 2.5rem">
      <h2 style="font-size:1.7rem;color:#14261f;margin:0 0 0.5rem;border-bottom:2px solid rgba(191,90,42,0.2);padding-bottom:0.4rem">${esc(label(cat))}</h2>
      <p style="font-size:0.8rem;color:#587065;margin:0 0 1rem">${items.length} prodotto${items.length === 1 ? '' : 'i'} · ${esc(event.name)}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem">
        ${cards}
      </div>
    </section>`
  }).join('')

  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Menu — ${esc(event.name)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-family:'Segoe UI','Inter','Helvetica Neue',Arial,sans-serif;font-size:13px;color:#264137;background:#f5f0eb}
body{background:#fffaf2;max-width:100%}
@media print{@page{size:A3 landscape;margin:1cm}A3 landscape;margin:1cm}}
@media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media print{.no-print{display:none!important}}
.header{text-align:center;padding:1.5rem 2rem;border-bottom:2px solid rgba(191,90,42,0.15);margin-bottom:0.5rem}
.header h1{font-size:2.5rem;color:#14261f;margin:0}
.header p{font-size:0.9rem;color:#587065;margin:0.2rem 0 0}
</style></head><body>
<div class="header no-print" style="text-align:center;padding:1rem 2rem;border-bottom:2px solid rgba(191,90,42,0.15)">
  <a href="#" onclick="window.print();return false" style="display:inline-block;padding:0.6rem 1.4rem;border:2px solid #bf5a2a;border-radius:999px;color:#bf5a2a;font-weight:700;text-decoration:none;font-size:0.9rem;margin-bottom:0.5rem">Stampa menu</a>
  <h1 style="font-size:1.2rem;color:#14261f;margin:0">${esc(event.name)} &mdash; Menu per categoria</h1>
</div>
<div class="header" style="text-align:center;padding:1.5rem 2rem;border-bottom:2px solid rgba(191,90,42,0.15)">
  ${eventLogo}
  <h1 style="font-size:2.5rem;color:#14261f;margin:0">${esc(event.name)}</h1>
  <p style="font-size:0.9rem;color:#587065;margin:0.2rem 0 0">Menu per categoria</p>
</div>
${sectionsHtml}
</body></html>`
}

export function MenuPrintPage() {
  const [events, setEvents] = useState<EventRef[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [stands, setStands] = useState<Stand[]>([])
  const [selectedStandIds, setSelectedStandIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [printMode, setPrintMode] = useState<'stand' | 'category'>('stand')

  useEffect(() => {
    apiRequest<{ items: EventRef[] }>('/events')
      .then((data) => setEvents(data.items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedEventId) {
      setStands([])
      setSelectedStandIds(new Set())
      return
    }
    setLoading(true)
    apiRequest<{ items: Stand[] }>(`/stands?eventId=${selectedEventId}`)
      .then((data) => {
        setStands(data.items)
        setSelectedStandIds(new Set())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedEventId])

  function toggleStand(id: string) {
    setSelectedStandIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedStandIds(new Set(stands.map((s) => s.id)))
  }

  function deselectAll() {
    setSelectedStandIds(new Set())
  }

  async function loadProducts(standId: string): Promise<EventProductItem[]> {
    const data = await apiRequest<{ items: EventProductItem[] }>(
      `/event-products?eventId=${selectedEventId}&standId=${standId}`
    )
    return data.items.filter((ep) => ep.available && ep.product)
  }

  async function handlePrint() {
    if (selectedStandIds.size === 0) return
    setGenerating(true)
    try {
      const event = events.find((e) => e.id === selectedEventId)
      if (!event) return

      if (printMode === 'category') {
        const data = await apiRequest<{
          categories: string[]
          items: MenuProduct[]
        }>(`/events/${selectedEventId}/menu`)
        const products = data.items.filter((p) => selectedStandIds.has(p.standId))
        const html = categoryMenuFullHtml(event, data.categories, products)
        const w = window.open('', '_blank', 'width=900,height=800')
        if (w) {
          w.document.write(html)
          w.document.close()
        }
        return
      }

      const selectedStands = stands.filter((s) => selectedStandIds.has(s.id))
      const results = await Promise.all(
        selectedStands.map(async (stand) => {
          const products = await loadProducts(stand.id)
          return { stand, products }
        })
      )

      const html = buildMenuHtml(event, results)
      const w = window.open('', '_blank', 'width=900,height=800')
      if (w) {
        w.document.write(html)
        w.document.close()
      }
    } catch { /* ignore */ } finally {
      setGenerating(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Stampa menu</h1>

      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.label}>Evento</span>
          <select
            className={styles.select}
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">— Seleziona evento —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </label>

        {selectedEventId && (
          <>
            <div className={styles.modeSwitch}>
              <button
                type="button"
                className={`${styles.modeBtn} ${printMode === 'stand' ? styles.modeActive : ''}`}
                onClick={() => setPrintMode('stand')}
              >
                Per stand
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${printMode === 'category' ? styles.modeActive : ''}`}
                onClick={() => setPrintMode('category')}
              >
                Per categoria
              </button>
            </div>

            <div className={styles.standActions}>
              <span className={styles.label}>Stand ({stands.length})</span>
              <button type="button" className={styles.smallBtn} onClick={selectAll}>Seleziona tutti</button>
              <button type="button" className={styles.smallBtn} onClick={deselectAll}>Deseleziona tutti</button>
            </div>

            {loading ? (
              <p className={styles.loading}>Caricamento stand...</p>
            ) : stands.length === 0 ? (
              <p className={styles.empty}>Nessuno stand associato a questo evento.</p>
            ) : (
              <div className={styles.standList}>
                {stands.map((stand) => (
                  <label key={stand.id} className={styles.standRow}>
                    <input
                      type="checkbox"
                      checked={selectedStandIds.has(stand.id)}
                      onChange={() => toggleStand(stand.id)}
                    />
                    <span className={styles.standName}>{stand.name}</span>
                    {stand.slogan && <span className={styles.standSlogan}>{stand.slogan}</span>}
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              className={styles.printBtn}
              disabled={selectedStandIds.size === 0 || generating}
              onClick={handlePrint}
            >
              {generating ? 'Generazione...' : `Stampa menu (${selectedStandIds.size} stand)`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
