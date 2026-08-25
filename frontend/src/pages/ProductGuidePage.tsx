import { Link } from 'react-router-dom'
import styles from './ProductGuidePage.module.scss'

const ALLERGENS = [
  { id: 'gluten', label: 'Glutine', examples: 'grano, segale, orzo, avena' },
  { id: 'crustaceans', label: 'Crostacei', examples: 'gamberi, scampi' },
  { id: 'eggs', label: 'Uova', examples: 'uova, maionese' },
  { id: 'fish', label: 'Pesce', examples: 'pesce, surimi' },
  { id: 'peanuts', label: 'Arachidi', examples: 'arachidi, burro di arachidi' },
  { id: 'soy', label: 'Soia', examples: 'tofu, salsa di soia' },
  { id: 'milk', label: 'Latte', examples: 'lattosio, burro, formaggi, panna' },
  { id: 'tree-nuts', label: 'Frutta a guscio', examples: 'mandorle, nocciole, noci, pistacchi' },
  { id: 'celery', label: 'Sedano', examples: 'sedano rapa, sedano父ino' },
  { id: 'mustard', label: 'Senape', examples: 'senape, mostarda' },
  { id: 'sesame', label: 'Sesamo', examples: 'semi di sesamo, tahini' },
  { id: 'sulphites', label: 'Solfiti', examples: 'vino, succhi di frutta' },
  { id: 'lupins', label: 'Lupini', examples: 'fave di lupini' },
  { id: 'molluscs', label: 'Molluschi', examples: 'cozze, vongole, calamari' },
]

function ProductBlock({ index }: { index: number }) {
  return (
    <div className={styles.productBlock}>
      <div className={styles.blockHeader}>
        <span className={styles.blockNumber}>Prodotto {index}</span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.label}>Nome prodotto:</span>
        <span className={styles.line} />
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.label}>Descrizione breve:</span>
        <span className={styles.line} />
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.label}>Ingredienti (elenco completo):</span>
      </div>
      <div className={styles.textArea}>
        <span className={styles.line} />
        <span className={styles.line} />
        <span className={styles.line} />
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.label}>Prezzo:</span>
        <span className={styles.lineShort} />
        <span className={styles.fieldHint}>&euro;</span>
      </div>

      <div className={styles.allergenSection}>
        <span className={styles.label}>Allergeni presenti (Reg. UE 1169/2011) — barrare con X:</span>
        <div className={styles.allergenGrid}>
          {ALLERGENS.map((a) => (
            <label key={a.id} className={styles.allergenItem}>
              <span className={styles.checkbox} />
              <span className={styles.allergenName}>{a.label}</span>
              <span className={styles.allergenExamples}>({a.examples})</span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.checkbox} />
        <span className={styles.label}>Prodotto congelato (asterisco * obbligatorio per legge)</span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.checkbox} />
        <span className={styles.label}>Foto del prodotto allegata</span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.label}>Note foto:</span>
        <span className={styles.line} />
      </div>
    </div>
  )
}

export function ProductGuidePage() {
  return (
    <div className={styles.page}>
      <div className={styles.printActions}>
        <Link to="/admin/documents" className={styles.backLink}>&larr; Documenti</Link>
        <button className={styles.printBtn} onClick={() => window.print()}>Stampa scheda</button>
      </div>

      <article className={styles.form}>
        <header className={styles.header}>
          <h1>Scheda prodotti — Stand</h1>
          <p className={styles.subtitle}>
            Compilare questa scheda e restituirla all&apos;organizzatore. I dati verranno inseriti nel sistema.
          </p>
        </header>

        <div className={styles.topFields}>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Evento:</span>
            <span className={styles.line} />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Nome stand:</span>
            <span className={styles.line} />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Responsabile:</span>
            <span className={styles.line} />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Telefono / Email:</span>
            <span className={styles.line} />
          </div>
        </div>

        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ProductBlock key={i} index={i} />
        ))}

        <footer className={styles.footer}>
          <p>
            Compilare un blocco per ogni prodotto. Indicare <strong>tutti</strong> gli allergeni presenti
            secondo il Regolamento UE 1169/2011. Per i prodotti congelati barrare la casella dedicata:
            l&apos;asterisco (*) verrà aggiunto automaticamente nel menu.
          </p>
          <p>
            Allegare una foto per prodotto (formato JPG/PNG, risoluzione minima 800×600 px).
          </p>
        </footer>
      </article>
    </div>
  )
}
