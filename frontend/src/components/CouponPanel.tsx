import { useState } from 'react'
import { Link } from 'react-router-dom'

import { trackCouponApplied } from '../lib/analytics'
import {
  computeCouponDiscount,
  couponDescription,
  redeemValuePromotion,
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
  customerUserId?: string
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
  customerUserId,
}: Props) {
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [valueCoupon, setValueCoupon] = useState<NonNullable<PromotionValidation['item']> | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemSuccess, setRedeemSuccess] = useState<{ code: string; amount: number; balance: number } | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  const applyCode = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    setChecking(true)
    setNotice(null)
    setValueCoupon(null)
    setRedeemSuccess(null)
    try {
      const res = await validatePromotionCode(eventId, { code: trimmed, standId })
      if (res.valid && res.item) {
        if (res.item.type === 'value') {
          setValueCoupon(res.item)
          setCode('')
        } else {
          onChange({ code: res.item.code, item: res.item })
          const discount = computeCouponDiscount(res.item, lines)
          trackCouponApplied({
            eventId,
            standId,
            code: res.item.code,
            type: res.item.type,
            discountType: res.item.discountType,
            discountAmount: discount.discountAmount,
            freeUnits: discount.freeUnits,
          })
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

  const handleRedeemValue = async () => {
    if (!valueCoupon || !customerUserId) return
    const label = couponDescription(valueCoupon)
    if (
      !window.confirm(
        `Riscattare ${label} accreditando ${(valueCoupon.valueAmount ?? 0).toFixed(2)} ${currencyName ?? 'crediti'} sul portafoglio del cliente selezionato?`,
      )
    ) {
      return
    }
    setRedeeming(true)
    setNotice(null)
    try {
      const res = await redeemValuePromotion(eventId, { code: valueCoupon.code, userId: customerUserId })
      setRedeemSuccess({
        code: res.item.code,
        amount: res.item.valueAmount,
        balance: res.item.balance,
      })
      setValueCoupon(null)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Riscatto non riuscito')
    }
    setRedeeming(false)
  }

  const conflict = Boolean(
    coupon &&
      coupon.item.type === 'discount' &&
      coupon.item.discountType === 'percent' &&
      payWithCredits &&
      creditAmount > 0,
  )

  const preview = coupon ? computeCouponDiscount(coupon.item, lines) : { discountAmount: 0, freeUnits: 0 }
  const productNotInCart =
    coupon?.item.type === 'product' && preview.discountAmount === 0 && preview.freeUnits === 0

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
          {productNotInCart && (
            <p className={styles.productHint}>
              Aggiungi al carrello &ldquo;{coupon.item.productName ?? 'il prodotto dedicato'}&rdquo; per applicare
              l&apos;omaggio.
            </p>
          )}
        </div>
      ) : redeemSuccess ? (
        <div className={styles.valueBox}>
          <span className={styles.valueLabel}>
            Buono valore {redeemSuccess.amount.toFixed(2)} {currencyName ?? 'crediti'} riscattato sul portafoglio del
            cliente. Nuovo saldo: <strong>{redeemSuccess.balance.toFixed(2)}</strong> {currencyName ?? 'crediti'}.
          </span>
          <button type="button" className={styles.redeemBtn} onClick={() => setRedeemSuccess(null)}>
            Ok
          </button>
        </div>
      ) : valueCoupon ? (
        <div className={styles.valueBox}>
          <span className={styles.valueLabel}>
            {couponDescription(valueCoupon)} &mdash; si riscatta sul portafoglio cliente, non su un ordine.
          </span>
          {customerUserId ? (
            <button
              type="button"
              className={styles.redeemBtn}
              disabled={redeeming}
              onClick={() => void handleRedeemValue()}
            >
              {redeeming ? 'Riscatto...' : 'Riscatta sul portafoglio del cliente selezionato'}
            </button>
          ) : (
            <span className={styles.valueHint}>Seleziona un cliente per riscattare il buono sul suo portafoglio.</span>
          )}
          <Link
            to={`/admin/events/${eventId}/exchange`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.exchangeLink}
          >
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