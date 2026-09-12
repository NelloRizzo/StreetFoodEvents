import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { ImageUploader } from '../components/ImageUploader'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './AdvertisementsPage.module.scss'

type ModalState = { open: boolean; variant: 'alert' | 'confirm'; title: string; message: string; onConfirm?: () => void; danger?: boolean }

type Advertisement = {
  id: string
  name: string | null
  image: UploadedImage
  enabled: boolean
  weight: number
}

export function AdvertisementsPage() {
  const [items, setItems] = useState<Advertisement[]>([])
  const [imageName, setImageName] = useState('')
  const [weight, setWeight] = useState('1')
  const [image, setImage] = useState<UploadedImage | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ open: false, variant: 'alert', title: '', message: '' })

  const loadItems = () => {
    apiRequest<{ items: Advertisement[] }>('/advertisements/manage')
      .then((d) => setItems(d.items))
      .catch(() => {})
  }

  useEffect(() => {
    loadItems()
  }, [])

  const saveItem = async () => {
    if (saving || !image) return
    setSaving(true)
    try {
      await apiRequest(`/advertisements`, {
        method: 'POST',
        bodyJson: { name: imageName.trim() || null, weight: Math.max(1, Math.round(Number(weight) || 1)), image },
      })
      setImageName('')
      setWeight('1')
      setImage(null)
      loadItems()
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Salvataggio advertisement fallito.' })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const res = await apiRequest<{ item: Advertisement }>(`/advertisements/${id}`, {
        method: 'PATCH',
        bodyJson: { enabled },
      })
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: res.item.enabled } : i)))
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Aggiornamento non riuscito.' })
    }
  }

  const updateWeight = async (id: string, newWeight: number) => {
    const w = Math.max(1, Math.round(Number(newWeight) || 1))
    try {
      const res = await apiRequest<{ item: Advertisement }>(`/advertisements/${id}`, {
        method: 'PATCH',
        bodyJson: { weight: w },
      })
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, weight: res.item.weight } : i)))
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Aggiornamento non riuscito.' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiRequest(`/advertisements/${deleteTarget}`, { method: 'DELETE' })
      setDeleteTarget(null)
      setItems((prev) => prev.filter((f) => f.id !== deleteTarget))
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Eliminazione advertisement fallita.' })
    }
  }

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Amministrazione</span>
            <h1 className={styles.title}>Advertisement</h1>
            <p className={styles.subtitle}>Immagini pubblicitarie trasversali (non legate a un evento) mostrate nel pannello collassabile della slideshow. Usa immagini in formato portrait (rapporto A4).</p>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Nuovo advertisement</h2>
          <div className={styles.form}>
            <input type="text" value={imageName} onChange={(e) => setImageName(e.target.value)} placeholder="Nome (opzionale)" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }} />
            <input type="number" min={1} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Peso (default 1)" title="Peso" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', fontSize: 14, width: 140 }} />
            <label className={styles.pesoHint}>Peso: più alto = più spesso nel pannello</label>
            <ImageUploader mode="single" value={image} onChange={(data) => setImage(data as UploadedImage | null)} />
            <button className={styles.primaryBtn} onClick={saveItem} disabled={saving || !image}>
              {saving ? 'Salvataggio...' : 'Aggiungi'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Advertisement ({items.length})</h2>
          <div className={styles.list}>
            {items.map((item) => (
              <article key={item.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <strong className={styles.cardName}>{item.name || '(senza nome)'}</strong>
                  <span className={`${styles.badge} ${item.enabled ? styles.badgeOn : styles.badgeOff}`}>
                    {item.enabled ? 'Attiva' : 'Disattivata'}
                  </span>
                  <div className={styles.cardImageRow}>
                    {item.image.url && (
                      <img src={item.image.url} alt={item.name ?? ''} className={styles.thumb} />
                    )}
                    <label className={styles.pesoLabel}>
                      Peso
                      <input
                        type="number"
                        min={1}
                        value={item.weight}
                        onChange={(e) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, weight: Math.max(1, Math.round(Number(e.target.value) || 1)) } : i)))}
                        onBlur={() => void updateWeight(item.id, item.weight)}
                        className={styles.pesoInput}
                      />
                    </label>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.toggleBtn} onClick={() => toggleEnabled(item.id, !item.enabled)}>
                    {item.enabled ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button className={styles.dangerBtn} onClick={() => setDeleteTarget(item.id)}>
                    Elimina
                  </button>
                </div>
              </article>
            ))}
            {items.length === 0 && <p className={styles.empty}>Nessun advertisement nel pannello.</p>}
          </div>
        </section>
      </div>

      <ConfirmModal
        open={modal.open}
        variant={modal.variant}
        title={modal.title}
        message={modal.message}
        confirmLabel="OK"
        onConfirm={() => setModal((prev) => ({ ...prev, open: false }))}
        onCancel={() => setModal((prev) => ({ ...prev, open: false }))}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        variant="confirm"
        title="Rimuovere advertisement?"
        message="Questa azione è irreversibile."
        danger
        confirmLabel="Elimina"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}