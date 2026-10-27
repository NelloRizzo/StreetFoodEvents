import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { getDeviceId } from '../lib/device'
import styles from './PhotoContestVotePage.module.scss'

export function PhotoContestVotePage() {
  const { contestId, photoId } = useParams<{ contestId: string; photoId: string }>()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'voted'>('loading')
  const [message, setMessage] = useState('')

  const vote = useCallback(async () => {
    if (!contestId || !photoId) {
      setStatus('error')
      setMessage('Dati mancanti')
      return
    }
    try {
      getDeviceId()
      setStatus('error')
      setMessage('Usa il link corretto dal contest')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Errore')
    }
  }, [contestId, photoId])

  useEffect(() => {
    vote()
  }, [vote])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {status === 'loading' && <p>Voto in corso...</p>}
        {status === 'success' && (
          <>
            <h1>✓ Voto registrato!</h1>
            <p>{message}</p>
          </>
        )}
        {status === 'voted' && (
          <>
            <h1>ℹ Hai già votato</h1>
            <p>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1>✗ Errore</h1>
            <p>{message}</p>
          </>
        )}
      </div>
    </div>
  )
}
