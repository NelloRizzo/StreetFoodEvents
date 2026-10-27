import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { getDeviceId } from '../lib/device'
import styles from './PhotoContestPage.module.scss'

type PhotoContest = {
  _id: string
  eventId: string
  title: string
  description: string | null
  status: 'draft' | 'open' | 'closed'
  votingEnabled: boolean
  resultsPublished: boolean
  showVotesCount: boolean
}

type ContestItem = {
  entryId: string
  photoId: string
  photo: {
    id: string
    type: 'image' | 'video'
    image: { url: string } | null
    sequenceNumber: number
  }
  voteCount?: number
  rank?: number | null
}

type ContestData = {
  contest: PhotoContest
  items: ContestItem[]
  hasVoted: boolean
  votedPhotoId: string | null
  isOpen: boolean
}

export function PhotoContestPage() {
  const { eventId, contestId } = useParams<{ eventId: string; contestId: string }>()
  const [data, setData] = useState<ContestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    if (!eventId || !contestId) return
    try {
      const deviceId = getDeviceId()
      const res = await apiRequest<ContestData>(`/events/${eventId}/photo-contests/${contestId}?deviceId=${encodeURIComponent(deviceId)}`)
      setData(res)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
      setLoading(false)
    }
  }, [eventId, contestId])

  useEffect(() => {
    load()
  }, [load])

  const handleVote = async (photoId: string) => {
    if (!eventId || !contestId || voting) return
    if (data?.hasVoted) {
      setError('Hai già votato in questo contest')
      return
    }
    setVoting(photoId)
    setError('')
    setSuccess('')
    try {
      const deviceId = getDeviceId()
      await apiRequest(`/events/${eventId}/photo-contests/${contestId}/vote`, {
        method: 'POST',
        bodyJson: { photoId, deviceId }
      })
      setSuccess('Voto registrato!')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel voto')
    } finally {
      setVoting(null)
    }
  }

  if (loading) return <div className={styles.page}>Caricamento...</div>
  if (!data) return <div className={styles.page}>Contest non trovato</div>

  const { contest, items, hasVoted, votedPhotoId, isOpen } = data

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <h1 className={styles.title}>{contest.title}</h1>
        {contest.description && <p className={styles.description}>{contest.description}</p>}
        
        {contest.status === 'closed' && contest.resultsPublished && (
          <div className={styles.resultsBanner}>Risultati pubblicati</div>
        )}
        
        {!isOpen && contest.status !== 'closed' && (
          <div className={styles.closedBanner}>Votazione non attiva</div>
        )}
        
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
        {hasVoted && !success && <p className={styles.votedMsg}>Hai già votato in questo contest</p>}

        <div className={styles.grid}>
          {items.map((item) => (
            <div
              key={item.photoId}
              className={`${styles.card} ${votedPhotoId === item.photoId ? styles.votedCard : ''} ${item.rank && item.rank <= 3 ? styles.topCard : ''}`}
            >
              {item.photo.image && (
                <img src={item.photo.image.url} alt={`Foto ${item.photo.sequenceNumber}`} className={styles.image} />
              )}
              <div className={styles.cardInfo}>
                <span className={styles.seq}>#{item.photo.sequenceNumber}</span>
                {item.rank && item.rank <= 3 && (
                  <span className={`${styles.badge} ${styles[`badge${item.rank}`]}`}>
                    {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
                  </span>
                )}
                {item.voteCount !== undefined && (contest.showVotesCount || contest.resultsPublished) && (
                  <span className={styles.voteCount}>{item.voteCount} voti</span>
                )}
              </div>
              {isOpen && !hasVoted && (
                <button
                  onClick={() => handleVote(item.photoId)}
                  disabled={voting === item.photoId}
                  className={styles.voteBtn}
                >
                  {voting === item.photoId ? 'Voto...' : 'Vota'}
                </button>
              )}
              {votedPhotoId === item.photoId && (
                <div className={styles.yourVote}>Il tuo voto</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
