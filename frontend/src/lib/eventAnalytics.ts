import { apiRequest } from './api'

export type AnalyticsHourBucket = {
  /** Inizio del bucket in ora UTC, serializzato ISO. */
  bucketStart: string
  orders: number
  quantity: number
  /** Fatturato in crediti dell'evento. */
  revenue: number
}

export type AnalyticsTopProduct = {
  eventProductId: string
  productName: string
  standId: string
  standName: string
  number: number | null
  quantity: number
  revenue: number
}

export type AnalyticsPrepBucket = {
  label: string
  count: number
}

export type AnalyticsStandRow = {
  standId: string
  standName: string
  number: number | null
  /** null se lo stand non ha una posizione per questo evento. */
  location: { lat: number; lng: number } | null
  orders: number
  quantity: number
  revenue: number
  creditRevenue: number
  posRevenue: number
  cashRevenue: number
  prepOrders: number
  /** Secondi; null se nessun ordine di questo stand è arrivato a "pronto". */
  avgPrepSeconds: number | null
}

export type EventAnalytics = {
  eventId: string
  eventName: string
  currencyName: string
  currencySymbol: { url: string; publicId: string } | null
  exchangeRate: number
  window: { from: string; to: string }
  totals: {
    orders: number
    quantity: number
    revenue: number
    creditRevenue: number
    posRevenue: number
    cashRevenue: number
    avgOrderValue: number
    distinctCustomers: number
    giftOrders: number
    prepOrders: number
    avgPrepSeconds: number | null
  }
  hourly: AnalyticsHourBucket[]
  topProducts: AnalyticsTopProduct[]
  prepBuckets: AnalyticsPrepBucket[]
  byStand: AnalyticsStandRow[]
}

export function fetchEventAnalytics(
  eventId: string,
  from?: string,
  to?: string,
): Promise<EventAnalytics> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return apiRequest<EventAnalytics>(`/events/${eventId}/analytics${qs ? `?${qs}` : ''}`)
}

/**
 * Etichetta oraria in ora LOCALE.
 *
 * Il backend allinea i bucket sull'ora UTC e restituisce `bucketStart`: è il
 * frontend che lo converte, perché l'operatore sta sul fuso dell'evento. Se il
 * backend raggruppassasse per `$hour` e rimandasse un numero 0-23, la
 * distribuzione sarebbe spostata di due ore su un evento italiano.
 */
export function formatHourLabel(bucketStart: string): string {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })
    .format(new Date(bucketStart))
}

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`
}