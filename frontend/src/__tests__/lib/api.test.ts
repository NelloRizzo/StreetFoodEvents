import { describe, expect, it, vi } from 'vitest'

import { apiRequest } from '../../lib/api'

describe('apiRequest', () => {
  it('sends a GET request and returns parsed JSON', async () => {
    const mockData = { items: [{ id: '1', name: 'Test' }] }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await apiRequest('/events')

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith('/api/events', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('sends a POST with bodyJson', async () => {
    const mockData = { item: { id: '1' } }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
    vi.stubGlobal('fetch', mockFetch)

    const body = { name: 'New Event', currencyName: 'TC' }
    const result = await apiRequest('/events', {
      method: 'POST',
      bodyJson: body,
    })

    expect(result).toEqual(mockData)
    expect(mockFetch).toHaveBeenCalledWith('/api/events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  })

  it('throws on non-ok response with message from server', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Not found' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(apiRequest('/events/invalid')).rejects.toThrow('Not found')
  })

  it('throws a fallback message when server returns no message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(apiRequest('/fail')).rejects.toThrow('Request failed')
  })

  it('throws when json parsing fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(apiRequest('/bad')).rejects.toThrow('Request failed')
  })

  it('attaches credentials include by default', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    await apiRequest('/test')

    const options = mockFetch.mock.calls[0][1]
    expect(options.credentials).toBe('include')
  })
})
