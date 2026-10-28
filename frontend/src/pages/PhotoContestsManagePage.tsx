import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import styles from './PhotoContestsManagePage.module.scss'

type PhotoContest = {
  _id: string
  eventId: string
  title: string
  description: string | null
  status: 'draft' | 'open' | 'closed'
  votingEnabled: boolean
  startsAt: string | null
  endsAt: string | null
  resultsPublished: boolean
  showVotesCount: boolean
  requireDevicePhotoMatch: boolean
  createdAt: string
}

export function PhotoContestsManagePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [contests, setContests] = useState<PhotoContest[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedContest, setSelectedContest] = useState<PhotoContest | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!eventId) return
    try {
      const contestsRes = await apiRequest<{ items: PhotoContest[] }>(`/events/${eventId}/photo-contests`)
      setContests(contestsRes.items)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!eventId || !title.trim()) return
    setCreating(true)
    setError('')
    try {
      await apiRequest(`/events/${eventId}/photo-contests`, {
        method: 'POST',
        bodyJson: {
          title: title.trim(),
          description: description.trim() || null,
          status: 'draft',
          votingEnabled: false,
          showVotesCount: true
        }
      })
      setTitle('')
      setDescription('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateContest = async (contestId: string, updates: Partial<PhotoContest>) => {
    if (!eventId) return
    try {
      await apiRequest(`/events/${eventId}/photo-contests/${contestId}`, {
        method: 'PATCH',
        bodyJson: updates
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    }
  }

  const handleSelectContest = async (contest: PhotoContest) => {
    setSelectedContest(contest)
  }

  const handleResetVotes = async (contestId: string) => {
    if (!eventId || !confirm('Resettare tutti i voti?')) return
    try {
      await apiRequest(`/events/${eventId}/photo-contests/${contestId}/reset-votes`, {
        method: 'POST'
      })
      alert('Voti resettati')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    }
  }

  const handleCloseContest = async (contestId: string) => {
    if (!eventId || !confirm('Chiudere il contest?')) return
    try {
      await apiRequest(`/events/${eventId}/photo-contests/${contestId}/close`, {
        method: 'POST'
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    }
  }

  if (loading) return <div className={styles.page}>Caricamento...</div>

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <h1 className={styles.title}>Gestione Photo Contest</h1>

        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.section}>
          <h2>Nuovo Contest</h2>
          <div className={styles.formRow}>
            <input
              type="text"
              placeholder="Titolo contest"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="Descrizione (opzionale)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.input}
            />
            <button onClick={handleCreate} disabled={creating || !title.trim()} className={styles.button}>
              {creating ? 'Creazione...' : 'Crea'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Contest esistenti</h2>
          {contests.length === 0 && <p>Nessun contest creato</p>}
          {contests.map(contest => (
            <div key={contest._id} className={styles.contestCard}>
              <div className={styles.contestHeader}>
                <div>
                  <h3>{contest.title}</h3>
                  <p>Stato: {contest.status} | Votazione: {contest.votingEnabled ? 'attiva' : 'disattiva'}</p>
                </div>
                <div className={styles.contestActions}>
                  <button onClick={() => handleSelectContest(contest)} className={styles.buttonSmall}>
                    Info
                  </button>
                  <button
                    onClick={() => handleUpdateContest(contest._id, { votingEnabled: !contest.votingEnabled, status: !contest.votingEnabled ? 'open' : 'draft' })}
                    className={styles.buttonSmall}
                  >
                    {contest.votingEnabled ? 'Disattiva voti' : 'Attiva voti'}
                  </button>
                  <button onClick={() => handleResetVotes(contest._id)} className={styles.buttonSmall}>
                    Reset voti
                  </button>
                  {contest.status !== 'closed' && (
                    <button onClick={() => handleCloseContest(contest._id)} className={styles.buttonSmallDanger}>
                      Chiudi contest
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

        {selectedContest && (
          <section className={styles.section}>
            <h2>Partecipanti al contest: {selectedContest.title}</h2>
            <p>Tutte le foto della galleria partecipano automaticamente al contest.</p>
            <div className={styles.saveRow}>
              <button onClick={() => setSelectedContest(null)} className={styles.buttonSecondary}>
                Chiudi
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
