import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import styles from './ActivationPage.module.scss'

export function ActivationPage() {
  const { token } = useParams<{ token: string }>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!password || password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri')
      return
    }
    if (password !== confirm) {
      setError('Le password non coincidono')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/auth/activate', {
        method: 'POST',
        bodyJson: { token, password },
      })
      setDone(true)
    } catch (err) {
      setError((err as { message?: string }).message || 'Errore durante l\'attivazione')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {done ? (
          <>
            <h1 className={styles.title}>Account attivato</h1>
            <p className={styles.subtitle}>
              Il tuo account è attivo e la password è stata impostata. Ora puoi accedere.
            </p>
            <Link to="/login" className={styles.primaryBtn}>Vai al login</Link>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Attiva il tuo account</h1>
            <p className={styles.subtitle}>
              Scegli la tua password personale per completare l'attivazione.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
              <label className={styles.field}>
                Password (minimo 8 caratteri)
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label className={styles.field}>
                Conferma password
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </label>
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                {submitting ? 'Attivazione...' : 'Attiva account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
