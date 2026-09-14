import styles from './RatingStars.module.scss'

type Props = {
  value: number | null
  onChange?: (value: number) => void
  size?: number
}

export function RatingStars({ value, onChange, size = 20 }: Props) {
  const interactive = !!onChange

  return (
    <span
      className={styles.wrap}
      role={interactive ? 'radiogroup' : undefined}
      aria-label="Valutazione in stelle"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          role={interactive ? 'radio' : undefined}
          aria-checked={interactive ? n === value : undefined}
          aria-label={`${n} ${n === 1 ? 'stella' : 'stelle'}`}
          className={`${styles.star} ${value != null && n <= value ? styles.filled : ''}`}
          style={{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }}
          onClick={() => onChange?.(n)}
        >
          ★
        </button>
      ))}
    </span>
  )
}