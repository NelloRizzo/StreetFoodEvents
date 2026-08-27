import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import styles from './EventDetailPage.module.scss'
import manageStyles from './StandManagePage.module.scss'

type RoleInfo = { slug: string; scope: string; eventId: string | null; standId: string | null }
type StandEvent = { id: string; name: string; endDate: string | null }
type StationItem = { id: string; name: string; standId: string | null; standName: string | null }

export function StandManagePage() {
  const { standId } = useParams<{ standId: string }>()
  const { isAuthenticated } = useAuth()
  const [now] = useState(() => Date.now())

  const [loading, setLoading] = useState(true)
  const [standName, setStandName] = useState('')
  const [standEvents, setStandEvents] = useState<StandEvent[]>([])
  const [stations, setStations] = useState<StationItem[]>([])
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedStations, setSelectedStations] = useState<string[]>([])

  useEffect(() => {
    if (!standId || !isAuthenticated) return
    let cancelled = false
    Promise.all([
      apiRequest<{ item: { name: string; numbers?: Array<{ eventId: string }> } }>(`/stands/${standId}`),
      apiRequest<{ stations: StationItem[] }>('/auth/me/stands'),
      apiRequest<{ isPlatformAdmin: boolean; roles: RoleInfo[] }>('/auth/me/roles'),
    ])
      .then(async ([standRes, myRes, rolesRes]) => {
        if (cancelled) return
        setStandName(standRes.item.name)
        setStations(myRes.stations.filter((st) => st.standId === standId))
        setIsPlatformAdmin(rolesRes.isPlatformAdmin)
        setRoles(rolesRes.roles)
        const eventIds = [...new Set((standRes.item.numbers ?? []).map((n) => n.eventId))]
        const events = await Promise.all(
          eventIds.map((eventId) =>
            apiRequest<{ item: { name: string; endDate?: string | null } }>(`/events/${eventId}`)
              .then((r) => ({ id: eventId, name: r.item.name, endDate: r.item.endDate ?? null }))
              .catch(() => null)
          )
        )
        if (cancelled) return
        const validEvents = events.filter((ev): ev is StandEvent => ev !== null)
        setStandEvents(validEvents)
        const ongoing = validEvents.find((ev) => {
          if (!ev.endDate) return false
          const endOfDay = new Date(ev.endDate)
          endOfDay.setHours(23, 59, 59, 999)
          return endOfDay.getTime() >= now
        })
        setSelectedEventId(ongoing?.id ?? validEvents[0]?.id ?? '')
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [standId, isAuthenticated, now])

  const isEventFinished = (eventId: string) => {
    const ev = standEvents.find((e) => e.id === eventId)
    if (!ev?.endDate) return false
    const endOfDay = new Date(ev.endDate)
    endOfDay.setHours(23, 59, 59, 999)
    return endOfDay.getTime() < now
  }

  const selectedEvent = standEvents.find((e) => e.id === selectedEventId) ?? null
  const eventOngoing = selectedEvent ? !isEventFinished(selectedEvent.id) : false

  const canAccessCash =
    !!selectedEvent &&
    (isPlatformAdmin ||
      roles.some((r) => r.scope === 'stand' && r.standId === standId && r.slug === 'cashier') ||
      roles.some(
        (r) =>
          r.scope === 'event' &&
          r.eventId === selectedEvent.id &&
          (r.slug === 'event-admin' || r.slug === 'event-cashier')
      ))

  const toggleStation = (stationId: string) => {
    setSelectedStations((prev) =>
      prev.includes(stationId)
        ? prev.filter((id) => id !== stationId)
        : [...prev, stationId],
    )
  }

  if (loading) {
    return (
      <div className={`page-shell ${styles.page}`}>
        <p>Caricamento...</p>
      </div>
    )
  }

  return (
    <div className={`page-shell ${styles.page}`}>
      <h1 className={styles.pageTitle}>Gestione stand &mdash; {standName || '?'}</h1>

      {standEvents.length > 0 && (
        <div className={manageStyles.eventPickerRow}>
          <label className={manageStyles.field}>
            Evento
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              {standEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}{isEventFinished(ev.id) ? ' — terminato' : ''}
                </option>
              ))}
            </select>
          </label>
          {!eventOngoing && (
            <p className={manageStyles.finishedNote}>
              Evento terminato: cassa e code non sono più disponibili.
            </p>
          )}
        </div>
      )}

      <section>
        <h2 className={styles.sectionTitle}>Operazioni</h2>
        <div className={manageStyles.cardsGrid}>
          <Link className={manageStyles.actionCard} to={`/admin/stands/${standId}/orders`}>
            <span className={manageStyles.actionIcon}>{'\u{1F4CB}'}</span>
            <span className={manageStyles.actionTitle}>Ordini</span>
            <span className={manageStyles.actionDesc}>Lista ordini dello stand e resoconti</span>
          </Link>

          {selectedEvent && eventOngoing && canAccessCash && (
            <Link
              className={manageStyles.actionCard}
              to={`/admin/events/${selectedEvent.id}/stands/${standId}/order`}
            >
              <span className={manageStyles.actionIcon}>{'\u{1F4B0}'}</span>
              <span className={manageStyles.actionTitle}>Cassa</span>
              <span className={manageStyles.actionDesc}>Crea ordini e incassa crediti</span>
            </Link>
          )}

          {selectedEvent && eventOngoing && (
            <a
              className={manageStyles.actionCard}
              href={`/events/${selectedEvent.id}/stands/${standId}/ordersqueue`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={manageStyles.actionIcon}>{'\u{1F441}'}</span>
              <span className={manageStyles.actionTitle}>Coda ordini</span>
              <span className={manageStyles.actionDesc}>Display pubblico degli ordini in lavorazione</span>
            </a>
          )}
        </div>
      </section>

      {eventOngoing && stations.length > 0 && (
        <section>
          <div className={manageStyles.stationSectionHeader}>
            <h2 className={styles.sectionTitle}>Code postazioni</h2>
            {selectedStations.length >= 2 && (
              <a
                className={manageStyles.combinedQueueLink}
                href={`/orders/station/${selectedStations[0]}?stations=${selectedStations.join(',')}${selectedEvent ? `&eventId=${selectedEvent.id}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {'\u{1F4CB}'} Coda combinata ({selectedStations.length})
              </a>
            )}
          </div>
          <div className={manageStyles.stationList}>
            {stations.map((st) => (
              <div key={st.id} className={manageStyles.stationRow}>
                <input
                  type="checkbox"
                  className={manageStyles.stationCheckbox}
                  checked={selectedStations.includes(st.id)}
                  onChange={() => toggleStation(st.id)}
                  title="Seleziona per la coda combinata"
                />
                <a
                  className={manageStyles.stationLink}
                  href={`/orders/station/${st.id}${selectedEvent ? `?eventId=${selectedEvent.id}` : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{'\u2699'} {st.name}</span>
                  <span className={manageStyles.stationHint}>Display coda postazione</span>
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
