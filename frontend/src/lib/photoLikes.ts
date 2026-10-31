import { apiRequest } from './api'

/* «Mi piace» della galleria.
 *
 * Un like per foto e per dispositivo (identita' in localStorage, la stessa dei
 * voti del contest): il conteggio e' pubblico, `liked` dipende dal deviceId.
 * Ripremere il cuore toglie il like: e' un toggle, non un'azione irreversibile.
 */
export type PhotoLikeInfo = {
  likeCount: number
  liked: boolean
  rank: number | null
}

export function togglePhotoLike(eventId: string, photoId: string, deviceId: string) {
  return apiRequest<{ liked: boolean; likeCount: number }>(`/events/${eventId}/photos/${photoId}/like`, {
    method: 'POST',
    bodyJson: { deviceId },
  })
}

const MEDALS: Record<number, string> = {
  1: '\u{1F947}',
  2: '\u{1F948}',
  3: '\u{1F949}',
}

/** Medaglia per il gradino (con gli ex aequo sullo stesso gradino). */
export function medalForRank(rank: number | null): string | null {
  if (!rank) return null
  return MEDALS[rank] ?? null
}
