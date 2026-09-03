import { pushToDataLayer } from './gtm'

/**
 * Eventi analytics custom inviati a Google Tag Manager tramite dataLayer.
 * Il tag GA4 (o il tag eventi) in GTM deve ascoltare questi nomi evento.
 */

export function analyticsEvent(
  name: string,
  params?: Record<string, string | number | boolean | null>,
): void {
  pushToDataLayer({
    event: name,
    ...(params ?? {}),
  })
}

export type OrderAnalyticsProduct = {
  productName: string
  quantity: number
  unitPrice: number
}

/** Creazione/avvio di un ordine da parte di un cliente. */
export function trackOrderCreated(params: {
  orderId?: string
  eventId?: string
  standId?: string
  eventName?: string
  standName?: string
  items: number
  total: number
  currencyName?: string
  isGift?: boolean
  products?: OrderAnalyticsProduct[]
}): void {
  analyticsEvent('sfe_order_created', {
    order_id: params.orderId ?? '',
    event_id: params.eventId ?? '',
    stand_id: params.standId ?? '',
    event_name: params.eventName ?? '',
    stand_name: params.standName ?? '',
    items: params.items,
    total: params.total,
    currency: params.currencyName ?? '',
    is_gift: Boolean(params.isGift),
    product_names: (params.products ?? []).map((p) => p.productName).join('|'),
    product_quantities: (params.products ?? []).map((p) => p.quantity).join('|'),
    product_prices: (params.products ?? []).map((p) => p.unitPrice).join('|'),
  })
}

/** Cambio valuta (top-up o refund) nella cassa cambio. */
export function trackCurrencyExchange(params: {
  eventId?: string
  amount: number
  type: 'topup' | 'refund'
}): void {
  analyticsEvent('sfe_currency_exchange', {
    event_id: params.eventId ?? '',
    amount: params.amount,
    exchange_type: params.type,
  })
}

/** Scansione di un POI durante una partecipazione al contest. */
export function trackPoiScanned(params: {
  contestId?: string
  participantId?: string
}): void {
  analyticsEvent('sfe_poi_scanned', {
    contest_id: params.contestId ?? '',
    participant_id: params.participantId ?? '',
  })
}

/** Invio di una o più foto via email dalla galleria. */
export function trackPhotosEmailSent(params: { eventId?: string; count: number }): void {
  analyticsEvent('sfe_photos_email_sent', {
    event_id: params.eventId ?? '',
    photos_count: params.count,
  })
}

/** Ordine creato dalla cassa cassiere. */
export function trackCashierOrderCreated(params: {
  orderId?: string
  eventId?: string
  standId?: string
  eventName?: string
  standName?: string
  items: number
  total: number
  currency?: string
  isGift?: boolean
  paidOnCreate: boolean
}): void {
  analyticsEvent('sfe_cashier_order_created', {
    order_id: params.orderId ?? '',
    event_id: params.eventId ?? '',
    stand_id: params.standId ?? '',
    event_name: params.eventName ?? '',
    stand_name: params.standName ?? '',
    items: params.items,
    total: params.total,
    currency: params.currency ?? '',
    is_gift: Boolean(params.isGift),
    paid_on_create: Boolean(params.paidOnCreate),
  })
}

/** Incasso/pagamento di un ordine. */
export function trackCashierPayment(params: {
  orderId?: string
  eventId?: string
  standId?: string
  amount: number
  currency?: string
  method?: string
}): void {
  analyticsEvent('sfe_cashier_payment', {
    order_id: params.orderId ?? '',
    event_id: params.eventId ?? '',
    stand_id: params.standId ?? '',
    amount: params.amount,
    currency: params.currency ?? '',
    payment_method: params.method ?? '',
  })
}

/** Avanzamento di stato di un ordine (preparing/ready/completed). */
export function trackOrderStatusUpdate(params: {
  orderId?: string
  eventId?: string
  standId?: string
  fromStatus?: string
  toStatus: string
}): void {
  analyticsEvent('sfe_order_status_update', {
    order_id: params.orderId ?? '',
    event_id: params.eventId ?? '',
    stand_id: params.standId ?? '',
    from_status: params.fromStatus ?? '',
    to_status: params.toStatus,
  })
}

/** Preparazione postazione: articolo o intera postazione resa "pronta". */
export function trackStationReady(params: {
  orderId?: string
  eventId?: string
  standId?: string
  stationId?: string
  itemCount: number
}): void {
  analyticsEvent('sfe_station_ready', {
    order_id: params.orderId ?? '',
    event_id: params.eventId ?? '',
    stand_id: params.standId ?? '',
    station_id: params.stationId ?? '',
    item_count: params.itemCount,
  })
}

