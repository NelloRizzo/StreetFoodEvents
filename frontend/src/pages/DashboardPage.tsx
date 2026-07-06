import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { apiRequest } from '../lib/api'
import type { UploadedImage } from '../lib/upload'
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
}

type StationInfo = {
  id: string
  name: string
  standId: string | null
  standName: string | null
  isAssigned?: boolean
}

function CurrencyDisplay({ currencyName, currencySymbol }: { currencyName: string; currencySymbol: CurrencySymbol }) {
  if (currencySymbol?.url) {
    return (
      <span className={styles.currencyIcon}>
        <img src={currencySymbol.url} alt={currencyName} className={styles.currencyImg} />
      </span>
    )
  }

  const initial = currencyName.charAt(0).toUpperCase()

  return (
    <span className={`${styles.currencyIcon} ${styles.currencyInitial}`} title={currencyName}>
      {initial}
    </span>
  )
}

type RoleInfo = {
  slug: string
  scope: string
  eventId: string | null
  standId: string | null
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
  const [eventRoles, setEventRoles] = useState<RoleInfo[]>([])
  const [eventRoleEvents, setEventRoleEvents] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    apiRequest<HomeData>('/events/home')
      .then(setData)
      .catch(() => { /* not required */ })

    apiRequest<{ qrCode: string }>('/auth/me/qrcode')
      .then((d) => setQrCode(d.qrCode))
      .catch(() => { /* not required */ })

    apiRequest<{ stands: StandInfo[]; stations: StationInfo[] }>('/auth/me/stands')
      .then((d) => { setStands(d.stands); setStations(d.stations) })
      .catch(() => { /* not required */ })

    apiRequest<{ isPlatformAdmin: boolean; isEventAdmin: boolean; roles: RoleInfo[] }>('/auth/me/roles')
      .then((d) => {
        setIsPlatformAdmin(d.isPlatformAdmin)
        setIsEventAdmin(d.isEventAdmin)
        const filtered = d.roles.filter((r) => r.scope === 'event' && r.eventId)
        setEventRoles(filtered)
        if (filtered.length > 0) {
          const eventIds = [...new Set(filtered.map((r) => r.eventId!))]
          Promise.all(
            eventIds.map((eid) =>
              apiRequest<{ item: { name: string } }>(`/events/${eid}`)
                .then((ev) => ({ id: eid, name: ev.item.name }))
                .catch(() => ({ id: eid, name: 'Evento' }))
            )
          ).then(setEventRoleEvents)
        }
      })
      .catch(() => { /* not required */ })
  }, [])

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
                  {eventRoleEvents.map((ev) => (
                    <div key={ev.id} className={styles.manageCardGroup}>
                      <span className={styles.manageCardGroupName}>{ev.name}</span>
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
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(stands.length > 0 || stations.length > 0) && (
              <section className={styles.manageSection}>
                <h2 className={styles.sectionTitle}>Gestione stand</h2>

                {stands.map((s) => {
                  const standStations = stations.filter((st) => st.standId === s.id)
                  return (
                    <div key={s.id} className={styles.standBlock}>
                      <Link to={`/orders/stand/${s.id}`} className={styles.standBlockHeader}>
                        <span className={styles.manageIcon}>&#127968;</span>
                        <span className={styles.standBlockName}>{s.name}</span>
                        <span className={styles.manageHint}>Gestisci ordini</span>
                      </Link>
                      {standStations.length > 0 && (
                        <div className={styles.stationList}>
                          {standStations.map((st) => (
                            <Link
                              key={st.id}
                              to={`/orders/station/${st.id}`}
                              className={styles.stationChip}
                            >
                              <span className={styles.stationChipIcon}>&#9881;</span>
                              <span className={styles.stationChipName}>{st.name}</span>
                              <span className={styles.manageHint}>Coda postazione</span>
                            </Link>
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

            {(isPlatformAdmin || isEventAdmin) && (
              <section className={styles.manageSection}>
                <h2 className={styles.sectionTitle}>Gestione wallet</h2>
                <div className={styles.manageGrid}>
                  <Link to="/event-users" className={styles.manageCard}>
                    <span className={styles.manageIcon}>&#128176;</span>
                    <span className={styles.manageName}>Portafogli eventi</span>
                    <span className={styles.manageHint}>Transazioni e depositi</span>
                  </Link>
                </div>
              </section>
            )}

            {(eventRoles.length > 0 || stands.length > 0) && (
              <section className={styles.manageSection}>
                <h2 className={styles.sectionTitle}>Resoconti</h2>
                <div className={styles.manageGrid}>
                  {eventRoleEvents.map((ev) => (
                    <Link key={ev.id} to={`/events/${ev.id}/report`} className={styles.manageCard}>
                      <span className={styles.manageIcon}>&#128202;</span>
                      <span className={styles.manageName}>Report {ev.name}</span>
                      <span className={styles.manageHint}>Resoconto finanziario</span>
                    </Link>
                  ))}
                  {stands.map((s) => (
                    <Link key={s.id} to={`/orders/stand/${s.id}`} className={styles.manageCard}>
                      <span className={styles.manageIcon}>&#128202;</span>
                      <span className={styles.manageName}>Report {s.name}</span>
                      <span className={styles.manageHint}>Resoconto stand</span>
                    </Link>
                  ))}
                  <Link to="/admin/menu-print" className={styles.manageCard}>
                    <span className={styles.manageIcon}>&#128424;</span>
                    <span className={styles.manageName}>Menu stampa</span>
                    <span className={styles.manageHint}>Stampa menu stand</span>
                  </Link>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
