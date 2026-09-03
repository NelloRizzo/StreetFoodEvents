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

/** Creazione/avvio di un ordine da parte di un cliente. */
export function trackOrderCreated(params: {
  orderId?: string
  eventId?: string
  standId?: string
  items: number
  total: number
  currencyName?: string
  isGift?: boolean
}): void {
  analyticsEvent('sfe_order_created', {
    order_id: params.orderId ?? '',
    event_id: params.eventId ?? '',
    stand_id: params.standId ?? '',
    items: params.items,
    total: params.total,
    currency: params.currencyName ?? '',
    is_gift: Boolean(params.isGift),
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
