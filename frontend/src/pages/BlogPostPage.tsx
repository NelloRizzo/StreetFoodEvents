import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { createBlogComment, fetchBlogComments, fetchBlogPost, type BlogComment, type BlogPost } from '../lib/blog'
import styles from './BlogPostPage.module.scss'

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const { isAuthenticated } = useAuth()

  const [post, setPost] = useState<BlogPost | null>(null)
  const [comments, setComments] = useState<BlogComment[]>([])
  const [body, setBody] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!slug) return
    const [detail, list] = await Promise.all([fetchBlogPost(slug), fetchBlogComments(slug)])
    setPost(detail)
    setComments(list)
  }, [slug])

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    load()
      .catch(() => {
        setError('Impossibile caricare la notizia')
        setIsLoading(false)
      })
      .then(() => setIsLoading(false))
  }, [load])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!slug) return
    const text = body.trim()
    if (!text) return

    setIsSending(true)
    setError(null)
    setNotice(null)
    try {
      const created = await createBlogComment(slug, text)
      setComments((prev) => [...prev, created])
      setBody('')
      setNotice('Commento pubblicato.')
    } catch {
      setError('Impossibile pubblicare il commento. Riprova.')
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <main className={styles.page}>
        <div className="page-shell">
          <p className={styles.empty}>Caricamento...</p>
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className={styles.page}>
        <div className="page-shell">
          <p className={styles.empty}>{error ?? 'Notizia non trovata.'}</p>
          <Link to="/blog" className="back-link">Torna al blog</Link>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className="page-shell">
        <article className={styles.article}>
          <Link to="/blog" className="back-link">← Tutte le notizie</Link>

          {post.category && (
            <span className={styles.category}>{post.category.name}</span>
          )}

          <h1 className={styles.title}>{post.title}</h1>

          <div className={styles.meta}>
            {post.publishedAt && <span>{dateFmt.format(new Date(post.publishedAt))}</span>}
            {post.author && <span>di {post.author.name}</span>}
            <span>{post.viewCount} visualizzazioni</span>
            {post.event && (
              <Link to={`/events/${post.event.id}`} className={styles.eventLink}>
                {(post.event.logo ?? post.event.coverImage)?.url && (
                  <img src={(post.event.logo ?? post.event.coverImage)!.url} alt="" />
                )}
                {post.event.name}
              </Link>
            )}
          </div>

          {post.coverImage?.url && (
            <img className={styles.cover} src={post.coverImage.url} alt={post.title} />
          )}

          {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}

          {/* HTML sanificato dal backend: ogni <a> ha gia' target="_blank". */}
          <div className={styles.content} dangerouslySetInnerHTML={{ __html: post.contentHtml ?? '' }} />

          <section className={styles.comments}>
            <h2 className={styles.commentsTitle}>
              Commenti ({comments.length})
            </h2>

            {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
            {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

            {isAuthenticated ? (
              <form className={styles.commentForm} onSubmit={handleSubmit}>
                <textarea
                  className={styles.textarea}
                  value={body}
                  maxLength={2000}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Scrivi un commento..."
                />
                <button type="submit" className={styles.submit} disabled={isSending || !body.trim()}>
                  {isSending ? 'Invio...' : 'Pubblica commento'}
                </button>
              </form>
            ) : (
              <p className={styles.loginHint}>
                <Link to="/login">Accedi</Link> per commentare questa notizia.
              </p>
            )}

            {comments.length === 0 ? (
              <p className={styles.empty}>Ancora nessun commento.</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className={styles.comment}>
                  <div className={styles.commentHead}>
                    <strong>{comment.authorName}</strong>
                    <span>{dateFmt.format(new Date(comment.createdAt))}</span>
                  </div>
                  <div className={styles.commentBody}>{comment.body}</div>
                </div>
              ))
            )}
          </section>
        </article>
      </div>
    </main>
  )
}
