import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { RichEditor } from '../components/RichEditor'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './AdhesionFormManagePage.module.scss'

type AdhesionSection = {
  slug: string
  title: string
  content: string
  generatedFrom: string | null
}

type AdhesionFormItem = {
  eventId: string
  sections: AdhesionSection[]
  generatedAt: string | null
  stale: boolean
}

type EditableSection = {
  slug: string
  title: string
  content: string
  generatedFrom: string | null
}

type EventRef = {
  id: string
  name: string
}

const GENERATED_LABEL: Record<string, string> = {
  'event-header': 'Auto dall\u2019evento',
  currency: 'Auto dall\u2019evento (moneta)',
  fees: 'Auto dall\u2019evento (commissioni)',
}

export function AdhesionFormManagePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [item, setItem] = useState<AdhesionFormItem | null>(null)
  const [event, setEvent] = useState<EventRef | null>(null)
  const [sections, setSections] = useState<EditableSection[]>([])
  const [editorVersion, setEditorVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const syncFromItem = (next: AdhesionFormItem) => {
    setItem(next)
    setSections(next.sections.map((s) => ({ slug: s.slug, title: s.title, content: s.content, generatedFrom: s.generatedFrom })))
    setPending(false)
    setEditorVersion((v) => v + 1)
  }

  useEffect(() => {
    let cancelled = false

    void apiRequest<{ item: AdhesionFormItem }>(`/events/${eventId}/adhesion-form`)
      .then((data) => {
        if (cancelled) return
        setMissing(false)
        syncFromItem(data.item)
      })
      .catch(() => {
        if (cancelled) return
        setMissing(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    void apiRequest<{ item: EventRef }>(`/events/${eventId}`)
      .then((data) => { if (!cancelled) setEvent(data.item) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [eventId])

  const handleGenerate = async () => {
    if (!eventId) return
    setBusy(true)
    try {
      const data = await apiRequest<{ item: AdhesionFormItem }>(`/events/${eventId}/adhesion-form/generate`, {
        method: 'POST',
      })
      setMissing(false)
      syncFromItem(data.item)
    } catch {
      setMsg('Impossibile generare il modulo di adesione. Riprova.')
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    if (!eventId) return
    setBusy(true)
    try {
      const data = await apiRequest<{ item: AdhesionFormItem }>(`/events/${eventId}/adhesion-form`, {
        method: 'PATCH',
        bodyJson: {
          sections: sections.map((s) => ({ slug: s.slug, title: s.title, content: s.content })),
        },
      })
      syncFromItem(data.item)
      setMsg('Modifiche salvate.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Errore durante il salvataggio.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!eventId) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      await apiRequest(`/events/${eventId}/adhesion-form`, { method: 'DELETE' })
      setItem(null)
      setSections([])
      setMissing(true)
    } catch {
      setMsg('Impossibile eliminare il modulo. Riprova.')
    } finally {
      setBusy(false)
    }
  }

  const updateSection = (slug: string, patch: Partial<EditableSection>) => {
    setSections((prev) => prev.map((s) => (s.slug === slug ? { ...s, ...patch } : s)))
    setPending(true)
  }

  if (loading) return null

  const generatedAt = item?.generatedAt ? new Date(item.generatedAt).toLocaleDateString('it-IT') : null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Gestione evento</span>
            <h1 className={styles.title}>Modulo di adesione</h1>
            <p className={styles.subtitle}>{event?.name ?? 'Evento'}</p>
          </div>
          <div className={styles.headerActions}>
            {item && (
              <Link className={styles.ghostBtn} to={`/events/${eventId}/adhesion-form`} target="_blank" rel="noopener noreferrer">
                Apri versione pubblica
              </Link>
            )}
            <Link className={styles.ghostBtn} to="/admin/events">
              Eventi
            </Link>
          </div>
        </div>

        <p className={styles.hint}>
          Il modulo viene <strong>generato dalle impostazioni dell&apos;evento</strong> (nome, luogo, date, moneta e fasce commissione)
          e può essere <strong>modificato manualmente in ogni sezione</strong>. Alla rigenerazione, le sezioni evidenziate come
          &quot;Auto dall&apos;evento&quot; vengono riscritte, quelle manuali vengono conservate.
        </p>

        {item?.stale && (
          <div className={styles.staleBanner}>
            L&apos;evento è stato modificato dopo l&apos;ultima generazione: il modulo potrebbe risultare obsoleto.
            Ti consigliamo di rigenerarlo dalle impostazioni dell&apos;evento.
          </div>
        )}

        {missing ? (
          <div className={styles.empty}>
            <p>Nessun modulo di adesione presente per questo evento.</p>
            <button type="button" className={styles.primaryBtn} disabled={busy} onClick={handleGenerate}>
              {busy ? 'Generazione...' : 'Genera modulo dall\u2019evento'}
            </button>
          </div>
        ) : (
          <>
            <div className={styles.metaRow}>
              <span>Generato il: {generatedAt}</span>
              <span>Sezioni: {item?.sections.length ?? 0}</span>
            </div>

            <div className={styles.sections}>
              {sections.map((section) => {
                const autoLabel = GENERATED_LABEL[section.slug]
                return (
                  <fieldset key={`${section.slug}-${editorVersion}`} className={styles.fieldset}>
                    <legend className={styles.legend}>
                      <input
                        className={styles.titleInput}
                        value={section.title}
                        onChange={(e) => updateSection(section.slug, { title: e.target.value })}
                      />
                      {autoLabel ? (
                        <span className={styles.autoBadge}>{autoLabel}</span>
                      ) : (
                        <span className={styles.manualBadge}>Manuale</span>
                      )}
                    </legend>
                    <RichEditor
                      value={section.content}
                      onChange={(html) => updateSection(section.slug, { content: html })}
                      placeholder={`Contenuto sezione ${section.slug}...`}
                    />
                  </fieldset>
                )
              })}
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.primaryBtn} disabled={busy || !pending} onClick={handleSave}>
                {busy ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
              <button type="button" className={styles.outlineBtn} disabled={busy} onClick={handleGenerate}>
                {busy ? 'Generazione...' : 'Rigenera dall\u2019evento'}
              </button>
              <button type="button" className={styles.dangerBtn} disabled={busy} onClick={() => setConfirmDelete(true)}>
                Elimina modulo
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete}
        variant="confirm"
        title="Elimina modulo di adesione"
        message="Il modulo verrà eliminato. Potrai rigenerarlo in qualsiasi momento dalle impostazioni dell'evento."
        confirmLabel="Elimina"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={msg !== null}
        variant="alert"
        title="Modulo di adesione"
        message={msg ?? ''}
        confirmLabel="OK"
        onConfirm={() => setMsg(null)}
        onCancel={() => setMsg(null)}
      />
    </div>
  )
}