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

type MyPhoto = {
  id: string
  sequenceNumber: number
  type: 'image' | 'video'
  thumbnail: string | null
  takenAt: string
}

type MyPhotoGroup = {
  eventId: string
  eventName: string
  eventStartDate: string | null
  eventEndDate: string | null
  totalCount: number
  photos: MyPhoto[]
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<HomeData | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [myPhotoGroups, setMyPhotoGroups] = useState<MyPhotoGroup[]>([])
  const [now] = useState(() => Date.now())

  useEffect(() => {
    apiRequest<HomeData>('/events/home')
      .then(setData)
      .catch(() => { /* not required */ })

    apiRequest<{ qrCode: string }>('/auth/me/qrcode')
      .then((d) => setQrCode(d.qrCode))
      .catch(() => { /* not required */ })

    apiRequest<{ items: MyPhotoGroup[] }>('/photos/mine')
      .then((d) => setMyPhotoGroups(d.items))
      .catch(() => { /* not required */ })
  }, [])

  const isEventFinished = (endDate: string | null) => {
    if (!endDate) return false
    const endOfDay = new Date(endDate)
    endOfDay.setHours(23, 59, 59, 999)
    return endOfDay.getTime() < now
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
            Bentornat{user?.firstName.endsWith('a') ? 'a' : 'o'}, {user?.firstName ?? ''}.
          </h1>
          <p className={styles.heroCopy}>
            I tuoi eventi preferiti e il saldo wallet a colpo d&apos;occhio.
          </p>
        </section>

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

        {myPhotoGroups.length > 0 && (
          <section className={styles.photoSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Le mie foto</h2>
            </div>
            {myPhotoGroups.map((group) => {
              const hiddenCount = group.totalCount - group.photos.length

              return (
                <article key={group.eventId} className={styles.photoEventCard}>
                  <div className={styles.photoEventHeader}>
                    <strong className={styles.eventName}>{group.eventName}</strong>
                    <span className={styles.photoCount}>{group.totalCount} scatti</span>
                    {isEventFinished(group.eventEndDate) && (
                      <span className={styles.finishedBadge}>Terminato</span>
                    )}
                  </div>
                  <div className={styles.thumbGrid}>
                    {group.photos.map((photo) => (
                      <figure key={photo.id} className={styles.thumb}>
                        {photo.thumbnail ? (
                          <img src={photo.thumbnail} alt={`Foto ${photo.sequenceNumber}`} loading="lazy" />
                        ) : (
                          <span className={styles.thumbPlaceholder}>–</span>
                        )}
                        <figcaption className={styles.seqBadge}>#{photo.sequenceNumber}</figcaption>
                        {photo.type === 'video' && <span className={styles.videoBadge}>🎬</span>}
                      </figure>
                    ))}
                  </div>
                  <div className={styles.photoEventFooter}>
                    {hiddenCount > 0 && (
                      <span className={styles.moreCount}>+{hiddenCount} in galleria</span>
                    )}
                    <Link className={styles.eventLink} to={`/events/${group.eventId}/galleria`}>
                      Apri galleria
                    </Link>
                  </div>
                </article>
              )
            })}
          </section>
        )}

        {qrCode && (
          <section className={styles.qrSection}>
            <h2 className={styles.qrTitle}>Il tuo codice QR</h2>
            <p className={styles.qrCopy}>
              Mostra questo codice agli operatori per identificarti rapidamente.
            </p>
            <img src={qrCode} alt="QR Code personale" className={styles.qrImage} />
          </section>
        )}
      </div>
    </div>
  )
}
