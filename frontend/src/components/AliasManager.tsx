import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import styles from './AliasManager.module.scss'

type AliasItem = {
  id: string
  text: string
  entityType: 'event' | 'stand'
  entityRef: string
}

type Props = {
  entityType: 'event' | 'stand'
  entityRef: string
}

export function AliasManager({ entityType, entityRef }: Props) {
  const [aliases, setAliases] = useState<AliasItem[]>([])
  const [newText, setNewText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAliases = useCallback(async () => {
    try {
      const data = await apiRequest<{ items: AliasItem[] }>(`/aliases?entityType=${entityType}&entityRef=${entityRef}`)
      setAliases(data.items)
    } catch {
      setError('Errore nel caricamento degli alias')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityRef])

  useEffect(() => {
    fetchAliases()
  }, [fetchAliases])

  const handleAdd = async () => {
    const text = newText.trim().toLowerCase()
    if (!text || saving) return

    if (!/^[a-z0-9_-]+$/.test(text)) {
      setError('Solo lettere, numeri, underscore e trattini')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await apiRequest('/aliases', {
        method: 'POST',
        bodyJson: { text, entityType, entityRef },
      })
      setNewText('')
      await fetchAliases()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante il salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/aliases/${id}`, { method: 'DELETE' })
      setAliases((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError('Errore durante l\'eliminazione')
    }
  }

  return (
    <div className={styles.aliasSection}>
      <h3 className={styles.sectionTitle}>
        Link alias
        <span className={styles.count}>{aliases.length}</span>
      </h3>

      <div className={styles.addRow}>
        <input
          className={styles.input}
          type="text"
          value={newText}
          onChange={(e) => { setNewText(e.target.value); setError(null) }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="mio-alias"
          pattern="[a-z0-9_-]+"
        />
        <button className={styles.addBtn} onClick={handleAdd} disabled={saving || !newText.trim()}>
          {saving ? '...' : 'Aggiungi'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {aliases.length === 0 && !loading && (
        <p className={styles.empty}>Nessun alias. Aggiungine uno per creare un link breve.</p>
      )}

      <div className={styles.list}>
        {aliases.map((alias) => (
          <div key={alias.id} className={styles.card}>
            <div className={styles.cardBody}>
              <strong className={styles.cardText}>{alias.text}</strong>
              <span className={styles.cardUrl}>
                /show/{entityType}/{alias.text}
              </span>
            </div>
            <button className={styles.dangerBtn} onClick={() => handleDelete(alias.id)}>
              Elimina
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
