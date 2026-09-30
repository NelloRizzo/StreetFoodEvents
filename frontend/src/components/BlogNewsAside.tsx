import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchHomeBlogPosts, type BlogPost } from '../lib/blog'
import styles from './BlogNewsAside.module.scss'

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })

/* Aside "ultime notizie" della home.
 *
 * L'API (/api/blog/home) restituisce gia' l'insieme finale: le notizie
 * pinnate in testa (dalla piu' recente pin) piu' le ultime 5 pubblicate,
 * senza duplicati. Qui non si ri-ordina nulla per non reintrodurre il
 * doppione che l'API elimina gia'. */
export function BlogNewsAside() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchHomeBlogPosts()
      .then((data) => setPosts(data.items))
      .catch(() => setPosts([]))
      .then(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <aside className={styles.panel} aria-label="Ultime notizie">
        <h2 className={styles.title}>Notizie</h2>
        <p className={styles.empty}>Caricamento...</p>
      </aside>
    )
  }

  if (posts.length === 0) {
    return null
  }

  return (
    <aside className={styles.panel} aria-label="Ultime notizie">
      <h2 className={styles.title}>
        Notizie
        <Link to="/blog" className={styles.allLink}>Vedi tutte</Link>
      </h2>

      <div className={styles.list}>
        {posts.map((post) => (
          <Link key={post.id} to={`/blog/${post.slug}`} className={styles.item}>
            {post.isPinned && <span className={styles.pin}>In evidenza</span>}
            <div className={styles.itemHead}>
              {post.coverImage?.url && (
                <img className={styles.itemThumb} src={post.coverImage.url} alt="" loading="lazy" />
              )}
              <span className={styles.itemTitle}>{post.title}</span>
            </div>
            <span className={styles.itemMeta}>
              {post.publishedAt && <span>{dateFmt.format(new Date(post.publishedAt))}</span>}
              {post.category && <span>{post.category.name}</span>}
              {post.event?.name && <span className={styles.eventChip}>{post.event.name}</span>}
            </span>
          </Link>
        ))}
      </div>
    </aside>
  )
}
