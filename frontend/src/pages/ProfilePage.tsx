import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { Avatar } from '../components/Avatar'
import { fetchMyBadges, formatEarnedAt, progressLabel, type MyBadge } from '../lib/badges'
import styles from './ProfilePage.module.scss'

function BadgeCard({ badge }: { badge: MyBadge }) {
  const progress = progressLabel(badge)
  return (
    <li className={badge.earned ? styles.badgeCard : styles.badgeCardLocked}>
      <span className={styles.badgeIcon} aria-hidden="true">{badge.icon}</span>
      <div className={styles.badgeBody}>
        <span className={styles.badgeLabel}>{badge.label}</span>
        <span className={styles.badgeText}>
          {badge.earned ? badge.description : badge.lockedHint}
        </span>
        {badge.earned && badge.earnedAt && (
          <span className={styles.badgeDate}>ottenuto il {formatEarnedAt(badge.earnedAt)}</span>
        )}
        {!badge.earned && progress && (
          <span className={styles.badgeProgress}>{progress}</span>
        )}
      </div>
    </li>
  )
}

/**
 * Profilo utente "classico" dell'app pubblica: dati utente + le voci del
 * menu (Preferiti, Privacy, Esci).
 *
 * Nella PWA clienti (/customers/) questo e' l'unico punto di ingresso per
 * un utente autenticato, quindi anche per un admin: la dashboard operatore
 * non esiste in quella build. Nel sito operatore la pagina resta comunque
 * raggiungibile da /profilo ma i link "Operatore" restano gia' visibili
 * nell'header e nella bottom bar.
 *
 * NOTA: qui non c'e' la voce "Guide". Le 4 guide esistenti (/guide/:role ->
 * event-admin, event-cashier, station-attendant, stand-cashier) sono
 * manuali operativi (cassa unica, gestione ordini, sidebar admin): dal
 * profilo di un cliente aprirebbero il manuale del cassiere. Nell'app
 * operatore le guide restano comunque raggiungibili dalla sidebar admin
 * (AdminSidebar) e dal menu utente dell'header (PublicHeader).
 */
export function ProfilePage() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const [badges, setBadges] = useState<MyBadge[]>([])

  useEffect(() => {
    if (!isAuthenticated) return
    /* I badge sono assegnati in automatico dal backend a ogni lettura: non
       c'e' nessun endpoint di assegnazione, quindi qui si legge e basta. */
    let cancelled = false
    fetchMyBadges()
      .then((res) => {
        if (!cancelled) setBadges(res.badges)
      })
      .catch(() => {
        /* I badge non sono essenziali al profilo: se falliscono, il profilo
           resta comunque utilizzabile. */
        if (!cancelled) setBadges([])
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (!isAuthenticated || !user) {
    return (
      <div className={styles.page}>
        <div className="page-shell">
          <div className={styles.header}>
            <span className="eyebrow">Profilo</span>
            <h1 className={styles.title}>Accedi al tuo profilo</h1>
          </div>
          <div className={styles.guestCard}>
            <p className={styles.guestCopy}>
              Accedi per gestire i tuoi preferiti e i tuoi dati.
            </p>
            <Link className={styles.item} to="/login">
              <span className={styles.itemIcon}>{'\u{1F464}'}</span>
              Accedi
            </Link>
            <Link className={styles.item} to="/register">
              <span className={styles.itemIcon}>{'\u{1F195}'}</span>
              Crea un account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isAdmin = Boolean(user.isAdmin || user.isPlatformAdmin)

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <span className="eyebrow">Profilo</span>
          <h1 className={styles.title}>Il tuo profilo</h1>
        </div>

        <div className={styles.card}>
          <Avatar
            src={user.avatar?.url ?? null}
            firstName={user.firstName}
            lastName={user.lastName}
            size="lg"
          />
          <div className={styles.identity}>
            <span className={styles.name}>
              {user.firstName} {user.lastName}
            </span>
            <span className={styles.email}>{user.email}</span>
            {isAdmin && <span className={styles.roleBadge}>Amministratore</span>}
          </div>
        </div>

        {badges.length > 0 && (
          <section className={styles.badges}>
            <h2 className={styles.badgesTitle}>I tuoi badge</h2>
            <ul className={styles.badgeList}>
              {badges.map((badge) => (
                <BadgeCard key={badge.type} badge={badge} />
              ))}
            </ul>
          </section>
        )}

        <div className={styles.list}>
          <Link className={styles.item} to="/favorites">
            <span className={styles.itemIcon}>{'\u{1F49D}'}</span>
            Preferiti
            <span className={styles.itemChevron}>{'\u203A'}</span>
          </Link>
          <Link className={styles.item} to="/privacy">
            <span className={styles.itemIcon}>{'\u{1F512}'}</span>
            Privacy Policy
            <span className={styles.itemChevron}>{'\u203A'}</span>
          </Link>
          <button
            type="button"
            className={`${styles.item} ${styles.danger}`}
            onClick={async () => {
              await logout()
              navigate('/', { replace: true })
            }}
          >
            <span className={styles.itemIcon}>{'\u{1F6AA}'}</span>
            Esci
          </button>
        </div>
      </div>
    </div>
  )
}
