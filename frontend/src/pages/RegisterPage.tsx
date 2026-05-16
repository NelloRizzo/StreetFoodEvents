import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../features/auth/auth-context'
import styles from './LoginPage.module.scss'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await register({ firstName, lastName, email, password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione non riuscita')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={`page-shell ${styles.layout}`}>
        <section className={styles.panel}>
          <span className="eyebrow">Registrazione</span>
          <h1 className={styles.panelTitle}>Crea il tuo account operatore.</h1>
          <p className={styles.panelCopy}>
            Registrati per accedere alla dashboard e gestire eventi, stand,
            ordini e wallet della moneta interna.
          </p>
          <ul className={styles.bulletList}>
            <li>
              <strong>Accesso immediato</strong>
              <span>Dopo la registrazione entri subito nella dashboard.</span>
            </li>
            <li>
              <strong>Dati personali</strong>
              <span>Nome, cognome ed email necessari per il profilo.</span>
            </li>
            <li>
              <strong>Sessione sicura</strong>
              <span>Autenticazione tramite cookie protetto e sessione server-side.</span>
            </li>
          </ul>
        </section>

        <section className={styles.formCard}>
          <div className={styles.formHeader}>
            <strong>Nuovo account</strong>
            <p>Compila i campi per registrarti.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="firstName">Nome *</label>
                <input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Mario"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="lastName">Cognome *</label>
                <input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rossi"
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mario.rossi@esempio.it"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 8 caratteri"
                minLength={8}
                required
              />
            </div>

            <p className={styles.error}>{error}</p>

            <button className={styles.submit} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrazione in corso...' : 'Registrati'}
            </button>
          </form>

          <p className={styles.switchLink}>
            Hai già un account?{' '}
            <Link to="/login">Accedi</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
