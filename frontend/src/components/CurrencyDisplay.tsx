import type { UploadedImage } from '../lib/upload'
import styles from './CurrencyDisplay.module.scss'

export type EventCurrency = {
  currencyName: string
  currencySymbol?: UploadedImage | null
}

export function currencyInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

export function CurrencyDisplay({
  currencyName,
  currencySymbol,
  className,
}: {
  currencyName: string
  currencySymbol?: UploadedImage | null
  className?: string
}) {
  if (currencySymbol?.url) {
    return (
      <span className={`${styles.currencyIcon} ${styles.currencyImage} ${className ?? ''}`} title={currencyName}>
        <img src={currencySymbol.url} alt={currencyName} className={styles.currencyImg} />
      </span>
    )
  }

  const initial = currencyInitial(currencyName)

  return (
    <span className={`${styles.currencyIcon} ${styles.currencyInitial} ${className ?? ''}`} title={currencyName}>
      {initial}
    </span>
  )
}

export function currencyBadgeHtml(currencyName: string): string {
  const initial = currencyInitial(currencyName)
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;border-radius:50%;border:1.5px solid currentColor;font-size:0.85em;font-weight:700;line-height:1;vertical-align:middle;margin-left:0.15em">${initial}</span>`
}
