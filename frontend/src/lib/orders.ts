import { apiRequest } from './api'

export type OrderItem = {
  eventProductId: string
  productId: string
  productName: string
  stationId: string
  stationName: string
  quantity: number
  unitPrice: number
  subtotal: number
  ready: boolean
  notes: string | null
}

export type Order = {
  id: string
  eventId: string
  standId: string
  orderNumber: number
  userId: string
  customerId: string | null
  customerName: string | null
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
  items: OrderItem[]
  total: number
  creditAmountUsed: number
  paymentStatus: 'unpaid' | 'paid' | 'refunded'
  paidAt: string | null
  paymentTransactionId: string | null
  performedByUserId: string | null
  notes: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  receiptQrCode?: string | null
}

export type CreateOrderInput = {
  eventId: string
  standId: string
  customerId?: string
  customerName?: string
  items: Array<{
    eventProductId: string
    stationId: string
    quantity: number
    notes?: string
  }>
  paymentOnCreate?: boolean | { creditAmount: number }
  notes?: string
}

export type StandReport = {
  standId: string
  eventId: string | null
  summary: {
    totalOrders: number
    totalRevenue: number
    totalCreditRevenue: number
    cashRevenue: number
    totalExternalRevenue: number
    totalRefunded: number
  }
  statusBreakdown: Array<{ status: string; count: number }>
  orders: Order[]
  pendingOrders: Order[]
}

export type EventReportStand = {
  standId: string
  standName: string
  totalOrders: number
  paidOrders: number
  totalRevenue: number
  cashRevenue: number
  creditRevenue: number
  pendingOrders: number
  pendingAmount: number
  refundedAmount: number
  paymentMethods: {
    cash: number
    credits: number
    mixed: number
  }
}

export type EventReport = {
  eventId: string
  eventName: string
  unifiedCashierEnabled: boolean
  cashPaymentsEnabled: boolean
  currencyName: string
  stands: EventReportStand[]
  totals: {
    totalOrders: number
    paidOrders: number
    totalRevenue: number
    cashRevenue: number
    creditRevenue: number
    pendingOrders: number
    pendingAmount: number
    refundedAmount: number
  }
}

export function fetchOrders(params?: { eventId?: string; standId?: string; status?: string; userId?: string; customerId?: string; stationId?: string; startDate?: string; endDate?: string }) {
  const query = new URLSearchParams()
  if (params?.eventId) query.set('eventId', params.eventId)
  if (params?.standId) query.set('standId', params.standId)
  if (params?.status) query.set('status', params.status)
  if (params?.userId) query.set('userId', params.userId)
  if (params?.customerId) query.set('customerId', params.customerId)
  if (params?.stationId) query.set('stationId', params.stationId)
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  const qs = query.toString()
  return apiRequest<{ items: Order[] }>(`/orders${qs ? `?${qs}` : ''}`)
}

export function fetchOrder(orderId: string) {
  return apiRequest<{ item: Order }>(`/orders/${orderId}`)
}

export function createOrder(input: CreateOrderInput) {
  return apiRequest<{ item: Order }>('/orders', {
    method: 'POST',
    bodyJson: input,
  })
}

export function updateOrderStatus(orderId: string, status: string, reason?: string) {
  return apiRequest<{ item: Order }>(`/orders/${orderId}/status`, {
    method: 'PATCH',
    bodyJson: { status, reason },
  })
}

export function cancelOrder(orderId: string, reason?: string) {
  return apiRequest<{ item: Order }>(`/orders/${orderId}/cancel`, {
    method: 'POST',
    bodyJson: { reason },
  })
}

export function cancelOrderItems(orderId: string, itemIds: string[]) {
  return apiRequest<{ item: Order }>(`/orders/${orderId}/cancel-items`, {
    method: 'PATCH',
    bodyJson: { itemIds },
  })
}

export function payOrder(orderId: string, creditAmount?: number, useEventCredits?: boolean) {
  return apiRequest<{ item: Order }>(`/orders/${orderId}/pay`, {
    method: 'POST',
    bodyJson: { creditAmount, useEventCredits },
  })
}

export function markStationReady(orderId: string, stationId: string) {
  return apiRequest<{ item: Order }>(`/orders/${orderId}/mark-station-ready`, {
    method: 'PATCH',
    bodyJson: { stationId },
  })
}

export function markItemReady(orderId: string, eventProductId: string) {
  return apiRequest<{ item: Order }>(`/orders/${orderId}/mark-item-ready`, {
    method: 'PATCH',
    bodyJson: { eventProductId },
  })
}

export function deleteEventOrders(eventId: string) {
  return apiRequest<{ message: string }>(`/orders/event/${eventId}`, { method: 'DELETE' })
}

export function deleteStandOrders(standId: string) {
  return apiRequest<{ message: string }>(`/orders/stand/${standId}`, { method: 'DELETE' })
}

export function resetOrderCounter(standId: string) {
  return apiRequest<{ message: string }>('/orders/reset-counter', {
    method: 'POST',
    bodyJson: { standId },
  })
}

export function fetchStandReport(standId: string, eventId?: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  if (eventId) params.set('eventId', eventId)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const qs = params.toString()
  return apiRequest<StandReport>(`/orders/report/stand/${standId}${qs ? `?${qs}` : ''}`)
}

export function fetchEventReport(eventId: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const qs = params.toString()
  return apiRequest<EventReport>(`/orders/report/event/${eventId}${qs ? `?${qs}` : ''}`)
}
