import { apiRequest } from './api'

export type FavoriteItem = {
  id: string
  userId: string
  event: { id: string; name: string } | null
  stand: { id: string; name: string; slogan: string | null } | null
  createdAt: string
  updatedAt: string
}

export type FavoritesResponse = {
  items: FavoriteItem[]
}

export type CreateFavoriteInput = {
  eventId?: string
  standId?: string
}

export function fetchFavorites() {
  return apiRequest<FavoritesResponse>('/favorites')
}

export function createFavorite(input: CreateFavoriteInput) {
  return apiRequest<{ item: FavoriteItem }>('/favorites', {
    method: 'POST',
    bodyJson: input,
  })
}

export function deleteFavorite(favId: string) {
  return apiRequest<void>(`/favorites/${favId}`, { method: 'DELETE' })
}
