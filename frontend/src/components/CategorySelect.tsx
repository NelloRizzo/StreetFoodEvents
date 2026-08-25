import { useState, useEffect } from 'react'

import { apiRequest } from '../lib/api'
import styles from './CategorySelect.module.scss'

export type EventCategory = { id: string; label: string; sortOrder?: number }

export function normalizeCategoryLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function categoryKey(label: string): string {
  return normalizeCategoryLabel(label)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

type CategorySelectProps = {
  id?: string
  value: string[]
  onChange: (categoryIds: string[]) => void
}

export function CategorySelect({ id, value, onChange }: CategorySelectProps) {
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiRequest<{ items: EventCategory[] }>('/categories')
        if (!cancelled) setCategories(res.items ?? [])
      } catch {
        // silently fail — chips just won't show
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const toggleCategory = (label: string) => {
    setError(null)
    const next = value.includes(label)
      ? value.filter((v) => v !== label)
      : [...value, label]
    onChange(next)
  }

  const confirmNewCategory = async () => {
    const label = normalizeCategoryLabel(draft)
    if (!label) {
      setError('Inserisci un nome per la categoria.')
      return
    }

    const key = categoryKey(label)
    const existing = categories.find((c) => categoryKey(c.label) === key)
    if (existing) {
      if (!value.includes(existing.label)) {
        onChange([...value, existing.label])
      }
      setError(null)
      setIsCreating(false)
      setDraft('')
      return
    }

    setIsSaving(true)
    try {
      const nextSortOrder =
        categories.length > 0
          ? Math.max(...categories.map((c) => c.sortOrder ?? 0)) + 1
          : 1
      const res = await apiRequest<{ item: EventCategory }>('/categories', {
        method: 'POST',
        bodyJson: { label, sortOrder: nextSortOrder },
      })
      const created = res.item
      setCategories((prev) => [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label)))
      onChange([...value, created.label])
      setError(null)
      setIsCreating(false)
      setDraft('')
    } catch {
      setError('Impossibile creare la categoria. Riprova.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return <p className={styles.hint}>Caricamento categorie…</p>
  }

  return (
    <div className={styles.wrapper} id={id}>
      <div className={styles.chipGroup}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${styles.chip} ${value.includes(c.label) ? styles.chipActive : ''}`}
            onClick={() => toggleCategory(c.label)}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.chip} ${styles.chipNew}`}
          onClick={() => { setIsCreating(true); setDraft('') }}
          disabled={isSaving}
        >
          + Nuova
        </button>
      </div>

      {isCreating && (
        <div className={styles.newRow}>
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setError(null) }}
            placeholder="Nome nuova categoria"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void confirmNewCategory() } }}
            autoFocus
            disabled={isSaving}
          />
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => { void confirmNewCategory() }}
            disabled={isSaving}
          >
            Aggiungi
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => { setIsCreating(false); setDraft(''); setError(null) }}
            disabled={isSaving}
          >
            Annulla
          </button>
        </div>
      )}

      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
