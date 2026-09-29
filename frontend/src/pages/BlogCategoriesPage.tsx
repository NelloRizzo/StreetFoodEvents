import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ConfirmModal } from '../components/ConfirmModal'
import { useBlogRoleAccess } from '../features/blog/use-blog-role'
import {
  createBlogCategory,
  deleteBlogCategory,
  fetchManageBlogCategories,
  updateBlogCategory,
  type BlogCategory,
} from '../lib/blog'
import styles from './BlogCategoriesPage.module.scss'

type Draft = { name: string; slug: string; description: string; color: string }

const EMPTY: Draft = { name: '', slug: '', description: '', color: '' }

export function BlogCategoriesPage() {
  const { canManage, isLoading: isRoleLoading } = useBlogRoleAccess()
  const [items, setItems] = useState<BlogCategory[]>([])
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BlogCategory | null>(null)

  const load = useCallback(async () => {
    setItems(await fetchManageBlogCategories())
  }, [])

  useEffect(() => {
    if (!canManage) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    load()
      .catch(() => setError('Impossibile caricare le categorie'))
      .then(() => setIsLoading(false))
  }, [canManage, load])

  const reset = () => {
    setDraft(EMPTY)
    setEditingId(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) {
      setError('Il nome e\' obbligatorio.')
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (editingId) {
        await updateBlogCategory(editingId, {
          name: draft.name.trim(),
          slug: draft.slug.trim() || undefined,
          description: draft.description.trim() || null,
          color: draft.color.trim() || null,
        })
        setNotice('Categoria aggiornata.')
      } else {
        await createBlogCategory({
          name: draft.name.trim(),
          slug: draft.slug.trim() || undefined,
          description: draft.description.trim(),
          color: draft.color.trim(),
        })
        setNotice('Categoria creata.')
      }
      reset()
      await load()
    } catch {
      setError('Salvataggio non riuscito. Controlla che lo slug sia univoco.')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteBlogCategory(pendingDelete.id)
      setNotice('Categoria eliminata. Le notizie restano pubblicate senza categoria.')
      await load()
    } catch {
      setError('Impossibile eliminare la categoria.')
    } finally {
      setPendingDelete(null)
    }
  }

  const startEdit = (category: BlogCategory) => {
    setEditingId(category.id)
    setDraft({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      color: category.color ?? '',
    })
  }

  if (isRoleLoading) {
    return <main className={styles.page}><div className="page-shell"><p>Caricamento...</p></div></main>
  }

  if (!canManage) {
    return (
      <main className={styles.page}>
        <div className="page-shell">
          <p>Solo un blog-admin puo' gestire le categorie.</p>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className="page-shell">
        <header className={styles.header}>
          <h1 className={styles.title}>Categorie del blog</h1>
          <Link to="/admin/blog" className={styles.btn}>Torna alle notizie</Link>
        </header>

        {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
        {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cat-name">Nome</label>
              <input
                id="cat-name"
                className={styles.input}
                value={draft.name}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cat-slug">Slug</label>
              <input
                id="cat-slug"
                className={styles.input}
                value={draft.slug}
                placeholder="generato dal nome"
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cat-color">Colore</label>
              <input
                id="cat-color"
                className={styles.input}
                value={draft.color}
                placeholder="#bf5a2a"
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cat-desc">Descrizione</label>
            <input
              id="cat-desc"
              className={styles.input}
              value={draft.description}
              maxLength={300}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className={styles.actions}>
            <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={isSaving}>
              {editingId ? 'Aggiorna' : 'Crea categoria'}
            </button>
            {editingId && (
              <button type="button" className={styles.btn} onClick={reset}>Annulla</button>
            )}
          </div>
        </form>

        {isLoading ? (
          <p>Caricamento...</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>Nessuna categoria creata.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Slug</th>
                <th>Descrizione</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td><code>{category.slug}</code></td>
                  <td>{category.description ?? '—'}</td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.btn} onClick={() => startEdit(category)}>Modifica</button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.danger}`}
                        onClick={() => setPendingDelete(category)}
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminare la categoria?"
        message="Le notizie collegate non verranno eliminate: resteranno senza categoria."
        confirmLabel="Elimina"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  )
}
