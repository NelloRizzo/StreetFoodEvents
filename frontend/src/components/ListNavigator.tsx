import { MONTH_LABELS } from '../lib/list-nav'
import styles from './ListNavigator.module.scss'

/* Navigazione delle liste amministrative, condivisa fra Prodotti, Stand ed
   Eventi. La logica (paginazione, iniziali, anni/mesi) sta in
   `lib/list-nav.ts`; qui c'è solo il rendering. */

type Noun = { one: string; many: string }

export type PaginationProps = {
  page: number
  totalPages: number
  total: number
  /** Singolare/plurale della voce contata, per il conteggio leggibile. */
  noun: Noun
  onChange: (page: number) => void
}

/**
 * Barra "← Precedente · Pagina X di Y · N voci · Successiva →".
 *
 * Con una sola pagina restano solo le frecce fuori e il conteggio: "Pagina
 * 1 di 1" e due pulsanti spenti sono rumore, mentre "25 prodotti" è l'unico
 * feedback che resta quando un filtro ristretto fa entrare tutto in una
 * pagina.
 */
export function Pagination({ page, totalPages, total, noun, onChange }: PaginationProps) {
  if (total <= 0) return null
  const label = total === 1 ? noun.one : noun.many
  const paged = totalPages > 1
  const info = paged
    ? `Pagina ${page} di ${totalPages} · ${total} ${label}`
    : `${total} ${label}`
  return (
    <nav className={styles.pagination} aria-label="Paginazione">
      {paged && (
        <button
          type="button"
          className={styles.navBtn}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          &larr; Precedente
        </button>
      )}
      <span className={styles.pageInfo}>{info}</span>
      {paged && (
        <button
          type="button"
          className={styles.navBtn}
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Successiva &rarr;
        </button>
      )}
    </nav>
  )
}

export type LetterIndexProps = {
  /** Iniziali effettivamente presenti: quelle assenti non vengono mostrate. */
  letters: readonly string[]
  active: string | null
  onChange: (letter: string | null) => void
  label?: string
}

/**
 * Navigatore per iniziale: filtra la lista sulle voci che iniziano per
 * quella lettera ("Tutte" azzera). Il filtro è calcolato sull'elenco
 * INTERO, non sulla pagina corrente, così le lettere restano cliccabili
 * ovunque ci si trovi.
 */
export function LetterIndex({ letters, active, onChange, label = 'Iniziale' }: LetterIndexProps) {
  /* Con una sola iniziale in elenco non c'è niente da scegliere. */
  if (letters.length < 2) return null
  return (
    <div className={styles.indexRow} role="group" aria-label={label}>
      <span className={styles.indexLabel}>{label}</span>
      <button
        type="button"
        className={`${styles.chip} ${active === null ? styles.chipActive : ''}`}
        aria-pressed={active === null}
        onClick={() => onChange(null)}
      >
        Tutte
      </button>
      {letters.map((letter) => (
        <button
          key={letter}
          type="button"
          className={`${styles.chip} ${active === letter ? styles.chipActive : ''}`}
          aria-pressed={active === letter}
          onClick={() => onChange(active === letter ? null : letter)}
        >
          {letter}
        </button>
      ))}
    </div>
  )
}

export type DateIndexProps = {
  /** Anni presenti nella lista (più recente in testa, come la lista stessa). */
  years: readonly number[]
  /** Mesi presenti nell'anno selezionato. */
  months: readonly number[]
  activeYear: number | null
  activeMonth: number | null
  onYear: (year: number | null) => void
  onMonth: (month: number | null) => void
}

/**
 * Navigatore per data: chip anno, e sotto i mesi dell'anno selezionato.
 * La riga mesi compare solo con un anno attivo — è da lì che prende il
 * proprio elenco, e un mese senza anno sarebbe ambiguo.
 */
export function DateIndex({ years, months, activeYear, activeMonth, onYear, onMonth }: DateIndexProps) {
  if (years.length === 0) return null
  return (
    <div className={styles.indexBlock}>
      <div className={styles.indexRow} role="group" aria-label="Anno">
        <span className={styles.indexLabel}>Periodo</span>
        <button
          type="button"
          className={`${styles.chip} ${activeYear === null ? styles.chipActive : ''}`}
          aria-pressed={activeYear === null}
          onClick={() => onYear(null)}
        >
          Tutti
        </button>
        {years.map((year) => (
          <button
            key={year}
            type="button"
            className={`${styles.chip} ${activeYear === year ? styles.chipActive : ''}`}
            aria-pressed={activeYear === year}
            onClick={() => onYear(activeYear === year ? null : year)}
          >
            {year}
          </button>
        ))}
      </div>
      {activeYear !== null && months.length > 0 && (
        <div className={styles.indexRow} role="group" aria-label="Mese">
          <span className={styles.indexLabel}>Mese</span>
          <button
            type="button"
            className={`${styles.chip} ${activeMonth === null ? styles.chipActive : ''}`}
            aria-pressed={activeMonth === null}
            onClick={() => onMonth(null)}
          >
            Tutti
          </button>
          {months.map((month) => (
            <button
              key={month}
              type="button"
              className={`${styles.chip} ${activeMonth === month ? styles.chipActive : ''}`}
              aria-pressed={activeMonth === month}
              onClick={() => onMonth(activeMonth === month ? null : month)}
            >
              {MONTH_LABELS[month]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
