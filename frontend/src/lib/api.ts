const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

type ApiRequestOptions = RequestInit & {
  bodyJson?: unknown
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { bodyJson, headers, ...restOptions } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: bodyJson === undefined ? restOptions.body : JSON.stringify(bodyJson),
  })

  const payload = (await response.json().catch(() => null)) as { message?: string } | null

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Request failed')
  }

  return payload as T
}
