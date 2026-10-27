import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { getDeviceId } from '../lib/device'
import styles from './PhotoContestVoteDirectPage.module.scss'

export function PhotoContestVoteDirectPage() {
  const { eventId, contestId, photoId } = useParams<{ eventId: string; contestId: string; photoId: string }>()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'voted'>('loading')
  const [message, setMessage] = useState('')

  const vote = useCallback(async () => {
    if (!eventId || !contestId || !photoId) {
      setStatus('error')
      setMessage('Dati mancanti')
      return
    }
    try {
      const deviceId = getDeviceId()
      await apiRequest(`/events/${eventId}/photo-contests/${contestId}/vote`, {
        method: 'POST',
        bodyJson: { photoId, deviceId }
      })
      setStatus('success')
      setMessage('Il tuo voto è stato registrato con successo!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore'
      if (msg.includes('già votato')) {
        setStatus('voted')
        setMessage('Hai già votato in questo contest')
      } else {
        setStatus('error')
        setMessage(msg)
      }
    }
  }, [eventId, contestId, photoId])

  useEffect(() => {
    vote()
  }, [vote])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {status === 'loading' && (
          <>
            <div className={styles.spinner}></div>
            <p>Registrazione voto in corso...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className={styles.iconSuccess}>✓</div>
            <h1>Voto registrato!</h1>
            <p>{message}</p>
          </>
        )}
        {status === 'voted' && (
          <>
            <div className={styles.iconInfo}>ℹ</div>
            <h1>Hai già votato</h1>
            <p>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className={styles.iconError}>✗</div>
            <h1>Errore</h1>
            <p>{message}</p>
          </>
        )}
      </div>
    </div>
  )
}
