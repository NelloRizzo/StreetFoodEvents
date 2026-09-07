import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import styles from './AdhesionFormPublicPage.module.scss'

type Section = {
  slug: string
  title: string
  content: string
  generatedFrom: string | null
}

type FormItem = {
  eventId: string
  sections: Section[]
  generatedAt: string | null
}

export function AdhesionFormPublicPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [item, setItem] = useState<FormItem | null>(null)
  const [status, setStatus] = useState<'loading' | 'found' | 'missing'>('loading')

  useEffect(() => {
    apiRequest<{ item: FormItem }>(`/events/${eventId}/adhesion-form`)
      .then((data) => {
        setItem(data.item)
        setStatus('found')
      })
      .catch(() => setStatus('missing'))
  }, [eventId])

  if (status === 'loading') return null

  if (status === 'missing' || !item) {
    return (
      <div className={styles.standalone}>
        <div className={styles.notFound}>
          <p>Il modulo di adesione non è ancora disponibile per questo evento.</p>
          <Link className={styles.backLink} to={`/events/${eventId}`}>
            Torna all'evento
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.standalone}>
      <div className={`page-shell ${styles.toolbar}`}>
        <Link className={styles.backLink} to={`/events/${eventId}`}>
          ← Torna all'evento
        </Link>
        <button type="button" className={styles.printBtn} onClick={() => window.print()}>
          Stampa / salva PDF
        </button>
      </div>

      <div className={styles.sheet}>
        <header className={styles.header}>
          <h1 className={styles.title}>Modulo di adesione stand</h1>
          <p className={styles.subtitle}>Manifestazione: prestazioni enogastronomiche e allestimento stand</p>
        </header>

        {item.sections.map((section) => (
          <section key={section.slug} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            <div
              className={styles.sectionBody}
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
          </section>
        ))}

        <footer className={styles.footer}>
          <p>Firma del richiedente / gestore dello stand</p>
          <p className={styles.signatureLine}>______________________________________</p>
        </footer>
      </div>
    </div>
  )
}