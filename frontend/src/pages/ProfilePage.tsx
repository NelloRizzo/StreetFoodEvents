import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { Avatar } from '../components/Avatar'
import styles from './ProfilePage.module.scss'

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
