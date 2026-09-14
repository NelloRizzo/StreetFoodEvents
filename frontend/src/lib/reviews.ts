import { apiRequest } from './api'

export type Review = {
  id: string
  eventId: string
  standId: string | null
  rating: number
  comment: string | null
  reviewerName: string | null
  isVerified: boolean
  status: 'visible' | 'hidden'
  createdAt: string
}

export type AdminReview = Review & {
  reviewerEmail: string | null
  hasGuest: boolean
}

export type TargetSummary = {
  count: number
  avg: number | null
}

export type StandSummary = {
  standId: string
  count: number
  avg: number | null
}

export type ReviewsSummary = {
  event: TargetSummary
  stands: StandSummary[]
}

type Paginated<T> = {
  items: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const GUEST_TOKEN_PREFIX = 'reviewGuestToken:'

export function getReviewGuestToken(eventId: string): string | null {
  return localStorage.getItem(`${GUEST_TOKEN_PREFIX}${eventId}`)
}

export function saveReviewGuestToken(eventId: string, token: string) {
  localStorage.setItem(`${GUEST_TOKEN_PREFIX}${eventId}`, token)
}

function guestHeaders(eventId?: string): Record<string, string> {
  if (!eventId) return {}
  const token = getReviewGuestToken(eventId)
  return token ? { 'x-access-token': token } : {}
}

export async function fetchEventReviews(
  eventId: string,
  options: { standId?: string | null; page?: number; limit?: number } = {},
): Promise<Paginated<Review>> {
  const params = new URLSearchParams()
  params.set('page', String(options.page ?? 1))
  params.set('limit', String(options.limit ?? 20))
  if (options.standId) params.set('standId', options.standId)
  const data = await apiRequest<Paginated<Review>>(`/events/${eventId}/reviews?${params.toString()}`)
  return data
}

export async function fetchReviewsSummary(eventId: string, standId?: string | null): Promise<ReviewsSummary> {
  const suffix = standId ? `?standId=${standId}` : ''
  const data = await apiRequest<ReviewsSummary>(`/events/${eventId}/reviews/summary${suffix}`)
  return data
}

export async function fetchMyReviews(eventId: string): Promise<{ items: Review[] }> {
  const data = await apiRequest<{ items: Review[] }>(`/events/${eventId}/reviews/mine`, {
    headers: guestHeaders(eventId),
  })
  return data
}

export type SubmitReviewInput = {
  standId?: string | null
  rating: number
  comment?: string | null
  reviewerName?: string | null
  reviewerEmail?: string | null
}

export async function submitReview(
  eventId: string,
  input: SubmitReviewInput,
): Promise<{ item: Review; guestToken?: string }> {
  const data = await apiRequest<{ item: Review; guestToken?: string }>(
    `/events/${eventId}/reviews`,
    {
      method: 'POST',
      bodyJson: input,
      headers: guestHeaders(eventId),
    },
  )
  if (data.guestToken) saveReviewGuestToken(eventId, data.guestToken)
  return data
}

export async function fetchManageReviews(
  eventId: string,
  options: { standId?: string; status?: 'visible' | 'hidden'; page?: number } = {},
): Promise<Paginated<AdminReview>> {
  const params = new URLSearchParams()
  params.set('page', String(options.page ?? 1))
  if (options.standId) params.set('standId', options.standId)
  if (options.status) params.set('status', options.status)
  const data = await apiRequest<Paginated<AdminReview>>(`/events/${eventId}/reviews/manage?${params.toString()}`)
  return data
}

export async function updateReviewStatus(
  eventId: string,
  reviewId: string,
  status: 'visible' | 'hidden',
): Promise<AdminReview> {
  const data = await apiRequest<{ item: AdminReview }>(`/events/${eventId}/reviews/${reviewId}`, {
    method: 'PATCH',
    bodyJson: { status },
  })
  return data.item
}

export async function deleteReview(eventId: string, reviewId: string): Promise<void> {
  await apiRequest(`/events/${eventId}/reviews/${reviewId}`, { method: 'DELETE' })
}