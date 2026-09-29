import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ImageUploader } from '../components/ImageUploader'
import { RichEditor } from '../components/RichEditor'
import { useBlogRoleAccess } from '../features/blog/use-blog-role'
import { apiRequest } from '../lib/api'
import {
  createBlogPost,
  fetchManageBlogCategories,
  fetchManageBlogPost,
  updateBlogPost,
  type BlogCategory,
  type BlogPostStatus,
} from '../lib/blog'
import type { UploadedImage } from '../lib/upload'
import styles from './BlogPostEditPage.module.scss'

type EventLite = {
  id: string
  name: string
  startDate: string
}

type FormState = {
  title: string
  excerpt: string
  contentHtml: string
  coverImage: UploadedImage | null
  categoryId: string
  eventId: string
  status: BlogPostStatus
}

const EMPTY: FormState = {
  title: '',
  excerpt: '',
  contentHtml: '',
  coverImage: null,
  categoryId: '',
  eventId: '',
  status: 'draft',
}

export function BlogPostEditPage() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { canWrite, isLoading: isRoleLoading } = useBlogRoleAccess()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [postIdState, setPostIdState] = useState<string | null>(postId ?? null)
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [events, setEvents] = useState<EventLite[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(postId))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [cats, evs] = await Promise.all([
      fetchManageBlogCategories(),
      apiRequest<{ items: EventLite[] }>('/events'),
    ])
    setCategories(cats)
    setEvents(evs.items)

    if (postId) {
      const post = await fetchManageBlogPost(postId)
      setPostIdState(post.id)
      setForm({
        title: post.title,
        excerpt: post.excerpt ?? '',
        contentHtml: post.contentHtml ?? '',
        coverImage: post.coverImage,
        categoryId: post.category?.id ?? '',
        eventId: post.event?.id ?? '',
        status: post.status,
      })
    }
  }, [postId])

  useEffect(() => {
    if (!canWrite) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    load()
      .catch(() => setError('Impossibile caricare la notizia'))
      .then(() => setIsLoading(false))
  }, [canWrite, load])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = async (statusOverride?: BlogPostStatus) => {
    if (!form.title.trim()) {
      setError('Il titolo e\' obbligatorio.')
      return
    }
    if (!form.contentHtml.trim()) {
      setError('Il corpo della notizia e\' obbligatorio.')
      return
    }

    const status = statusOverride ?? form.status
    setIsSaving(true)
    setError(null)
    setNotice(null)

    const payload = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim() || null,
      contentHtml: form.contentHtml,
      coverImage: form.coverImage,
      categoryId: form.categoryId || null,
      eventId: form.eventId || null,
      status,
    }

    try {
      if (postIdState) {
        const updated = await updateBlogPost(postIdState, payload)
        setForm((prev) => ({ ...prev, status: updated.status }))
        setNotice(status === 'published' ? 'Notizia pubblicata.' : 'Bozza salvata.')
      } else {
        const created = await createBlogPost(payload)
        setPostIdState(created.id)
        setForm((prev) => ({ ...prev, status: created.status }))
        setNotice('Notizia creata.')
        navigate(`/admin/blog/${created.id}/edit`, { replace: true })
      }
    } catch {
      setError('Salvataggio non riuscito. Riprova.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isRoleLoading) {
    return <main className={styles.page}><div className="page-shell"><p>Caricamento...</p></div></main>
  }

  if (!canWrite) {
    return (
      <main className={styles.page}>
        <div className="page-shell">
          <p>Non hai i permessi per scrivere nel blog.</p>
        </div>
      </main>
    )
  }

  if (isLoading) {
    return <main className={styles.page}><div className="page-shell"><p>Caricamento...</p></div></main>
  }

  return (
    <main className={styles.page}>
      <div className="page-shell">
        <header className={styles.header}>
          <h1 className={styles.title}>{postIdState ? 'Modifica notizia' : 'Nuova notizia'}</h1>
          <Link to="/admin/blog" className={styles.btn}>Torna all'elenco</Link>
        </header>

        {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
        {notice && <div className={`${styles.notice} ${styles.success}`}>{notice}</div>}

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="title">Titolo</label>
            <input
              id="title"
              className={styles.input}
              value={form.title}
              maxLength={200}
              onChange={(e) => update('title', e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="excerpt">Sommario</label>
            <textarea
              id="excerpt"
              className={styles.textarea}
              value={form.excerpt}
              maxLength={400}
              onChange={(e) => update('excerpt', e.target.value)}
            />
            <span className={styles.hint}>Compare nell'elenco e nell'aside della home.</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Immagine di copertina</span>
            <ImageUploader
              mode="single"
              type="blog"
              value={form.coverImage}
              onChange={(img) => update('coverImage', img as UploadedImage | null)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="category">Categoria</label>
              <select
                id="category"
                className={styles.select}
                value={form.categoryId}
                onChange={(e) => update('categoryId', e.target.value)}
              >
                <option value="">— Nessuna —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="event">Evento collegato</label>
              <select
                id="event"
                className={styles.select}
                value={form.eventId}
                onChange={(e) => update('eventId', e.target.value)}
              >
                <option value="">— Nessun evento —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {new Date(ev.startDate).toLocaleDateString('it-IT')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Contenuto</span>
            <RichEditor
              value={form.contentHtml}
              onChange={(html) => update('contentHtml', html)}
              placeholder="Scrivi la notizia..."
              imageUploadType="blog"
            />
            <span className={styles.hint}>
              I link inseriti vengono aperti in una nuova scheda automaticamente.
              Le immagini nel testo sono caricate su Cloudinary (cartella blog).
            </span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={isSaving} onClick={() => save('published')}>
              {form.status === 'published' ? 'Salva e pubblica' : 'Pubblica'}
            </button>
            <button type="button" className={styles.btn} disabled={isSaving} onClick={() => save('draft')}>
              Salva bozza
            </button>
            <div className={styles.statusRow}>
              <span className={styles.hint}>Stato: <strong>{form.status === 'published' ? 'Pubblicata' : 'Bozza'}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
