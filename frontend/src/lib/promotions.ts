import { apiRequest } from './api'

export type PromotionType = 'discount' | 'product' | 'value'

export type PromotionFormula = { paid: number; total: number }

export type Promotion = {
  id: string
  eventId: string
  standId: string | null
  code: string
  title: string | null
  type: PromotionType
  typeLabel: string
  discountType: 'percent' | 'fixed' | null
  discountValue: number | null
  eventProductId: string | null
  formula: PromotionFormula | null
  formulaMaxFree: number | null
  valueAmount: number | null
  maxPresentations: number | null
  perUserLimit: number | null
  usedCount: number
  remainingPresentations: number | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  qrCode?: string | null
}

export type PromotionUsage = {
  id: string
  promotionId: string
  code: string
  eventId: string
  orderId: string | null
  eventUserId: string | null
  type: string
  discountAmount: number
  freeUnits: number
  valueAmount: number
  appliedBy: string | null
  createdAt: string
}

export type PromotionValidation = {
  valid: boolean
  message?: string
  item?: {
    id: string
    code: string
    type: PromotionType
    typeLabel: string
    title: string | null
    discountType: 'percent' | 'fixed' | null
    discountValue: number | null
    eventProductId: string | null
    productName: string | null
    formula: PromotionFormula | null
    formulaMaxFree: number | null
    valueAmount: number | null
    remainingPresentations: number | null
    remainingPerUser: number | null
    expiresAt: string | null
  }
}

export type CreatePromotionInput = {
  code: string
  title?: string | null
  type: PromotionType
  standId?: string | null
  discountType?: 'percent' | 'fixed' | null
  discountValue?: number | null
  eventProductId?: string | null
  formula?: PromotionFormula | null
  formulaMaxFree?: number | null
  valueAmount?: number | null
  maxPresentations?: number | null
  perUserLimit?: number | null
  expiresAt?: string | null
  isActive?: boolean
}

export type AppliedCoupon = {
  code: string
  item: NonNullable<PromotionValidation['item']>
}

export function fetchPromotions(eventId: string) {
  return apiRequest<{ items: Promotion[] }>(`/events/${eventId}/promotions`)
}

export function fetchPromotion(eventId: string, promotionId: string) {
  return apiRequest<{ item: Promotion }>(`/events/${eventId}/promotions/${promotionId}`)
}

export function createPromotion(eventId: string, input: CreatePromotionInput) {
  return apiRequest<{ item: Promotion }>(`/events/${eventId}/promotions`, {
    method: 'POST',
    bodyJson: input,
  })
}

export function updatePromotion(eventId: string, promotionId: string, input: Partial<CreatePromotionInput>) {
  return apiRequest<{ item: Promotion }>(`/events/${eventId}/promotions/${promotionId}`, {
    method: 'PATCH',
    bodyJson: input,
  })
}

export function deletePromotion(eventId: string, promotionId: string) {
  return apiRequest<{ message: string }>(`/events/${eventId}/promotions/${promotionId}`, {
    method: 'DELETE',
  })
}

export function fetchPromotionUsage(eventId: string, promotionId: string) {
  return apiRequest<{ items: PromotionUsage[] }>(`/events/${eventId}/promotions/${promotionId}/usage`)
}

export function validatePromotionCode(
  eventId: string,
  input: { code: string; standId?: string; customerId?: string },
) {
  return apiRequest<PromotionValidation>(`/events/${eventId}/promotions/validate`, {
    method: 'POST',
    bodyJson: input,
  })
}

export function redeemValuePromotion(eventId: string, input: { code: string; eventUserId: string }) {
  return apiRequest<{ item: { balance: number; eventUserId: string; amount: number } }>(
    `/events/${eventId}/promotions/redeem-value`,
    {
      method: 'POST',
      bodyJson: input,
    },
  )
}

export function formulaLabel(formula: PromotionFormula | null | undefined): string {
  if (!formula) return 'regalo semplice'
  return `${formula.total}x${formula.paid}`
}

export function couponDescription(c: Pick<Promotion, 'type' | 'discountType' | 'discountValue' | 'eventProductId' | 'formula' | 'formulaMaxFree' | 'valueAmount'>, productName?: string | null): string {
  switch (c.type) {
    case 'discount':
      if (c.discountType === 'fixed') return `Sconto importo fisso ${(c.discountValue ?? 0).toFixed(2)}`
      return `Sconto ${c.discountValue ?? 0}%`
    case 'product':
      return productName ? `${productName} gratis (${formulaLabel(c.formula)})` : `Prodotto gratis (${formulaLabel(c.formula)})`
    case 'value':
      return `Buono valore ${(c.valueAmount ?? 0).toFixed(2)}`
    default:
      return c.type
  }
}

export type CouponLine = {
  eventProductId: string
  quantity: number
  unitPrice: number
  subtotal: number
}

type Round2 = (n: number) => number
const round2: Round2 = (n) => Math.round(n * 100) / 100

/**
 * Anteprima dello sconto applicato (specchio della logica server).
 * Restituisce quanto verrà scalato dal totale e i pezzi gratis.
 */
export function computeCouponDiscount(
  coupon: Pick<Promotion, 'type' | 'discountType' | 'discountValue' | 'eventProductId' | 'formula' | 'formulaMaxFree'>,
  lines: CouponLine[],
): { discountAmount: number; freeUnits: number } {
  if (coupon.type === 'discount') {
    const total = lines.reduce((sum, line) => sum + line.subtotal, 0)
    const raw =
      coupon.discountType === 'percent'
        ? (total * (coupon.discountValue ?? 0)) / 100
        : coupon.discountValue ?? 0
    return { discountAmount: round2(Math.min(raw, total)), freeUnits: 0 }
  }

  if (coupon.type === 'product' && coupon.eventProductId) {
    const matching = lines.filter((line) => line.eventProductId === coupon.eventProductId)
    if (matching.length === 0) {
      return { discountAmount: 0, freeUnits: 0 }
    }

    let totalFree = 0
    let discount = 0
    let remainingCap = coupon.formulaMaxFree != null ? coupon.formulaMaxFree : Number.POSITIVE_INFINITY

    for (const it of matching) {
      const qty = it.quantity
      let freeUnits
      if (coupon.formula) {
        const groups = Math.floor(qty / coupon.formula.total)
        freeUnits = groups * (coupon.formula.total - coupon.formula.paid)
      } else if (remainingCap !== Number.POSITIVE_INFINITY && qty >= remainingCap) {
        freeUnits = remainingCap
      } else {
        freeUnits = qty
      }

      if (freeUnits >= remainingCap) {
        freeUnits = remainingCap
      }
      if (remainingCap !== Number.POSITIVE_INFINITY) {
        remainingCap -= freeUnits
      }
      freeUnits = Math.max(0, Math.min(freeUnits, qty))
      discount += round2(it.unitPrice * freeUnits)
      totalFree += freeUnits
    }

    return { discountAmount: round2(discount), freeUnits: totalFree }
  }

  return { discountAmount: 0, freeUnits: 0 }
}