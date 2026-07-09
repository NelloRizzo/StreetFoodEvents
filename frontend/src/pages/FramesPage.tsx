import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { ImageUploader } from '../components/ImageUploader'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './FramesPage.module.scss'

type ModalState = { open: boolean; variant: 'alert' | 'confirm'; title: string; message: string; onConfirm?: () => void; danger?: boolean }

type Frame = {
  id: string
  name: string
  image: UploadedImage
  textPosition?: { vertical: string; horizontal: string }
}

export function FramesPage() {
  const [frames, setFrames] = useState<Frame[]>([])
  const [frameName, setFrameName] = useState('')
  const [frameImage, setFrameImage] = useState<UploadedImage | null>(null)
  const [frameTextPosition, setFrameTextPosition] = useState({ vertical: 'bottom', horizontal: 'center' })
  const [savingFrame, setSavingFrame] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ open: false, variant: 'alert', title: '', message: '' })

  const loadFrames = () => {
    apiRequest<{ items: Frame[] }>('/frames')
      .then((d) => setFrames(d.items))
      .catch(() => {})
  }

  useEffect(() => {
    loadFrames()
  }, [])

  const saveFrame = async () => {
    if (savingFrame || !frameName.trim() || !frameImage) return
    setSavingFrame(true)
    try {
      await apiRequest(`/frames`, {
        method: 'POST',
        bodyJson: { name: frameName.trim(), image: frameImage, textPosition: frameTextPosition },
      })
      setFrameName('')
      setFrameImage(null)
      setFrameTextPosition({ vertical: 'bottom', horizontal: 'center' })
      loadFrames()
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Salvataggio cornice fallito.' })
    } finally {
      setSavingFrame(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiRequest(`/frames/${deleteTarget}`, { method: 'DELETE' })
      setDeleteTarget(null)
      setFrames((prev) => prev.filter((f) => f.id !== deleteTarget))
    } catch {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: 'Eliminazione cornice fallita.' })
    }
  }

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Amministrazione</span>
            <h1 className={styles.title}>Cornici</h1>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Nuova cornice</h2>
          <div className={styles.form}>
            <input type="text" value={frameName} onChange={(e) => setFrameName(e.target.value)} placeholder="Nome cornice" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }} />
            <select value={frameTextPosition.vertical} onChange={(e) => setFrameTextPosition((p) => ({ ...p, vertical: e.target.value }))} style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}>
              <option value="top">Alto</option>
              <option value="center">Centro</option>
              <option value="bottom">Basso</option>
            </select>
            <select value={frameTextPosition.horizontal} onChange={(e) => setFrameTextPosition((p) => ({ ...p, horizontal: e.target.value }))} style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }}>
              <option value="left">Sinistra</option>
              <option value="center">Centro</option>
              <option value="right">Destra</option>
            </select>
            <ImageUploader mode="single" type="event" value={frameImage} onChange={(data) => setFrameImage(data as UploadedImage | null)} />
            <button className={styles.primaryBtn} onClick={saveFrame} disabled={savingFrame || !frameName.trim() || !frameImage}>
              {savingFrame ? 'Salvataggio...' : 'Aggiungi'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cornici ({frames.length})</h2>
          <div className={styles.list}>
            {frames.map((frame) => (
              <article key={frame.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <strong className={styles.cardName}>{frame.name}</strong>
                  {frame.textPosition && (
                    <span style={{ display: 'block', fontSize: 12, color: '#888', marginTop: 2 }}>
                      Testo: {frame.textPosition.vertical} / {frame.textPosition.horizontal}
                    </span>
                  )}
                  {frame.image.url && (
                    <img src={frame.image.url} alt={frame.name} style={{ maxWidth: 120, borderRadius: 8, marginTop: 4 }} />
                  )}
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.dangerBtn} onClick={() => setDeleteTarget(frame.id)}>
                    Elimina
                  </button>
                </div>
              </article>
            ))}
            {frames.length === 0 && (
              <p className={styles.empty}>Nessuna cornice. Carica un'immagine PNG con trasparenza.</p>
            )}
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
        title="Rimuovere cornice?"
        message="Questa azione è irreversibile."
        danger
        confirmLabel="Elimina"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
