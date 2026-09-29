import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderHook, waitFor } from '@testing-library/react'

import { useBlogRoleAccess } from '../../features/blog/use-blog-role'
import { apiRequest } from '../../lib/api'

vi.mock('../../lib/api', () => ({ apiRequest: vi.fn() }))

const authState = { isAuthenticated: true }
vi.mock('../../features/auth/auth-context', () => ({ useAuth: () => authState }))

beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
  authState.isAuthenticated = true
})

const mockRoles = (data: {
  isPlatformAdmin: boolean
  roles: { slug: string; scope: string }[]
}) => {
  vi.mocked(apiRequest).mockResolvedValue(data)
}

describe('useBlogRoleAccess — permessi blog lato UI', () => {
  it('un utente senza ruoli blog non puo\' ne scrivere ne gestire', async () => {
    mockRoles({ isPlatformAdmin: false, roles: [] })

    const { result } = renderHook(() => useBlogRoleAccess())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canWrite).toBe(false)
    expect(result.current.canManage).toBe(false)
  })

  it('writer scrive ma non gestisce (niente pin/categorie/moderazione)', async () => {
    mockRoles({ isPlatformAdmin: false, roles: [{ slug: 'writer', scope: 'platform' }] })

    const { result } = renderHook(() => useBlogRoleAccess())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canWrite).toBe(true)
    expect(result.current.canManage).toBe(false)
  })

  it('blog-admin scrive e gestisce', async () => {
    mockRoles({ isPlatformAdmin: false, roles: [{ slug: 'blog-admin', scope: 'platform' }] })

    const { result } = renderHook(() => useBlogRoleAccess())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canWrite).toBe(true)
    expect(result.current.canManage).toBe(true)
  })

  it('platform-admin ha sempre tutti i permessi blog', async () => {
    mockRoles({ isPlatformAdmin: true, roles: [] })

    const { result } = renderHook(() => useBlogRoleAccess())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canWrite).toBe(true)
    expect(result.current.canManage).toBe(true)
  })

  it('ignora ruoli blog con scope non platform (stesso filtro del guard API)', async () => {
    mockRoles({
      isPlatformAdmin: false,
      roles: [
        { slug: 'blog-admin', scope: 'event' },
        { slug: 'writer', scope: 'stand' },
      ],
    })

    const { result } = renderHook(() => useBlogRoleAccess())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canWrite).toBe(false)
    expect(result.current.canManage).toBe(false)
  })

  it('ospite non chiama l\'API e resta senza permessi', async () => {
    authState.isAuthenticated = false

    const { result } = renderHook(() => useBlogRoleAccess())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(apiRequest).not.toHaveBeenCalled()
    expect(result.current.canWrite).toBe(false)
    expect(result.current.canManage).toBe(false)
  })

  it('se la richiesta fallisce resta senza permessi (fail-closed)', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useBlogRoleAccess())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canWrite).toBe(false)
    expect(result.current.canManage).toBe(false)
  })
})
