import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { OrderTrackingModal } from '../components/OrderTrackingModal'
import { useEventTheme } from '../features/theme/useEventTheme'
import styles from './StandTrackingPage.module.scss'

type UploadedImage = { url: string }

type EventTheme = {
  themeBrand: string | null
  themeText: string | null
  themeSurface: string | null
  themeHighlight: string | null
}

type EventInfo = EventTheme & {
  name: string
}

type StandInfo = {
  name: string
  logo: UploadedImage | null
  coverImage: UploadedImage | null
  numbers: Array<{ eventId: string; number: number }>
}

export function StandTrackingPage() {
  const { eventId, standId } = useParams<{ eventId: string; standId: string }>()
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [stand, setStand] = useState<StandInfo | null>(null)

  const themeData = useMemo<EventTheme | null>(
    () =>
      event
        ? {
            themeBrand: event.themeBrand,
            themeText: event.themeText,
            themeSurface: event.themeSurface,
            themeHighlight: event.themeHighlight,
          }
        : null,
    [event],
  )
  useEventTheme(themeData)

  useEffect(() => {
    if (!eventId) return
    apiRequest<{ item: EventInfo }>(`/events/${eventId}`)
      .then((res) => setEvent(res.item))
      .catch(() => {})
  }, [eventId])

  useEffect(() => {
    if (!standId) return
    apiRequest<{ item: StandInfo }>(`/stands/${standId}`)
      .then((res) => setStand(res.item))
      .catch(() => {})
  }, [standId])

  const standNumber = stand?.numbers.find((n) => n.eventId === eventId)?.number ?? null
  const bannerUrl = stand?.coverImage?.url ?? null
  const logoUrl = stand?.logo?.url ?? bannerUrl

  return (
    <div className={styles.page}>
      <aside className={styles.standPanel}>
        {bannerUrl && <img src={bannerUrl} alt="" className={styles.banner} />}
        <div className={styles.identity}>
          {logoUrl && <img src={logoUrl} alt="" className={styles.logo} />}
          <div className={styles.identityText}>
            <div className={styles.nameRow}>
              {standNumber !== null && <span className={styles.number}>{standNumber}</span>}
              <h1 className={styles.name}>{stand?.name ?? 'Stand'}</h1>
            </div>
            {event && <span className={styles.eventName}>{event.name}</span>}
          </div>
        </div>
      </aside>

      <main className={styles.trackPanel}>
        {eventId && standId && (
          <OrderTrackingModal open eventId={eventId} standId={standId} variant="page" />
        )}
      </main>
    </div>
  )
}