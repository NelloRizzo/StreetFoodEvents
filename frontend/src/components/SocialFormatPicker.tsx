import { POSTER_FORMATS, type PosterFormatId } from '../lib/socialCanvas'
import { formatSizeLabel } from '../lib/useSocialFormat'
import styles from './SocialExport.module.scss'

type Props = {
  format: PosterFormatId
  onChange: (format: PosterFormatId) => void
}

/** Scelta del formato, identica nei due export.
 *
 *  Non è una decorazione: un'immagine 4:5 caricata in una storia viene
 *  ritagliata via il footer con il QR, quindi serve scegliere. I due bottoni
 *  sono `aria-pressed` (e non radio) perche' il posto del formato scelto è
 *  leggibile anche senza colori, mentre l'etichetta sola dice "4:5", che
 *  non dice nulla a chi non conosce le proporzioni. */
export function SocialFormatPicker({ format, onChange }: Props) {
  return (
    <div className={styles.formatRow} role="group" aria-label="Formato immagine">
      <span className={styles.formatLabel}>Formato</span>
      {(Object.keys(POSTER_FORMATS) as PosterFormatId[]).map((id) => {
        const f = POSTER_FORMATS[id]
        const active = id === format
        return (
          <button
            key={id}
            type="button"
            className={`${styles.formatBtn} ${active ? styles.formatBtnOn : ''}`}
            aria-pressed={active}
            onClick={() => onChange(id)}
          >
            <strong>{f.label}</strong>
            <span>{f.hint}</span>
            <em>{formatSizeLabel(id)}</em>
          </button>
        )
      })}
    </div>
  )
}