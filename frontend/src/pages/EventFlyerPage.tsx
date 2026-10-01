import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { safeExternalUrl } from '../lib/externalUrl'
import styles from './EventFlyerPage.module.scss'

type UploadedImg = { url: string; publicId: string }

type EventSponsor = {
  name: string
  logo: UploadedImg
  url: string | null
  tier: 'main' | 'sponsor' | 'partner'
  enabled: boolean
  sortOrder: number
}

type FlyerEvent = {
  id: string
  name: string
  location: { label: string; city?: string | null }
  startDate: string
  endDate: string
  shortDescription: string | null
  url: string | null
  coverImage: UploadedImg | null
  logo: UploadedImg | null
  sponsors: EventSponsor[]
}

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })

function isDateRange(start: string, end: string) {
  return start.slice(0, 10) !== end.slice(0, 10)
}

/**
 * Volantino stampabile dell'evento.
 *
 * E' il posto dove gli sponsor hanno risalto: la fascia `main` in testa (logo
 * grande), poi la griglia degli sponsor e la riga dei partner in fondo.
 * Nelle pagine web gli sponsor non compaiono: sono visibili qui per scelta.
 *
 * Gli URL degli sponsor arrivano da un form admin e finiscono in un `href`,
 * quindi passano da `safeExternalUrl()` (accetta solo http/https): difesa in
 * profondità rispetto al filtro già applicato in scrittura dal backend.
 */
export function EventFlyerPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<FlyerEvent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    setIsLoading(true)
    apiRequest<{ item: FlyerEvent }>(`/events/${eventId}`)
      .then((res) => {
        if (cancelled) return
        setEvent(res.item)
        setNotFound(false)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  /* QR verso la pagina dell'evento sulla piattaforma.
   *
   * Riusa `GET /api/events/:eventId/qrcode` (public, gia' usato dal bottone
   * "QR Evento" in EventDetailPage): restituisce un data URL con l'URL
   * costruito dal backend dall'origin della richiesta.
   *
   * Effetto separato dal caricamento dell'evento di proposito: il QR e' un
   * extra, se la generazione fallisce il volantino resta stampabile e senza
   * QR, mentre un errore qui non deve far rimbalzare la pagina. */
  useEffect(() => {
    if (!eventId) return
    let cancelled = false
    apiRequest<{ qrCode: string }>(`/events/${eventId}/qrcode`)
      .then((res) => {
        if (!cancelled) setQrCode(res.qrCode)
      })
      .catch(() => {
        if (!cancelled) setQrCode(null)
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  if (isLoading) {
    return <div className="page-shell"><p className={styles.empty}>Caricamento…</p></div>
  }

  if (notFound || !event) {
    return (
      <div className="page-shell">
        <div className={styles.notFound}>
          <h1>Evento non trovato</h1>
          <Link to="/events" className="back-link">Torna agli eventi</Link>
        </div>
      </div>
    )
  }

  const sponsors = (event.sponsors ?? [])
    .filter((s) => s.enabled && s.logo?.url)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const main = sponsors.filter((s) => s.tier === 'main')
  const rest = sponsors.filter((s) => s.tier !== 'main')
  const grid = rest.filter((s) => s.tier === 'sponsor')
  const partners = rest.filter((s) => s.tier === 'partner')

  const dates = isDateRange(event.startDate, event.endDate)
    ? `${shortDateFmt.format(new Date(event.startDate))} — ${dateFmt.format(new Date(event.endDate))}`
    : dateFmt.format(new Date(event.startDate))

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.toolbar}>
          <Link to={`/events/${event.id}`} className="back-link back-link--inline">Torna all&apos;evento</Link>
          <button type="button" className={styles.printBtn} onClick={() => window.print()}>
            Stampa / salva PDF
          </button>
        </div>

        <article className={styles.sheet}>
          <header className={styles.header}>
            {event.coverImage?.url && (
              <img className={styles.cover} src={event.coverImage.url} alt="" />
            )}
            <div className={styles.headerText}>
              {(event.logo?.url ?? event.coverImage?.url) && (
                <img className={styles.logo} src={(event.logo ?? event.coverImage)!.url} alt="" />
              )}
              <h1 className={styles.title}>{event.name}</h1>
              <p className={styles.dates}>{dates}</p>
              <p className={styles.place}>
                {event.location.label}
                {event.location.city ? `, ${event.location.city}` : ''}
              </p>
              {/* shortDescription e' HTML gia' sanitizzato dal server
                  (sanitizeHtmlContent in events.controller.ts): va reso come
                  markup, altrimenti i tag finiscono visibili nel testo. */}
              {event.shortDescription && (
                <div className={styles.desc} dangerouslySetInnerHTML={{ __html: event.shortDescription }} />
              )}
              {safeExternalUrl(event.url) && (
                <p className={styles.site}>
                  <a href={safeExternalUrl(event.url)!} target="_blank" rel="noopener noreferrer">
                    {event.url}
                  </a>
                </p>
              )}
            </div>
          </header>

          {sponsors.length > 0 && (
            <section className={styles.sponsors} aria-label="Sponsor e partner">
              {main.length > 0 && (
                <div className={styles.tierMain}>
                  <p className={styles.tierLabel}>Main partner</p>
                  <div className={styles.mainRow}>
                    {main.map((s, i) => {
                      const href = safeExternalUrl(s.url)
                      const logo = (
                        <>
                          <img src={s.logo.url} alt={s.name} />
                          <span>{s.name}</span>
                        </>
                      )
                      return href ? (
                        <a key={`${s.name}-${i}`} href={href} target="_blank" rel="noopener noreferrer nofollow" className={styles.mainItem}>
                          {logo}
                        </a>
                      ) : (
                        <div key={`${s.name}-${i}`} className={styles.mainItem}>{logo}</div>
                      )
                    })}
                  </div>
                </div>
              )}

              {grid.length > 0 && (
                <div className={styles.tierGroup}>
                  <p className={styles.tierLabel}>Sponsor</p>
                  <div className={styles.grid}>
                    {grid.map((s, i) => {
                      const href = safeExternalUrl(s.url)
                      const logo = (
                        <>
                          <img src={s.logo.url} alt={s.name} />
                          <span>{s.name}</span>
                        </>
                      )
                      return href ? (
                        <a key={`${s.name}-${i}`} href={href} target="_blank" rel="noopener noreferrer nofollow" className={styles.gridItem}>
                          {logo}
                        </a>
                      ) : (
                        <div key={`${s.name}-${i}`} className={styles.gridItem}>{logo}</div>
                      )
                    })}
                  </div>
                </div>
              )}

              {partners.length > 0 && (
                <div className={styles.tierGroup}>
                  <p className={styles.tierLabel}>Partner</p>
                  <div className={styles.partnerRow}>
                    {partners.map((s, i) => {
                      const href = safeExternalUrl(s.url)
                      const name = <span className={styles.partnerName}>{s.name}</span>
                      return href ? (
                        <a key={`${s.name}-${i}`} href={href} target="_blank" rel="noopener noreferrer nofollow" className={styles.partnerItem}>
                          {name}
                        </a>
                      ) : (
                        <div key={`${s.name}-${i}`} className={styles.partnerItem}>{name}</div>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {qrCode && (
            <section className={styles.qrBlock} aria-label="QR code dell'evento">
              <img
                src={qrCode}
                alt={`QR code per aprire la pagina di ${event.name}`}
                className={styles.qrImage}
              />
              <div className={styles.qrText}>
                <p className={styles.qrTitle}>Inquadra e apri l&apos;evento</p>
                <p className={styles.qrHint}>
                  Menu dei stand, mappa, galleria e ordine diretto dal telefono.
                </p>
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  )
}