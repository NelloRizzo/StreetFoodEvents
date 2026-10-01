import { apiRequest } from './api'

export type MyBadge = {
  type: string
  label: string
  icon: string
  description: string
  lockedHint: string
  earned: boolean
  earnedAt: string | null
  eventId: string | null
  /** 0..target, per i badge con soglia. */
  progress: number
  target: number | null
}

export type BadgeCatalogEntry = Pick<
  MyBadge,
  'type' | 'label' | 'icon' | 'description' | 'lockedHint' | 'target'
>

export type MyBadgesResponse = {
  catalog: BadgeCatalogEntry[]
  badges: MyBadge[]
}

export function fetchMyBadges(): Promise<MyBadgesResponse> {
  return apiRequest<MyBadgesResponse>('/badges/me')
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatEarnedAt(iso: string | null): string {
  if (!iso) return ''
  return dateFmt.format(new Date(iso))
}

/**
 * Testo di progresso per un badge non ancora ottenuto.
 *
 * Restituisce null se non ha una soglia (i badge "una tantum" come "Primo
 * ordine" mostrano solo l'indicazione, non un conteggio da avvicinare).
 */
export function progressLabel(badge: Pick<MyBadge, 'progress' | 'target'>): string | null {
  if (badge.target === null) return null
  const capped = Math.min(badge.progress, badge.target)
  if (badge.progress >= badge.target) return null
  return `${capped} su ${badge.target}`
}
