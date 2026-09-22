import { apiRequest } from './api'

export type VisitorCategoryEstimate = {
  label: string
  quantity: number
  coefficient: number
  estimatedVisitors: number
}

export type VisitorStandEstimate = {
  standId: string
  standName: string
  number: number | null
  hasOrders: boolean
  ordersCount: number
  distinctCustomers: number
  categories: VisitorCategoryEstimate[]
  estimatedVisitorsTotal: number
}

export type VisitorsEstimate = {
  eventId: string
  eventName: string
  currencyName: string
  currencySymbol: { url: string } | null
  exchangeRate: number
  window: { from: string; to: string }
  coefficientMap: Record<string, number>
  defaultCoefficient: number
  tokensPerVisitor: number
  totals: {
    productEstimated: number
    tokenBasedEstimated: number
    distinctTokenBuyers: number
    distinctOrderCustomers: number
    nonCancelledOrders: number
    netTokensSold: number
  }
  stands: VisitorStandEstimate[]
}

export function fetchVisitorsEstimate(
  eventId: string,
  from?: string,
  to?: string,
  standId?: string,
) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (standId) params.set('standId', standId)
  const qs = params.toString()
  return apiRequest<VisitorsEstimate>(`/events/${eventId}/visitors${qs ? `?${qs}` : ''}`)
}