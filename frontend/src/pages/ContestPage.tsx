import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { getContest } from '../lib/contests'
import styles from './ContestPage.module.scss'

type ContestData = {
  id: string
  name: string
  description: string | null
  startsAt: string
  endsAt: string
  durationMinutes: number
  requireSequence: boolean
  prizes: { label: string; awarded: boolean }[]
  isActive: boolean
}

type PoiBrief = {
  id: string
  name: string
  hint: string | null
}

export function ContestPage() {
  const { contestId } = useParams<{ contestId: string }>()
  const navigate = useNavigate()
  const [contest, setContest] = useState<ContestData | null>(null)
  const [pois, setPois] = useState<PoiBrief[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contestId) return
    getContest(contestId)
      .then((data) => {
        setContest(data.item)
        setPois(data.pois)
        setIsLoading(false)
      })
      .catch(() => {
        setError('Contest non trovato')
        setIsLoading(false)
      })
  }, [contestId])

  function handleStart() {
    if (!contestId || !contest) return
    const pid = localStorage.getItem(`contest_${contestId}_participantId`) || crypto.randomUUID()
    localStorage.setItem(`contest_${contestId}_participantId`, pid)
    navigate(`/contest/${contestId}/play`)
  }

  if (isLoading) return null
  if (error || !contest) {
    return (
      <div className={`page-shell ${styles.page}`}>
        <p className={styles.error}>{error ?? 'Contest non trovato'}</p>
      </div>
    )
  }

  const now = new Date()
  const startsAt = new Date(contest.startsAt)
  const endsAt = new Date(contest.endsAt)
  const canPlay = contest.isActive && now >= startsAt && now <= endsAt

  return (
    <div className={`page-shell ${styles.page}`}>
      <div className={styles.hero}>
        <h1 className={styles.title}>{contest.name}</h1>
        {contest.description && <p className={styles.description}>{contest.description}</p>}
        {(contest.prizes ?? []).length > 0 && (
          <span className={styles.prize}>
            Premi: {(contest.prizes ?? []).filter((p) => p.awarded).length}/{(contest.prizes ?? []).length}
          </span>
        )}
      </div>

      <div className={styles.infoRow}>
        <div className={styles.info}>
          <strong>Durata</strong>
          <span>{contest.durationMinutes} minuti</span>
        </div>
        <div className={styles.info}>
          <strong>Ordine</strong>
          <span>{contest.requireSequence ? 'Sequenza precisa' : 'Libero'}</span>
        </div>
        <div className={styles.info}>
          <strong>Disponibile</strong>
          <span>{startsAt.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} &ndash; {endsAt.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      <section className={styles.poiSection}>
        <h2>POI da trovare ({pois.length})</h2>
        <div className={styles.poiList}>
          {pois.map((poi, i) => (
            <div key={poi.id} className={styles.poiCard}>
              <span className={styles.poiIndex}>{i + 1}</span>
              <div className={styles.poiBody}>
                <strong className={styles.poiName}>{poi.name}</strong>
                {poi.hint && <span className={styles.poiHint}>{poi.hint}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {canPlay ? (
        <button className={styles.startBtn} onClick={handleStart}>
          Inizia il contest!
        </button>
      ) : (
        <p className={styles.notAvailable}>
          {now < startsAt ? 'Il contest non è ancora iniziato.' : 'Il contest è terminato.'}
        </p>
      )}
    </div>
  )
}
