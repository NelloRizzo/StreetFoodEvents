import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'
import type { UploadedImage } from '../lib/upload'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import styles from './DashboardPage.module.scss'

type CurrencySymbol = UploadedImage | null

type EventInfo = {
  id: string
  name: string
  location: { label: string }
  startDate: string
  endDate: string
  currencyName: string
  currencySymbol: CurrencySymbol
  shortDescription: string | null
  logo: UploadedImage | null
  coverImage: UploadedImage | null
}

type HomeEvent = {
  id: string
  event: EventInfo
  wallet: { balance: number; joinedAt: string } | null
  createdAt: string
}

type HomeData = {
  favorites: HomeEvent[]
  activeEvents: EventInfo[]
}

type StandInfo = {
  id: string
  name: string
  eventIds: string[]
}

type StationInfo = {
  id: string
  name: string
  standId: string | null
  standName: string | null
  isAssigned?: boolean
}

type RoleInfo = {
  slug: string
  scope: string
  eventId: string | null
  standId: string | null
}

function fetchEventMeta(eventIds: string[]) {
  const uniqueIds = [...new Set(eventIds.filter(Boolean))]
  if (uniqueIds.length === 0) return Promise.resolve({ names: {} as Record<string, string>, ends: {} as Record<string, string> })
  return Promise.all(
    uniqueIds.map((eid) =>
      apiRequest<{ item: { name: string; endDate?: string } }>(`/events/${eid}`)
        .then((ev) => ({ id: eid, name: ev.item.name, endDate: ev.item.endDate ?? null }))
        .catch(() => ({ id: eid, name: null as string | null, endDate: null as string | null }))
    )
  ).then((resolved) => {
    const names: Record<string, string> = {}
    const ends: Record<string, string> = {}
    for (const r of resolved) {
      if (r.name) names[r.id] = r.name
      if (r.endDate) ends[r.id] = r.endDate
    }
    return { names, ends }
  })
}

export function DashboardPage() {
  const { user, viewMode, setViewMode } = useAuth()
  const [data, setData] = useState<HomeData | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [stands, setStands] = useState<StandInfo[]>([])
  const [stations, setStations] = useState<StationInfo[]>([])
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [isEventAdmin, setIsEventAdmin] = useState(false)
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [eventRoles, setEventRoles] = useState<RoleInfo[]>([])
  const [eventRoleEvents, setEventRoleEvents] = useState<{ id: string; name: string }[]>([])
  const [eventNames, setEventNames] = useState<Record<string, string>>({})
  const [eventEndDates, setEventEndDates] = useState<Record<string, string>>({})
  const [selectedReportEventId, setSelectedReportEventId] = useState('')
  const [selectedReportStandId, setSelectedReportStandId] = useState('')
  const [standEvent, setStandEvent] = useState<Record<string, string>>({})
  const [selectedStations, setSelectedStations] = useState<Record<string, string[]>>({})
  const [now] = useState(() => Date.now())

  useEffect(() => {
    apiRequest<HomeData>('/events/home')
      .then(setData)
      .catch(() => { /* not required */ })

    apiRequest<{ qrCode: string }>('/auth/me/qrcode')
      .then((d) => setQrCode(d.qrCode))
      .catch(() => { /* not required */ })

    apiRequest<{ stands: StandInfo[]; stations: StationInfo[] }>('/auth/me/stands')
      .then((d) => {
        setStands(d.stands)
        setStations(d.stations)
        fetchEventMeta(d.stands.flatMap((s) => s.eventIds)).then(({ names, ends }) => {
          setEventNames((prev) => ({ ...prev, ...names }))
          setEventEndDates((prev) => ({ ...prev, ...ends }))
        })
      })
      .catch(() => { /* not required */ })

    apiRequest<{ isPlatformAdmin: boolean; isEventAdmin: boolean; roles: RoleInfo[] }>('/auth/me/roles')
      .then((d) => {
        setIsPlatformAdmin(d.isPlatformAdmin)
        setIsEventAdmin(d.isEventAdmin)
        setRoles(d.roles)
        const filtered = d.roles.filter((r) => r.scope === 'event' && r.eventId)
        setEventRoles(filtered)
        fetchEventMeta(filtered.map((r) => r.eventId!)).then(({ names, ends }) => {
          setEventNames((prev) => ({ ...prev, ...names }))
          setEventEndDates((prev) => ({ ...prev, ...ends }))
          setEventRoleEvents(
            [...new Set(filtered.map((r) => r.eventId!))].map((eid) => ({
              id: eid,
              name: names[eid] ?? 'Evento',
            }))
          )
        })
      })
      .catch(() => { /* not required */ })
  }, [])

  const exchangeAdminEvents = eventRoleEvents.filter((ev) =>
    eventRoles.some((r) => r.eventId === ev.id && r.slug === 'exchange-admin')
  )

  const canAccessStandCash = (s: StandInfo) => {
    if (isPlatformAdmin) return true
    if (
      roles.some((r) => r.scope === 'stand' && r.standId === s.id && r.slug === 'cashier')
    ) return true
    return s.eventIds.some((eventId) =>
      roles.some(
        (r) => r.scope === 'event' && r.eventId === eventId && (r.slug === 'event-admin' || r.slug === 'event-cashier')
      )
    )
  }

  const isEventFinished = (eventId: string) => {
    const end = eventEndDates[eventId]
    if (!end) return false
    const endOfDay = new Date(end)
    endOfDay.setHours(23, 59, 59, 999)
    return endOfDay.getTime() < now
  }

  const toggleStation = (standId: string, stationId: string) => {
    setSelectedStations((prev) => {
      const current = prev[standId] ?? []
      const next = current.includes(stationId)
        ? current.filter((id) => id !== stationId)
        : [...current, stationId]
      return { ...prev, [standId]: next }
    })
  }

  const favoriteEvents = data?.favorites ?? []
  const activeEvents = data?.activeEvents ?? []
  const displayEvents = showAllEvents ? activeEvents : favoriteEvents.map((fe) => fe.event)
  const favoritesMap = new Map(favoriteEvents.map((fe) => [fe.event.id, fe]))

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <section className={styles.hero}>
          <span className="eyebrow">Home</span>
          <h1 className={styles.heroTitle}>
            Bentornat{user?.firstName.endsWith('a') ? 'a' : 'o'}, {user?.firstName ?? 'operatore'}.
          </h1>
          <p className={styles.heroCopy}>
            {viewMode === 'user'
              ? 'I tuoi eventi preferiti e il saldo wallet a colpo d\'occhio.'
              : 'Gestisci stand, eventi e wallet della piattaforma.'}
          </p>

          <div className={styles.viewModeToggle}>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === 'user' ? styles.viewModeActive : ''}`}
              onClick={() => setViewMode('user')}
            >
              Utente
            </button>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === 'operator' ? styles.viewModeActive : ''}`}
              onClick={() => setViewMode('operator')}
            >
              Operatore
            </button>
          </div>
        </section>

{viewMode === 'user' ? (
          <>
            <section className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {showAllEvents ? 'Eventi attivi' : 'I tuoi eventi preferiti'}
              </h2>
              <button
                type="button"
                className={styles.innerViewToggle}
                onClick={() => setShowAllEvents((v) => !v)}
              >
                {showAllEvents ? 'Vedi preferiti' : 'Vedi tutti gli eventi'}
              </button>
            </section>

            <div className={styles.eventGrid}>
              {displayEvents.length === 0 && (
                <p className={styles.empty}>
                  {showAllEvents
                    ? 'Nessun evento attivo al momento.'
                    : 'Nessun preferito. Aggiungi eventi ai preferiti per vederli qui.'}
                </p>
              )}

              {displayEvents.map((event) => {
                const fav = favoritesMap.get(event.id)
                const wallet = fav?.wallet

                return (
                  <article key={event.id} className={styles.eventCard}>
                    <div className={styles.eventBody}>
                      <strong className={styles.eventName}>{event.name}</strong>
                      {event.shortDescription && (
                        <span className={styles.eventDesc} dangerouslySetInnerHTML={{ __html: event.shortDescription }} />
                      )}
                      <span className={styles.eventDate}>
                        {new Date(event.startDate).toLocaleDateString('it-IT', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                        {' — '}
                        {new Date(event.endDate).toLocaleDateString('it-IT', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                      <span className={styles.eventLocation}>{event.location.label}</span>
                    </div>

                    <div className={styles.eventMeta}>
                      {wallet ? (
                        <div className={styles.walletBadge}>
                          <CurrencyDisplay
                            currencyName={event.currencyName}
                            currencySymbol={event.currencySymbol}
                          />
                          <span className={styles.walletBalance}>
                            {wallet.balance.toLocaleString('it-IT')}
                          </span>
                          <span className={styles.walletCurrency}>{event.currencyName}</span>
                        </div>
                      ) : (
                        <span className={styles.noWallet}>
                          <CurrencyDisplay
                            currencyName={event.currencyName}
                            currencySymbol={event.currencySymbol}
                          />
                          <span className={styles.walletBalance}>0</span>
                          <span className={styles.walletCurrency}>{event.currencyName}</span>
                        </span>
                      )}

                      <Link className={styles.eventLink} to={`/events/${event.id}`}>
                        Vedi evento
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>

            {qrCode && (
              <section className={styles.qrSection}>
                <h2 className={styles.qrTitle}>Il tuo codice QR</h2>
                <p className={styles.qrCopy}>
                  Mostra questo codice agli operatori per identificarti rapidamente.
                </p>
                <img src={qrCode} alt="QR Code personale" className={styles.qrImage} />
              </section>
            )}
          </>
        ) : (
          <>
            {eventRoles.length > 0 && eventRoleEvents.length > 0 && (
              <section className={styles.manageSection}>
                <h2 className={styles.sectionTitle}>Gestione eventi</h2>
                <div className={styles.manageGrid}>
                  {eventRoleEvents.map((ev) => {
                    const finished = isEventFinished(ev.id)
                    return (
                      <div key={ev.id} className={styles.manageCardGroup}>
                        <span className={styles.manageCardGroupName}>{ev.name}</span>
                        {finished ? (
                          <span className={styles.finishedBadge}>Terminato — nessuna operazione</span>
                        ) : (
                          <div className={styles.manageGrid}>
                            <Link to={`/events/${ev.id}/cashier`} className={styles.manageCard}>
                              <span className={styles.manageIcon}>&#128176;</span>
                              <span className={styles.manageName}>Cassa unica</span>
                              <span className={styles.manageHint}>Nuovo ordine</span>
                            </Link>
                            <Link to={`/events/${ev.id}/orders`} className={styles.manageCard}>
                              <span className={styles.manageIcon}>&#128196;</span>
                              <span className={styles.manageName}>Ordini evento</span>
                              <span className={styles.manageHint}>Gestisci ordini</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {(stands.length > 0 || stations.length > 0) && (
              <section className={styles.manageSection}>
                <h2 className={styles.sectionTitle}>Gestione stand</h2>

                {stands.map((s) => {
                  const standStations = stations.filter((st) => st.standId === s.id)
                  const ongoingEventIds = s.eventIds.filter((eventId) => !isEventFinished(eventId))
                  const storedEventId = standEvent[s.id]
                  const selectedEventId =
                    (storedEventId && ongoingEventIds.includes(storedEventId) ? storedEventId : undefined)
                    ?? (ongoingEventIds.length > 0 ? ongoingEventIds[0] : s.eventIds[0])
                  const selected = selectedStations[s.id] ?? []
                  const selectedFinished = s.eventIds.length > 0 && isEventFinished(selectedEventId)
                  const eventSuffix = s.eventIds.length > 0 ? `?eventId=${selectedEventId}` : ''
                  const combinedQueueUrl =
                    selected.length > 0
                      ? `/orders/station/${selected[0]}?stations=${selected.join(',')}${s.eventIds.length > 0 ? `&eventId=${selectedEventId}` : ''}`
                      : ''
                  return (
                    <div key={s.id} className={styles.standBlock}>
                      {selectedFinished ? (
                        <div className={styles.standBlockHeader}>
                          <span className={styles.manageIcon}>&#127968;</span>
                          <span className={styles.standBlockName}>{s.name}</span>
                        </div>
                      ) : (
                        <Link to={`/stands/${s.id}/orders`} className={styles.standBlockHeader}>
                          <span className={styles.manageIcon}>&#127968;</span>
                          <span className={styles.standBlockName}>{s.name}</span>
                          <span className={styles.manageHint}>Gestisci ordini</span>
                        </Link>
                      )}
                      <div className={styles.standActions}>
                        {ongoingEventIds.length > 1 && (
                          <select
                            value={selectedEventId}
                            onChange={(e) => setStandEvent((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            className={styles.eventSelect}
                            title="Seleziona evento"
                          >
                            {ongoingEventIds.map((eventId) => (
                              <option key={eventId} value={eventId}>
                                {eventNames[eventId] ?? 'Evento'}
                              </option>
                            ))}
                          </select>
                        )}
                        {selectedFinished ? (
                          <span className={styles.finishedBadge}>Evento terminato — nessuna operazione</span>
                        ) : (
                          <>
                            {s.eventIds.length > 0 && canAccessStandCash(s) && (
                              <Link
                                to={`/events/${selectedEventId}/stands/${s.id}/order`}
                                className={styles.displayLink}
                              >
                                <span className={styles.stationChipIcon}>&#128176;</span>
                                Cassa
                              </Link>
                            )}
                            {s.eventIds.length > 0 && (
                              <Link
                                to={`/events/${selectedEventId}/stands/${s.id}/ordersqueue`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.displayLink}
                              >
                                <span className={styles.stationChipIcon}>&#128065;</span>
                                Coda Ordini
                              </Link>
                            )}
                            {selected.length >= 2 && (
                              <Link
                                to={combinedQueueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${styles.displayLink} ${styles.combinedQueueLink}`}
                              >
                                <span className={styles.stationChipIcon}>&#128203;</span>
                                Coda combinata ({selected.length})
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                      {!selectedFinished && standStations.length > 0 && (
                        <div className={styles.stationList}>
                          {standStations.map((st) => (
                            <div key={st.id} className={styles.stationChip}>
                              <input
                                type="checkbox"
                                className={styles.stationCheckbox}
                                checked={selected.includes(st.id)}
                                onChange={() => toggleStation(s.id, st.id)}
                              />
                              <Link
                                to={`/orders/station/${st.id}${eventSuffix}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.stationChipLink}
                              >
                                <span className={styles.stationChipIcon}>&#9881;</span>
                                <span className={styles.stationChipName}>{st.name}</span>
                                <span className={styles.manageHint}>Coda postazione</span>
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {stations.filter((st) => !stands.some((s) => s.id === st.standId)).length > 0 && (
                  <div className={styles.stationList}>
                    {stations
                      .filter((st) => !stands.some((s) => s.id === st.standId))
                      .map((st) => (
                        <Link
                          key={st.id}
                          to={`/orders/station/${st.id}`}
                          className={styles.manageCard}
                        >
                          <span className={styles.manageIcon}>&#9881;</span>
                          <span className={styles.manageName}>{st.name}</span>
                          <span className={styles.manageHint}>
                            {st.standName ? `${st.standName} · ` : ''}Coda postazione
                          </span>
                        </Link>
                      ))}
                  </div>
                )}
              </section>
            )}

            {(isPlatformAdmin || isEventAdmin || exchangeAdminEvents.length > 0) && (
              <section className={styles.manageSection}>
                <h2 className={styles.sectionTitle}>Gestione wallet</h2>
                <div className={styles.manageGrid}>
                  <Link to="/event-users" className={styles.manageCard}>
                    <span className={styles.manageIcon}>&#128176;</span>
                    <span className={styles.manageName}>Portafogli eventi</span>
                    <span className={styles.manageHint}>Transazioni e depositi</span>
                  </Link>
                  {exchangeAdminEvents.filter((ev) => !isEventFinished(ev.id)).map((ev) => (
                    <Link key={ev.id} to={`/events/${ev.id}/settlements`} className={styles.manageCard}>
                      <span className={styles.manageIcon}>&#128181;</span>
                      <span className={styles.manageName}>Liquidazione {ev.name}</span>
                      <span className={styles.manageHint}>Corrispettivo stand in euro</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {(eventRoles.length > 0 || stands.length > 0) && (
              <section className={styles.manageSection}>
                <h2 className={styles.sectionTitle}>Resoconti</h2>

                <div className={styles.reportGrid}>
                  <div className={styles.reportSelector}>
                    <label className={styles.reportLabel} htmlFor="report-event-select">Report evento</label>
                    <select
                      id="report-event-select"
                      value={selectedReportEventId}
                      onChange={(e) => setSelectedReportEventId(e.target.value)}
                      className={styles.eventSelect}
                    >
                      <option value="">Seleziona evento</option>
                      {eventRoleEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                    </select>
                    {selectedReportEventId && (
                      <Link to={`/events/${selectedReportEventId}/report`} className={styles.manageCard}>
                        <span className={styles.manageIcon}>&#128202;</span>
                        <span className={styles.manageName}>Report {eventNames[selectedReportEventId] ?? 'evento'}</span>
                        <span className={styles.manageHint}>Resoconto finanziario</span>
                      </Link>
                    )}
                  </div>

                  <div className={styles.reportSelector}>
                    <label className={styles.reportLabel} htmlFor="report-stand-select">Report stand</label>
                    <select
                      id="report-stand-select"
                      value={selectedReportStandId}
                      onChange={(e) => setSelectedReportStandId(e.target.value)}
                      className={styles.eventSelect}
                    >
                      <option value="">Seleziona stand</option>
                      {stands.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {selectedReportStandId && (
                      <Link to={`/stands/${selectedReportStandId}/orders`} className={styles.manageCard}>
                        <span className={styles.manageIcon}>&#128202;</span>
                        <span className={styles.manageName}>Report stand</span>
                        <span className={styles.manageHint}>Resoconto stand</span>
                      </Link>
                    )}
                  </div>
                </div>

                <Link to="/admin/menu-print" className={styles.manageCard}>
                  <span className={styles.manageIcon}>&#128424;</span>
                  <span className={styles.manageName}>Menu stampa</span>
                  <span className={styles.manageHint}>Stampa menu stand</span>
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
