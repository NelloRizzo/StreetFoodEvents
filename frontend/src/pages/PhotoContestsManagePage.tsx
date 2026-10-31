import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { medalForRank } from '../lib/photoLikes'
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

/* Una riga della classifica del pannello «Info»: solo le foto con almeno un
   voto, ordinate per gradino (gli ex aequo condividono il gradino). */
type ContestRankingRow = {
  photoId: string
  sequenceNumber: number | null
  imageUrl: string | null
  voteCount: number
  rank: number
}

export function PhotoContestsManagePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [contests, setContests] = useState<PhotoContest[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedContest, setSelectedContest] = useState<PhotoContest | null>(null)
  const [ranking, setRanking] = useState<ContestRankingRow[] | null>(null)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [totalVotes, setTotalVotes] = useState(0)
  const [rankingLoading, setRankingLoading] = useState(false)
  const [rankingError, setRankingError] = useState('')
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

  /* La classifica del pannello «Info» e' una rotta admin: i conteggi arrivano
     sempre, anche con «mostra voti» spento al pubblico. `isOpen` decide se
     mostrarla o solo accennarla, cosi' non si legge una classifica ferma
     credendo che sia la votazione in corso. */
  const loadRanking = useCallback(async (contestId: string) => {
    if (!eventId) return
    setRankingLoading(true)
    setRankingError('')
    try {
      const res = await apiRequest<{
        isOpen: boolean
        totalVotes: number
        ranking: ContestRankingRow[]
      }>(`/events/${eventId}/photo-contests/${contestId}/results`)
      setRankingOpen(res.isOpen)
      setTotalVotes(res.totalVotes)
      setRanking(res.ranking)
    } catch (err) {
      setRankingError(err instanceof Error ? err.message : 'Errore')
    } finally {
      setRankingLoading(false)
    }
  }, [eventId])

  /* Aprire/chiudere il contest o resettare i voti cambia la classifica: se il
     pannello e' aperto su quel contest va riallineato, altrimenti mostrerebbe
     il podio di un momento che non esiste piu'. */
  const refreshRankingIfSelected = (contestId: string) => {
    if (selectedContest?._id === contestId) void loadRanking(contestId)
  }

  const handleUpdateContest = async (contestId: string, updates: Partial<PhotoContest>) => {
    if (!eventId) return
    try {
      await apiRequest(`/events/${eventId}/photo-contests/${contestId}`, {
        method: 'PATCH',
        bodyJson: updates
      })
      load()
      refreshRankingIfSelected(contestId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    }
  }

  const handleSelectContest = (contest: PhotoContest) => {
    setSelectedContest(contest)
    setRanking(null)
    setRankingOpen(false)
    setTotalVotes(0)
    void loadRanking(contest._id)
  }

  const handleResetVotes = async (contestId: string) => {
    if (!eventId || !confirm('Resettare tutti i voti?')) return
    try {
      await apiRequest(`/events/${eventId}/photo-contests/${contestId}/reset-votes`, {
        method: 'POST'
      })
      alert('Voti resettati')
      load()
      refreshRankingIfSelected(contestId)
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
      refreshRankingIfSelected(contestId)
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
                  {contest.status !== 'closed' ? (
                    <button onClick={() => handleCloseContest(contest._id)} className={styles.buttonSmallDanger}>
                      Chiudi contest
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateContest(contest._id, { status: 'open', votingEnabled: true })}
                      className={styles.buttonSmall}
                    >
                      Riapri contest
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

            {rankingLoading && <p className={styles.rankingHint}>Caricamento classifica...</p>}
            {rankingError && <p className={styles.error}>{rankingError}</p>}

            {!rankingLoading && !rankingError && ranking && (
              rankingOpen ? (
                <>
                  <div className={styles.rankingHeader}>
                    <span className={styles.rankingTotal}>
                      {totalVotes} {totalVotes === 1 ? 'voto' : 'voti'}
                    </span>
                    <button
                      onClick={() => { void loadRanking(selectedContest._id) }}
                      className={styles.buttonSmall}
                    >
                      Aggiorna
                    </button>
                  </div>
                  {ranking.length === 0 ? (
                    <p className={styles.rankingHint}>Nessun voto registrato finora.</p>
                  ) : (
                    <ul className={styles.ranking}>
                      {ranking.map((row) => (
                        <li key={row.photoId} className={styles.rankingItem}>
                          <span className={styles.rankingMedal}>
                            {medalForRank(row.rank) ?? row.rank}
                          </span>
                          {row.imageUrl && (
                            <img
                              src={row.imageUrl}
                              alt={`Foto ${row.sequenceNumber ?? ''}`}
                              className={styles.rankingThumb}
                              loading="lazy"
                            />
                          )}
                          <span className={styles.rankingSeq}>#{row.sequenceNumber ?? '\u2014'}</span>
                          <span className={styles.rankingVotes}>
                            {row.voteCount} {row.voteCount === 1 ? 'voto' : 'voti'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className={styles.rankingHint}>
                  La classifica compare mentre la votazione è attiva.
                </p>
              )
            )}

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
