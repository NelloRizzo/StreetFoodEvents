import { Link } from 'react-router-dom'
import styles from './DocumentsPage.module.scss'

type DocEntry = {
  title: string
  description: string
  to: string
  icon: string
}

const documents: DocEntry[] = [
  {
    title: 'Scheda prodotti da compilare',
    description: 'Foglio cartaceo da consegnare a ogni stand: il gestore compila i prodotti, gli ingredienti, gli allergeni (Reg. UE 1169/2011) e la foto, poi restituisce all\'organizzatore per l\'inserimento a sistema.',
    to: '/admin/documents/product-guide',
    icon: '\u{1F4CB}',
  },
]

export function DocumentsPage() {
  return (
    <div className={styles.page}>
      <div className="page-shell">
        <span className="eyebrow">Piattaforma</span>
        <h1 className={styles.title}>Documenti</h1>
        <p className={styles.subtitle}>Documentazione operativa e schede da consegnare agli stand.</p>

        <div className={styles.grid}>
          {documents.map((doc) => (
            <Link key={doc.to} to={doc.to} className={styles.card}>
              <span className={styles.cardIcon}>{doc.icon}</span>
              <div className={styles.cardBody}>
                <strong className={styles.cardTitle}>{doc.title}</strong>
                <span className={styles.cardDesc}>{doc.description}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
