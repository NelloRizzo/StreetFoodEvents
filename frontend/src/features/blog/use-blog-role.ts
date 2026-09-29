import { useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { apiRequest } from '../../lib/api'

/* writer           -> scrive e modifica le notizie
 * blog-admin       -> + pin, eliminazione, categorie, moderazione commenti
 * platform-admin   -> tutto
 * Gli stessi ruoli del guard lato API: questo hook serve solo a nascondere
 * i controlli non disponibili, non a proteggere (quello lo fa l'API). */
const WRITE_ROLES = ['writer', 'blog-admin']
const MANAGE_ROLES = ['blog-admin']

export type BlogRoleAccess = {
  canWrite: boolean
  canManage: boolean
  isLoading: boolean
}

export function useBlogRoleAccess(): BlogRoleAccess {
  const { isAuthenticated } = useAuth()
  const [access, setAccess] = useState({ canWrite: false, canManage: false, isLoading: true })

  useEffect(() => {
    if (!isAuthenticated) {
      setAccess({ canWrite: false, canManage: false, isLoading: false })
      return
    }

    let cancelled = false
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string }[] }>('/auth/me/roles')
      .then((data) => {
        if (cancelled) return
        const platform = data.roles.filter((r) => r.scope === 'platform').map((r) => r.slug)
        setAccess({
          canWrite: data.isPlatformAdmin || platform.some((slug) => WRITE_ROLES.includes(slug)),
          canManage: data.isPlatformAdmin || platform.some((slug) => MANAGE_ROLES.includes(slug)),
          isLoading: false,
        })
      })
      .catch(() => {
        if (!cancelled) setAccess({ canWrite: false, canManage: false, isLoading: false })
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  return access
}
