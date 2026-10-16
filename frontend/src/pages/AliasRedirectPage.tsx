import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { apiRequest } from '../lib/api'

type ResolveData = {
  entityType: 'event' | 'stand'
  entityId: string
  entityName: string
}

/* La rotta annidata (`/show/stand/<alias evento>/<alias stand>`) restituisce
 * anche l'evento, perche' il link finisce sulla pagina dello stand **within
 * l'evento** (`/events/:eventId/stands/:standId`) e non su quella dello stand
 * generica. */
type ResolveStandInEventData = ResolveData & { eventId: string; standId: string }

export function AliasRedirectPage() {
  const { entityType, alias, eventAlias, standAlias } = useParams<{
    entityType?: string
    alias?: string
    eventAlias?: string
    standAlias?: string
  }>()
  const navigate = useNavigate()

  /* Il link annidato non passa da `entityType`: i suoi due segmenti sono gia'
     i due alias. */
  const nested = Boolean(eventAlias && standAlias)

  useEffect(() => {
    if (nested) {
      apiRequest<ResolveStandInEventData>(
        `/resolve/stand/${eventAlias}/${standAlias}`,
      )
        .then((data) => {
          window.location.href = `/events/${data.eventId}/stands/${data.standId}`
        })
        .catch(() => {
          navigate('/', { replace: true })
        })
      return
    }

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
  }, [entityType, alias, eventAlias, standAlias, nested, navigate])

  return (
    <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--color-ink-soft)' }}>Reindirizzamento in corso...</p>
    </div>
  )
}