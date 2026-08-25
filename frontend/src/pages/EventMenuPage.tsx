import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import type { UploadedImage } from '../lib/upload'
import styles from './EventStandMenuPage.module.scss'

type MenuItem = {
  standId: string
  standName: string
  standNumber: number | null
  standCoverImage: UploadedImage | null
  standLogo: UploadedImage | null
  eventProductId: string
  name: string
  description: string | null
  price: number
  ingredients: string[]
  allergens: string[]
  isFrozen: boolean
  coverImage: UploadedImage | null
  categoryIds: string[]
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

type ProductModal = {
  name: string
  description: string | null
  ingredients: string[]
  allergens: string[]
  isFrozen: boolean
  price: number
  coverImage: UploadedImage | null
  standName: string
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
  const [selectedItem, setSelectedItem] = useState<ProductModal | null>(null)

  useEffect(() => {
    if (!eventId) return
    apiRequest<MenuResponse>(`/events/${eventId}/menu`)
      .then(setData)
      .catch(() => { /* not required */ })
  }, [eventId])

  useEffect(() => {
    if (!selectedItem) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedItem(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedItem])

  const standGroups = useMemo(() => {
    if (!data) return []
    const map = new Map<string, {
      standId: string
      standName: string
      standNumber: number | null
      logo: UploadedImage | null
      products: MenuItem[]
    }>()
    for (const item of [...data.items].sort(byName)) {
      const existing = map.get(item.standId)
      if (existing) {
        existing.products.push(item)
      } else {
        map.set(item.standId, {
          standId: item.standId,
          standName: item.standName || 'Stand',
          standNumber: item.standNumber,
          logo: item.standLogo ?? item.standCoverImage,
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
          <div className={styles.headerLeft}>
            <div>
              <span className="eyebrow">Menù dell&apos;evento</span>
              <h1 className={styles.title}>{data.event.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <CurrencyDisplay
                  currencyName={data.event.currencyName}
                  currencySymbol={data.event.currencySymbol}
                />
                <span style={{ color: 'var(--color-ink-soft)', fontSize: '0.9rem' }}>{data.event.currencyName}</span>
              </div>
            </div>
          </div>
        </header>

        <div className={styles.standBarWrap}>
          <span className={styles.standBarLabel}>Visualizzazione:</span>
          <nav className={styles.standBar} role="tablist" aria-label="Visualizzazione menù">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'stands'}
              className={`${styles.standChip} ${view === 'stands' ? styles.standChipActive : ''}`}
              onClick={() => setView('stands')}
            >
              Per stand
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'categories'}
              className={`${styles.standChip} ${view === 'categories' ? styles.standChipActive : ''}`}
              onClick={() => setView('categories')}
            >
              Per categorie
            </button>
          </nav>
        </div>

        {view === 'stands' && (
          <div className={styles.layout}>
            <div className={styles.left}>
              {standGroups.length === 0 && (
                <p className={styles.empty}>Il menù sarà disponibile a breve.</p>
              )}
              {standGroups.map((group) => (
                <section key={group.standId} className={styles.menuSection}>
                  <h2 className={styles.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {group.logo && (
                      <img src={group.logo.url} alt="" className={styles.standChipImg} />
                    )}
                    {group.standNumber !== null && (
                      <span className={styles.standChipNum}>{group.standNumber}</span>
                    )}
                    <Link to={`/events/${eventId}/stands/${group.standId}`}>
                      {group.standName}
                    </Link>
                  </h2>
                  <div className={styles.menuList}>
                    {group.products.map((product) => (
                      <div
                        key={product.eventProductId}
                        className={styles.menuCard}
                        onClick={() => setSelectedItem({
                          name: product.name,
                          description: product.description,
                          ingredients: product.ingredients,
                          allergens: product.allergens,
                          isFrozen: product.isFrozen,
                          price: product.price,
                          coverImage: product.coverImage,
                          standName: group.standName,
                        })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedItem({
                              name: product.name,
                              description: product.description,
                              ingredients: product.ingredients,
                              allergens: product.allergens,
                              isFrozen: product.isFrozen,
                              price: product.price,
                              coverImage: product.coverImage,
                              standName: group.standName,
                            })
                          }
                        }}
                      >
                        {product.coverImage ? (
                          <img src={product.coverImage.url} alt={product.name} className={styles.thumb} />
                        ) : (
                          <span className={styles.thumbPlaceholder}>
                            {product.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className={styles.menuInfo}>
                          <strong className={styles.menuName}>{product.name}</strong>
                          {product.ingredients.length > 0 && (
                            <span className={styles.menuIngredients}>{product.ingredients.join(', ')}</span>
                          )}
                        </div>
                        <div className={styles.menuRight}>
                          {product.price > 0 && (
                            <span className={styles.menuPrice}>
                              {product.price.toFixed(2)}
                              <CurrencyDisplay
                                currencyName={data.event.currencyName}
                                currencySymbol={data.event.currencySymbol}
                              />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {view === 'categories' && (
          <div className={styles.layout}>
            <div className={styles.left}>
              {categoryGroups.length === 0 && (
                <p className={styles.empty}>Il menù sarà disponibile a breve.</p>
              )}
              {categoryGroups.map((group) => (
                <section key={group.label} className={styles.menuSection}>
                  <h2 className={styles.sectionTitle}>{group.label}</h2>
                  <div className={styles.menuList}>
                    {group.products.map((product) => (
                      <div
                        key={`${group.label}-${product.standId}-${product.eventProductId}`}
                        className={styles.menuCard}
                        onClick={() => setSelectedItem({
                          name: product.name,
                          description: product.description,
                          ingredients: product.ingredients,
                          allergens: product.allergens,
                          isFrozen: product.isFrozen,
                          price: product.price,
                          coverImage: product.coverImage,
                          standName: product.standName,
                        })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedItem({
                              name: product.name,
                              description: product.description,
                              ingredients: product.ingredients,
                              allergens: product.allergens,
                              isFrozen: product.isFrozen,
                              price: product.price,
                              coverImage: product.coverImage,
                              standName: product.standName,
                            })
                          }
                        }}
                      >
                        {product.coverImage ? (
                          <img src={product.coverImage.url} alt={product.name} className={styles.thumb} />
                        ) : (
                          <span className={styles.thumbPlaceholder}>
                            {product.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className={styles.menuInfo}>
                          <strong className={styles.menuName}>{product.name}</strong>
                          {product.ingredients.length > 0 && (
                            <span className={styles.menuIngredients}>{product.ingredients.join(', ')}</span>
                          )}
                        </div>
                        <div className={styles.menuRight}>
                          <span className={styles.menuIngredients}>Stand: {product.standName}</span>
                          {product.price > 0 && (
                            <span className={styles.menuPrice}>
                              {product.price.toFixed(2)}
                              <CurrencyDisplay
                                currencyName={data.event.currencyName}
                                currencySymbol={data.event.currencySymbol}
                              />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedItem && (
        <div className={styles.overlay} onClick={() => setSelectedItem(null)}>
          <div
            className={styles.productModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={selectedItem.name}
          >
            {selectedItem.coverImage ? (
              <img src={selectedItem.coverImage.url} alt={selectedItem.name} className={styles.productImage} />
            ) : (
              <div className={styles.productImagePlaceholder}>
                {selectedItem.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={styles.productInfo}>
              <h2 className={styles.productName}>
                {selectedItem.name}
                {selectedItem.isFrozen && <span className={styles.frozenBadge}> *</span>}
              </h2>
              <p className={styles.productIngredients}>Stand: {selectedItem.standName}</p>
              {selectedItem.description && (
                <p className={styles.productIngredients}>{selectedItem.description}</p>
              )}
              {selectedItem.ingredients.length > 0 && (
                <p className={styles.productIngredients}><strong>Ingredienti:</strong> {selectedItem.ingredients.join(', ')}</p>
              )}
              {selectedItem.allergens.length > 0 && (
                <p className={styles.productAllergens}><strong>Allergeni:</strong> {selectedItem.allergens.join(', ')}</p>
              )}
              {selectedItem.price > 0 && (
                <span className={styles.productPrice}>
                  {selectedItem.price.toFixed(2)}
                  <CurrencyDisplay
                    currencyName={data.event.currencyName}
                    currencySymbol={data.event.currencySymbol}
                  />
                </span>
              )}
              <p className={styles.photoDisclaimer}>La foto è solo indicativa. Il prodotto potrebbe differire da quanto mostrato.</p>
            </div>
            <div className={styles.productActions}>
              <button className={styles.modalCloseBtn} onClick={() => setSelectedItem(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
