import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchFavorites, deleteFavorite, type FavoriteItem } from '../lib/favorites'
import styles from './FavoritesPage.module.scss'

export function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = async () => {
    const data = await fetchFavorites()
    setItems(data.items)
    setIsLoading(false)
  }

  useEffect(() => { void load() }, [])

  const handleRemove = async (favId: string) => {
    await deleteFavorite(favId)
    setItems((prev) => prev.filter((i) => i.id !== favId))
  }

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <span className="eyebrow">Preferiti</span>
          <h1 className={styles.title}>I tuoi preferiti</h1>
        </div>

        <div className={styles.list}>
          {items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardBody}>
                {item.stand && (
                  <>
                    <strong className={styles.cardName}>{item.stand.name}</strong>
                    {item.stand.slogan && <span className={styles.cardSlogan}>{item.stand.slogan}</span>}
                    <span className={styles.cardTag}>Stand</span>
                  </>
                )}
                {item.event && (
                  <>
                    <strong className={styles.cardName}>{item.event.name}</strong>
                    <span className={styles.cardTag}>Evento</span>
                  </>
                )}
              </div>
              <div className={styles.cardActions}>
                {item.stand && (
                  <Link className={styles.textBtn} to={`/stands/${item.stand.id}`}>
                    Vedi stand
                  </Link>
                )}
                {item.event && (
                  <Link className={styles.textBtn} to={`/events/${item.event.id}`}>
                    Vedi evento
                  </Link>
                )}
                <button className={styles.dangerBtn} onClick={() => handleRemove(item.id)}>
                  Rimuovi
                </button>
              </div>
            </article>
          ))}

          {items.length === 0 && (
            <p className={styles.empty}>Nessun preferito. Aggiungi stand o eventi ai preferiti.</p>
          )}
        </div>
      </div>
    </div>
  )
}
