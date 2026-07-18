import { apiRequest } from './api'

export type ContestPOI = {
  id: string
  eventId: string
  name: string
  hint: string | null
  sequenceOrder: number
}

export type Contest = {
  id: string
  eventId: string
  name: string
  description: string | null
  startsAt: string
  endsAt: string
  durationMinutes: number
  requireSequence: boolean
  prize: string | null
  isActive: boolean
  orderedPOIIds: string[]
}

export type ContestWithPois = Contest & {
  pois: { id: string; name: string; hint: string | null }[]
}

export type Participation = {
  id: string
  contestId: string
  participantId: string
  scannedPOIIds: string[]
  startedAt: string
  completedAt: string | null
  isWinner: boolean | null
  prizeAwarded: boolean
  deviceName: string | null
}

export type PoiQrCode = {
  poiId: string
  poiName: string
  qrCode: string
}

// ── Contest POI API ──

export function listContestPois(eventId: string) {
  return apiRequest<{ items: ContestPOI[] }>(`/contests/contest-pois?eventId=${eventId}`)
}

export function createContestPoi(data: { eventId: string; name: string; hint?: string | null }) {
  return apiRequest<{ item: ContestPOI }>('/contests/contest-pois', {
    method: 'POST',
    bodyJson: data,
  })
}

export function updateContestPoi(poiId: string, data: { name?: string; hint?: string | null; sequenceOrder?: number }) {
  return apiRequest<{ item: ContestPOI }>(`/contests/contest-pois/${poiId}`, {
    method: 'PATCH',
    bodyJson: data,
  })
}

export function deleteContestPoi(poiId: string) {
  return apiRequest<void>(`/contests/contest-pois/${poiId}`, {
    method: 'DELETE',
  })
}

// ── Contest API ──

export function listContests(eventId?: string) {
  const qs = eventId ? `?eventId=${eventId}` : ''
  return apiRequest<{ items: Contest[] }>(`/contests${qs}`)
}

export function getContest(contestId: string) {
  return apiRequest<{ item: Contest; pois: { id: string; name: string; hint: string | null }[] }>(`/contests/${contestId}`)
}

export function createContest(data: {
  eventId: string
  name: string
  description?: string | null
  startsAt: string
  endsAt: string
  durationMinutes: number
  requireSequence?: boolean
  prize?: string | null
  isActive?: boolean
  orderedPOIIds?: string[]
}) {
  return apiRequest<{ item: Contest }>('/contests', {
    method: 'POST',
    bodyJson: data,
  })
}

export function updateContest(contestId: string, data: Partial<{
  name: string
  description: string | null
  startsAt: string
  endsAt: string
  durationMinutes: number
  requireSequence: boolean
  prize: string | null
  isActive: boolean
  orderedPOIIds: string[]
}>) {
  return apiRequest<{ item: Contest }>(`/contests/${contestId}`, {
    method: 'PATCH',
    bodyJson: data,
  })
}

export function deleteContest(contestId: string) {
  return apiRequest<void>(`/contests/${contestId}`, { method: 'DELETE' })
}

// ── Scan & Participation ──

export function registerScan(contestId: string, participantId: string, poiId: string) {
  return apiRequest<Participation>(`/contests/${contestId}/scan`, {
    method: 'POST',
    bodyJson: { participantId, poiId },
  })
}

export function getParticipation(contestId: string, participantId: string) {
  return apiRequest<Participation>(`/contests/${contestId}/participation/${participantId}`)
}

export function awardPrize(contestId: string, participantId: string) {
  return apiRequest<Participation>(`/contests/${contestId}/participation/${participantId}/award`, {
    method: 'PATCH',
  })
}

// ── QR Codes ──

export function getContestPoiQrCodes(contestId: string) {
  return apiRequest<{ items: PoiQrCode[] }>(`/contests/${contestId}/poi-qrcodes`)
}
