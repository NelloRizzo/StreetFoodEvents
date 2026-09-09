import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  computeCouponDiscount,
  couponDescription,
  type AppliedCoupon,
  type CouponLine,
  type PromotionValidation,
  validatePromotionCode,
} from '../lib/promotions'
import { QRScanner } from './QRScanner'
import styles from './CouponPanel.module.scss'

type Props = {
  eventId: string
  standId: string
  currencyName?: string
  coupon: AppliedCoupon | null
  onChange: (coupon: AppliedCoupon | null) => void
  onAlert: (message: string) => void
  payWithCredits: boolean
  creditAmount: number
  lines: CouponLine[]
}

export function CouponPanel({
  eventId,
  standId,
  currencyName,
  coupon,
  onChange,
  onAlert,
  payWithCredits,
  creditAmount,
  lines,
}: Props) {
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [valueCoupon, setValueCoupon] = useState<NonNullable<PromotionValidation['item']> | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  const applyCode = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    setChecking(true)
    setNotice(null)
    setValueCoupon(null)
    try {
      const res = await validatePromotionCode(eventId, { code: trimmed, standId })
      if (res.valid && res.item) {
        if (res.item.type === 'value') {
          setValueCoupon(res.item)
          setCode('')
        } else {
          onChange({ code: res.item.code, item: res.item })
          setCode('')
        }
      } else {
        setNotice(res.message ?? 'Coupon non valido')
        setCode('')
      }
    } catch (e) {
      onAlert(e instanceof Error ? e.message : 'Errore nella verifica del coupon')
    }
    setChecking(false)
  }

  const handleScan = async (text: string) => {
    setShowScanner(false)
    await applyCode(text)
  }

  const conflict = Boolean(
    coupon &&
      coupon.item.type === 'discount' &&
      coupon.item.discountType === 'percent' &&
      payWithCredits &&
      creditAmount > 0,
  )

  const preview = coupon ? computeCouponDiscount(coupon.item, lines) : { discountAmount: 0, freeUnits: 0 }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Coupon</h3>

      {coupon ? (
        <div className={`${styles.applied} ${conflict ? styles.appliedConflict : ''}`}>
          <div className={styles.appliedRow}>
            <span className={styles.appliedLabel}>
              {couponDescription(coupon.item)}
              {coupon.item.title ? ` · ${coupon.item.title}` : ''}
            </span>
            {preview.discountAmount > 0 && (
              <span className={styles.appliedValue}>
                &minus;{preview.discountAmount.toFixed(2)} {currencyName ?? 'crediti'}
              </span>
            )}
            <button type="button" className={styles.removeBtn} onClick={() => onChange(null)} aria-label="Rimuovi coupon">
              &#10005;
            </button>
          </div>
          {conflict && (
            <p className={styles.conflict}>
              Uno sconto percentuale non si combina con un pagamento in crediti: disattiva i crediti o rimuovi il coupon.
            </p>
          )}
        </div>
      ) : valueCoupon ? (
        <div className={styles.valueBox}>
          <span className={styles.valueLabel}>
            {couponDescription(valueCoupon)} &mdash; si riscatta sul portafoglio cliente.
          </span>
          <Link to={`/events/${eventId}/exchange`} className={styles.exchangeLink}>
            Apri Cambio Valuta
          </Link>
        </div>
      ) : (
        <div className={styles.form}>
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void applyCode(code)
            }}
            placeholder="Codice coupon (es. SCONTO10)"
          />
          <button
            type="button"
            className={styles.checkBtn}
            onClick={() => void applyCode(code)}
            disabled={checking}
          >
            {checking ? 'Verifica...' : 'Verifica'}
          </button>
          <button
            type="button"
            className={styles.scanBtn}
            onClick={() => setShowScanner(true)}
            title="Scansiona QR coupon"
          >
            &#128247;
          </button>
          {notice && <p className={styles.notice}>{notice}</p>}
        </div>
      )}

      {showScanner && (
        <QRScanner
          onScan={(text) => void handleScan(text)}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}