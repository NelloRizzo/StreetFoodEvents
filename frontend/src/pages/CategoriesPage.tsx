import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { normalizeCategoryLabel } from '../components/CategorySelect'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './CategoriesPage.module.scss'

type Category = { id: string; label: string; sortOrder: number }

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const fetchCategories = async () => {
    const data = await apiRequest<{ items: Category[] }>('/categories')
    setCategories(data.items ?? [])
    setIsLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    apiRequest<{ items: Category[] }>('/categories')
      .then((data) => { if (!cancelled) setCategories(data.items ?? []) })
      .catch(() => { /* not required */ })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const createCategory = async () => {
    const label = normalizeCategoryLabel(newLabel)
    if (!label) {
      setError('Inserisci un nome per la categoria.')
      return
    }
    setError(null)
    try {
      const nextSortOrder =
        categories.length > 0 ? Math.max(...categories.map((c) => c.sortOrder)) + 1 : 1
      await apiRequest('/categories', { method: 'POST', bodyJson: { label, sortOrder: nextSortOrder } })
      setNewLabel('')
      setShowCreate(false)
      await fetchCategories()
    } catch {
      setError('Impossibile creare la categoria.')
    }
  }

  const saveEdit = async () => {
    if (!editingId) return
    const label = normalizeCategoryLabel(editLabel)
    if (!label) {
      setError('Il nome non può essere vuoto.')
      return
    }
    setError(null)
    try {
      await apiRequest(`/categories/${editingId}`, { method: 'PATCH', bodyJson: { label } })
      setEditingId(null)
      await fetchCategories()
    } catch (e) {
      const msg = (e as { message?: string })?.message
      setError(msg && msg.includes('already exists') ? 'Esiste già una categoria con questo nome.' : 'Impossibile modificare la categoria.')
    }
  }

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Gestione</span>
            <h1 className={styles.title}>Categorie</h1>
          </div>
          {!showCreate && (
            <button className={styles.primaryBtn} onClick={() => { setShowCreate(true); setNewLabel('') }}>
              Nuova categoria
            </button>
          )}
        </div>

        {showCreate && (
          <form
            className={styles.form}
            onSubmit={(e) => { e.preventDefault(); void createCategory() }}
          >
            <div className={styles.field}>
              <label htmlFor="cat-name">Nome categoria</label>
              <input
                id="cat-name"
                value={newLabel}
                onChange={(e) => { setNewLabel(e.target.value); setError(null) }}
                placeholder="es. Antipasti, Primi, Dessert"
                autoFocus
              />
            </div>
            {error && <span className={styles.error}>{error}</span>}
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>Crea</button>
              <button type="button" className={styles.secondaryBtn} onClick={() => { setShowCreate(false); setError(null) }}>
                Annulla
              </button>
            </div>
          </form>
        )}

        <p className={styles.hint}>
          Le categorie sono globali: vengono usate da tutti gli stand e gli eventi per organizzare i menu
          (stampa per categoria e viste menu).
        </p>

        <div className={styles.list}>
          {categories.map((cat) => (
            <article key={cat.id} className={styles.card}>
              {editingId === cat.id ? (
                <form
                  className={styles.editRow}
                  onSubmit={(e) => { e.preventDefault(); void saveEdit() }}
                >
                  <input
                    value={editLabel}
                    onChange={(e) => { setEditLabel(e.target.value); setError(null) }}
                    autoFocus
                  />
                  <button type="submit" className={styles.textBtn}>Salva</button>
                  <button type="button" className={styles.textBtn} onClick={() => { setEditingId(null); setError(null) }}>
                    Annulla
                  </button>
                </form>
              ) : (
                <>
                  <div className={styles.cardBody}>
                    <strong className={styles.cardName}>{cat.label}</strong>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.textBtn}
                      onClick={() => { setEditingId(cat.id); setEditLabel(cat.label); setError(null) }}
                    >
                      Modifica
                    </button>
                    <button className={styles.dangerBtn} onClick={() => setDeleteTarget(cat.id)}>
                      Elimina
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}

          {categories.length === 0 && (
            <p className={styles.empty}>Nessuna categoria. Creane una nuova.</p>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        variant="confirm"
        title="Eliminare categoria?"
        message="I prodotti che usano questa categoria non la mostreranno più nei menu per categoria."
        danger
        confirmLabel="Elimina"
        onConfirm={async () => {
          if (!deleteTarget) return
          await apiRequest(`/categories/${deleteTarget}`, { method: 'DELETE' })
          setDeleteTarget(null)
          await fetchCategories()
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
