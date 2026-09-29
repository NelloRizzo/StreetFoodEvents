import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ConfirmModal } from '../components/ConfirmModal'
import { useBlogRoleAccess } from '../features/blog/use-blog-role'
import {
  deleteBlogComment,
  deleteBlogPost,
  fetchManageBlogCategories,
  fetchManageBlogComments,
  fetchManageBlogPosts,
  setBlogCommentStatus,
  updateBlogPost,
  type BlogCategory,
  type BlogComment,
  type BlogPost,
} from '../lib/blog'
import styles from './BlogManagePage.module.scss'

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

type Tab = 'posts' | 'comments'

export function BlogManagePage() {
  const { canWrite, canManage, isLoading: isRoleLoading } = useBlogRoleAccess()
  const [tab, setTab] = useState<Tab>('posts')

  const [posts, setPosts] = useState<BlogPost[]>([])
  const [comments, setComments] = useState<BlogComment[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BlogPost | null>(null)

  const loadPosts = useCallback(async () => {
    const data = await fetchManageBlogPosts({
      status: statusFilter || undefined,
      category: categoryFilter || null,
      search: search || null,
    })
    setPosts(data.items)
  }, [statusFilter, categoryFilter, search])

  useEffect(() => {
    if (!canWrite) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    Promise.all([loadPosts(), fetchManageBlogCategories().then(setCategories)])
      .catch(() => setError('Impossibile caricare le notizie'))
      .then(() => setIsLoading(false))
  }, [canWrite, loadPosts])

  const loadComments = useCallback(async () => {
    setComments(await fetchManageBlogComments({ status: 'visible' }))
  }, [])

  useEffect(() => {
    if (tab === 'comments' && canManage) {
      loadComments().catch(() => setError('Impossibile caricare i commenti'))
    }
  }, [tab, canManage, loadComments])

  const togglePin = async (post: BlogPost) => {
    setError(null)
    try {
      const updated = await updateBlogPost(post.id, { isPinned: !post.isPinned })
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, isPinned: updated.isPinned, pinnedAt: updated.pinnedAt } : p)))
      setNotice(updated.isPinned ? 'Notizia pinnata in alto.' : 'Pin rimosso.')
    } catch {
      setError('Impossibile modificare il pin.')
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteBlogPost(pendingDelete.id)
      setPosts((prev) => prev.filter((p) => p.id !== pendingDelete.id))
      setNotice('Notizia eliminata.')
    } catch {
      setError('Impossibile eliminare la notizia.')
    } finally {
      setPendingDelete(null)
    }
  }

  const toggleComment = async (comment: BlogComment) => {
    try {
      await setBlogCommentStatus(comment.id, 'hidden')
      setComments((prev) => prev.filter((c) => c.id !== comment.id))
      setNotice('Commento nascosto.')
    } catch {
      setError('Impossibile moderare il commento.')
    }
  }

  const confirmDeleteComment = async (comment: BlogComment) => {
    try {
      await deleteBlogComment(comment.id)
      setComments((prev) => prev.filter((c) => c.id !== comment.id))
      setNotice('Commento eliminato.')
    } catch {
      setError('Impossibile eliminare il commento.')
    }
  }

  if (isRoleLoading) {
    return <main className={styles.page}><div className="page-shell"><p>Caricamento...</p></div></main>
  }

  if (!canWrite) {
    return (
      <main className={styles.page}>
        <div className="page-shell">
          <p>Non hai i permessi per gestire il blog.</p>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className="page-shell">
        <header className={styles.header}>
          <h1 className={styles.title}>Blog</h1>
          <Link to="/admin/blog/new" className={`${styles.btn} ${styles.primary}`}>Nuova notizia</Link>
        </header>

        {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
        {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${tab === 'posts' ? styles.active : ''}`} onClick={() => setTab('posts')}>
            Notizie
          </button>
          {canManage && (
            <button type="button" className={`${styles.tab} ${tab === 'comments' ? styles.active : ''}`} onClick={() => setTab('comments')}>
              Commenti
            </button>
          )}
        </div>

        {tab === 'posts' && (
          <>
            <div className={styles.toolbar}>
              <input
                className={`${styles.input} ${styles.search}`}
                value={search}
                placeholder="Cerca per titolo..."
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tutti gli stati</option>
                <option value="published">Pubblicate</option>
                <option value="draft">Bozze</option>
              </select>
              <select className={styles.select} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Tutte le categorie</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>

            {isLoading && <p>Caricamento...</p>}
            {!isLoading && posts.length === 0 && <p className={styles.empty}>Nessuna notizia trovata.</p>}

            {!isLoading && posts.length > 0 && (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Titolo</th>
                    <th>Stato</th>
                    <th>Categoria</th>
                    <th>Evento</th>
                    <th>Commenti</th>
                    <th style={{ textAlign: 'right' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td className={styles.titleCell}>
                        <Link to={`/admin/blog/${post.id}/edit`} className={styles.titleLink}>{post.title}</Link>
                        <br />
                        <small>{post.publishedAt ? dateFmt.format(new Date(post.publishedAt)) : '—'}</small>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${post.status === 'published' ? styles.published : styles.draft}`}>
                          {post.status === 'published' ? 'Pubblicata' : 'Bozza'}
                        </span>
                        {post.isPinned && <span className={`${styles.badge} ${styles.pinned}`}>Pinnata</span>}
                      </td>
                      <td>{post.category?.name ?? '—'}</td>
                      <td>{post.event?.name ?? '—'}</td>
                      <td>{post.commentCount}</td>
                      <td>
                        <div className={styles.actions}>
                          <Link to={`/admin/blog/${post.id}/edit`} className={styles.btn}>Modifica</Link>
                          {canManage && (
                            <button type="button" className={styles.btn} onClick={() => togglePin(post)}>
                              {post.isPinned ? 'Rimuovi pin' : 'Pin'}
                            </button>
                          )}
                          {canManage && (
                            <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => setPendingDelete(post)}>
                              Elimina
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === 'comments' && canManage && (
          <>
            {comments.length === 0 ? (
              <p className={styles.empty}>Nessun commento da moderare.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Autore</th>
                    <th>Commento</th>
                    <th>Notizia</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map((comment) => (
                    <tr key={comment.id}>
                      <td>{comment.authorName}</td>
                      <td className={styles.commentBody}>{comment.body}</td>
                      <td>
                        {comment.post && (
                          <span className={styles.commentPost}>
                            <Link to={`/blog/${comment.post.slug}`}>{comment.post.title}</Link>
                          </span>
                        )}
                      </td>
                      <td>{dateFmt.format(new Date(comment.createdAt))}</td>
                      <td>
                        <div className={styles.actions}>
                          <button type="button" className={styles.btn} onClick={() => toggleComment(comment)}>Nascondi</button>
                          <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => confirmDeleteComment(comment)}>
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminare la notizia?"
        message="La notizia e i suoi commenti verranno eliminati definitivamente."
        confirmLabel="Elimina"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  )
}
