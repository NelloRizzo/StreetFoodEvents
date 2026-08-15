import type { GiftStats } from '../lib/orders'
import styles from './GiftCounter.module.scss'

export function GiftCounter({ stats }: { stats: GiftStats | null }) {
  if (!stats || stats.totalOrders === 0) {
    return (
      <span className={`${styles.pill} ${styles.pillOk}`} title="Nessun omaggio registrato">
        Omaggi: 0
      </span>
    )
  }

  const label = `Omaggi: ${stats.giftOrders}/${stats.totalOrders} (${stats.giftPercentage.toFixed(1)}%)`
  const warning = stats.thresholdExceeded

  return (
    <span
      className={`${styles.pill} ${warning ? styles.pillWarning : styles.pillOk}`}
      title={warning
        ? `Superata la soglia del ${stats.giftThreshold}% sul totale ordini`
        : `Soglia ${stats.giftThreshold}% sul totale ordini`}
    >
      {label}
    </span>
  )
}
