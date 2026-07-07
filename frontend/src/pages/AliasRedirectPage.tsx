import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { apiRequest } from '../lib/api'

type ResolveData = {
  entityType: 'event' | 'stand'
  entityId: string
  entityName: string
}

export function AliasRedirectPage() {
  const { entityType, alias } = useParams<{ entityType: string; alias: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!entityType || !alias) {
      navigate('/', { replace: true })
      return
    }

    apiRequest<ResolveData>(`/resolve/${entityType}/${alias}`)
      .then((data) => {
        const path = data.entityType === 'event' ? `/events/${data.entityId}` : `/stands/${data.entityId}`
        window.location.href = path
      })
      .catch(() => {
        navigate('/', { replace: true })
      })
  }, [entityType, alias, navigate])

  return (
    <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-ink-soft)' }}>Reindirizzamento in corso...</p>
    </div>
  )
}
