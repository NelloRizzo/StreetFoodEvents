import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { fetchBlogCategories, fetchBlogPosts, type BlogCategory, type BlogPost } from '../lib/blog'
import styles from './BlogListPage.module.scss'

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
const PAGE_SIZE = 10

export function BlogListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categorySlug = searchParams.get('category')

  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchBlogCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  const load = useCallback(async () => {
    const data = await fetchBlogPosts({ category: categorySlug, page, limit: PAGE_SIZE })
    return data
  }, [categorySlug, page])

  useEffect(() => {
    setIsLoading(true)
    load()
      .then((data) => {
        setPosts((prev) => (page === 1 ? data.items : [...prev, ...data.items]))
        setHasMore(Boolean(data.hasMore))
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [load, page])

  // Cambiando categoria si riparte dalla prima pagina: altrimenti si
  // concatenerebbero i risultati della categoria precedente.
  useEffect(() => {
    setPage(1)
    setPosts([])
  }, [categorySlug])

  const selectCategory = (slug: string | null) => {
    if (slug) {
      setSearchParams({ category: slug })
    } else {
      setSearchParams({})
    }
  }

  return (
    <main className={styles.page}>
      <div className="page-shell">
        <header className={styles.header}>
          <h1 className={styles.title}>Notizie</h1>
          <p className={styles.subtitle}>Tutte le novita' della piattaforma e degli eventi.</p>
        </header>

        {categories.length > 0 && (
          <div className={styles.filters}>
            <button
              type="button"
              className={`${styles.filterBtn} ${!categorySlug ? styles.active : ''}`}
              onClick={() => selectCategory(null)}
            >
              Tutte
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`${styles.filterBtn} ${categorySlug === category.slug ? styles.active : ''}`}
                onClick={() => selectCategory(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        {isLoading && posts.length === 0 && <p className={styles.empty}>Caricamento...</p>}

        {!isLoading && posts.length === 0 && <p className={styles.empty}>Nessuna notizia pubblicata.</p>}

        <div className={styles.list}>
          {posts.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} className={styles.card}>
              {post.coverImage?.url && (
                <img className={styles.thumb} src={post.coverImage.url} alt="" loading="lazy" />
              )}
              <div className={styles.cardBody}>
                {post.isPinned && <span className={styles.pin}>In evidenza</span>}
                <h2 className={styles.cardTitle}>{post.title}</h2>
                {post.excerpt && <p className={styles.cardExcerpt}>{post.excerpt}</p>}
                <div className={styles.meta}>
                  {post.category && <span>{post.category.name}</span>}
                  {post.publishedAt && <span>{dateFmt.format(new Date(post.publishedAt))}</span>}
                  {post.commentCount > 0 && <span>{post.commentCount} commenti</span>}
                  {post.event?.name && <span className={styles.eventChip}>{post.event.name}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {hasMore && (
          <button type="button" className={styles.loadMore} onClick={() => setPage((p) => p + 1)} disabled={isLoading}>
            {isLoading ? 'Caricamento...' : 'Carica altre notizie'}
          </button>
        )}
      </div>
    </main>
  )
}
