import { useState } from 'react'

import { apiRequest } from '../lib/api'
import styles from './CategorySelect.module.scss'

export type EventCategory = { label: string; sortOrder?: number }

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
  eventId: string
  categories: EventCategory[]
  value: string[]
  onChange: (categoryIds: string[]) => void
  onCategoriesChange: (categories: EventCategory[]) => void
}

export function CategorySelect({ id, eventId, categories, value, onChange, onCategoriesChange }: CategorySelectProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
      const next = [...categories, { label, sortOrder: nextSortOrder }]
      await apiRequest(`/events/${eventId}`, {
        method: 'PATCH',
        bodyJson: { categories: next },
      })
      onCategoriesChange(next)
      onChange([...value, label])
      setError(null)
      setIsCreating(false)
      setDraft('')
    } catch {
      setError('Impossibile creare la categoria. Riprova.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!eventId) {
    return (
      <p className={styles.hint}>Seleziona prima un evento per scegliere le categorie.</p>
    )
  }

  return (
    <div className={styles.wrapper} id={id}>
      <div className={styles.chipGroup}>
        {categories.map((c) => (
          <button
            key={c.label}
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
