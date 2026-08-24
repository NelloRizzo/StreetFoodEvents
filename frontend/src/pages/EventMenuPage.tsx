import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import type { UploadedImage } from '../lib/upload'
import styles from './EventMenuPage.module.scss'

type MenuItem = {
  standId: string
  standName: string
  standNumber: number | null
  eventProductId: string
  name: string
  price: number
  ingredients: string[]
  categoryId: string | null
}

type MenuResponse = {
  event: {
    id: string
    name: string
    currencyName: string
    currencySymbol: UploadedImage | null
    exchangeRate: number
  }
  categories: string[]
  items: MenuItem[]
  byCategory: Record<string, MenuItem[]>
}

const UNCATEGORIZED = 'Senza categoria'

type ViewMode = 'stands' | 'categories'

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
}

export function EventMenuPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [data, setData] = useState<MenuResponse | null>(null)
  const [view, setView] = useState<ViewMode>('stands')

  useEffect(() => {
    if (!eventId) return
    apiRequest<MenuResponse>(`/events/${eventId}/menu`)
      .then(setData)
      .catch(() => { /* not required */ })
  }, [eventId])

  const standGroups = useMemo(() => {
    if (!data) return []
    const map = new Map<string, { standId: string; standName: string; standNumber: number | null; products: MenuItem[] }>()
    for (const item of [...data.items].sort(byName)) {
      const existing = map.get(item.standId)
      if (existing) {
        existing.products.push(item)
      } else {
        map.set(item.standId, {
          standId: item.standId,
          standName: item.standName || 'Stand',
          standNumber: item.standNumber,
          products: [item],
        })
      }
    }
    return [...map.values()].sort((a, b) => a.standName.localeCompare(b.standName, 'it', { sensitivity: 'base' }))
  }, [data])

  const categoryGroups = useMemo(() => {
    if (!data) return []
    const entries = Object.entries(data.byCategory)
      .filter(([, products]) => products.length > 0)
      .map(([label, products]) => ({ label, products: [...products].sort(byName) }))

    const named = entries
      .filter((e) => e.label !== UNCATEGORIZED)
      .sort((a, b) => a.label.localeCompare(b.label, 'it', { sensitivity: 'base' }))
    const uncategorized = entries.filter((e) => e.label === UNCATEGORIZED)

    return [...named, ...uncategorized]
  }, [data])

  if (!data) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <header className={styles.header}>
          <span className="eyebrow">Menù</span>
          <h1 className={styles.title}>{data.event.name}</h1>
          <div className={styles.currencyRow}>
            <CurrencyDisplay
              currencyName={data.event.currencyName}
              currencySymbol={data.event.currencySymbol}
            />
            <span className={styles.currencyName}>{data.event.currencyName}</span>
          </div>
        </header>

        <div className={styles.toggleRow} role="tablist" aria-label="Visualizzazione menu">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'stands'}
            className={`${styles.toggleBtn} ${view === 'stands' ? styles.toggleActive : ''}`}
            onClick={() => setView('stands')}
          >
            Per stand
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'categories'}
            className={`${styles.toggleBtn} ${view === 'categories' ? styles.toggleActive : ''}`}
            onClick={() => setView('categories')}
          >
            Per categoria
          </button>
        </div>

        {view === 'stands' && (
          <div className={styles.sections}>
            {standGroups.length === 0 && (
              <p className={styles.empty}>Il menù sarà disponibile a breve.</p>
            )}
            {standGroups.map((group) => (
              <section key={group.standId} className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  {group.standNumber !== null && (
                    <span className={styles.standNumber}>{group.standNumber}</span>
                  )}
                  <Link to={`/events/${eventId}/stands/${group.standId}`} className={styles.standLink}>
                    {group.standName}
                  </Link>
                </h2>
                <ul className={styles.productList}>
                  {group.products.map((product) => (
                    <li key={product.eventProductId} className={styles.productRow}>
                      <span className={styles.productName}>{product.name}</span>
                      {product.ingredients.length > 0 && (
                        <span className={styles.productIngredients}>{product.ingredients.join(', ')}</span>
                      )}
                      {product.price > 0 && (
                        <span className={styles.productPrice}>{product.price.toFixed(2)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {view === 'categories' && (
          <div className={styles.sections}>
            {categoryGroups.length === 0 && (
              <p className={styles.empty}>Il menù sarà disponibile a breve.</p>
            )}
            {categoryGroups.map((group) => (
              <section key={group.label} className={styles.section}>
                <h2 className={styles.sectionTitle}>{group.label}</h2>
                <ul className={styles.productList}>
                  {group.products.map((product) => (
                    <li key={`${group.label}-${product.standId}-${product.name}`} className={styles.productRow}>
                      <span className={styles.productName}>{product.name}</span>
                      <span className={styles.productStand}>{product.standName}</span>
                      {product.price > 0 && (
                        <span className={styles.productPrice}>{product.price.toFixed(2)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
