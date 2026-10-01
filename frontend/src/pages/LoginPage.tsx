import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import { isCustomersPwa } from '../lib/app-mode'
import styles from './LoginPage.module.scss'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  /* Destinazione dopo il login. Nella PWA clienti la dashboard operatore
     (/dashboard -> /admin/dashboard) non esiste: a stessa origine quel path
     viene servito dall'altra build e porta alla dashboard admin, quindi in
     PWA si atterra sempre sul profilo utente classico — anche quando `from`
     (Remember del RequireAuth) punta a una rotta operatore. */
  const isOperatorPath = (path: string) => path === '/dashboard' || path.startsWith('/admin')
  const fromPath =
    typeof location.state === 'object' &&
    location.state !== null &&
    'from' in location.state &&
    typeof location.state.from === 'object' &&
    location.state.from !== null &&
    'pathname' in location.state.from &&
    typeof location.state.from.pathname === 'string'
      ? location.state.from.pathname
      : null

  const nextPath = isCustomersPwa()
    ? fromPath && !isOperatorPath(fromPath)
      ? fromPath
      : '/profilo'
    : (fromPath ?? '/dashboard')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login({ email, password })
      navigate(nextPath, { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Accesso non riuscito')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={`page-shell ${styles.layout}`}>
        <section className={styles.panel}>
          <span className="eyebrow">Login operativo</span>
          <h1 className={styles.panelTitle}>Entra nella dashboard dell&apos;evento.</h1>
          <p className={styles.panelCopy}>
            Accedi con le credenziali del tuo profilo per gestire eventi, stand,
            operatori e wallet della moneta interna da un unico spazio operativo.
          </p>

          <ul className={styles.bulletList}>
            <li>
              <strong>Ruoli separati</strong>
              <span>Admin, cassa e cucina vedono solo quello che serve davvero.</span>
            </li>
            <li>
              <strong>Sessione sicura</strong>
              <span>Autenticazione tramite cookie protetto e sessione server-side.</span>
            </li>
            <li>
              <strong>Dashboard unificata</strong>
              <span>Eventi, utenti e transazioni raggiungibili in pochi passaggi.</span>
            </li>
          </ul>
        </section>

        <section className={styles.formCard}>
          <div className={styles.formHeader}>
            <strong>Accesso riservato</strong>
            <p>Usa l&apos;email del tuo account e la password associata.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@evento.it"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Inserisci la password"
              />
            </div>

            <p className={styles.error}>{error}</p>

            <button className={styles.submit} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>

          <p className={styles.switchLink}>
            Non hai un account?{' '}
            <Link to="/register">Registrati</Link>
          </p>
          <Link className="back-link" to="/">
            Torna alla presentazione
          </Link>
        </section>
      </div>
    </div>
  )
}
