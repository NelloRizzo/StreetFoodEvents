import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { getContest, getParticipation, awardPrize } from '../lib/contests'
import { useAuth } from '../features/auth/auth-context'
import styles from './ContestVerifyPage.module.scss'

type ContestData = {
  name: string
  requireSequence: boolean
  prizes: { label: string; awarded: boolean }[]
}

type PoiBrief = {
  id: string
  name: string
}

type ParticipationData = {
  scannedPOIIds: string[]
  startedAt: string
  completedAt: string | null
  isWinner: boolean | null
  prizeAwarded: boolean
}

export function ContestVerifyPage() {
  const { contestId, participantId } = useParams<{ contestId: string; participantId: string }>()
  const { isAuthenticated } = useAuth()
  const [contest, setContest] = useState<ContestData | null>(null)
  const [pois, setPois] = useState<PoiBrief[]>([])
  const [participation, setParticipation] = useState<ParticipationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [awarding, setAwarding] = useState(false)

  useEffect(() => {
    if (!contestId || !participantId) return

    Promise.all([
      getContest(contestId),
      getParticipation(contestId, participantId),
    ])
      .then(([contestData, partData]) => {
        setContest(contestData.item)
        setPois(contestData.pois)
        setParticipation({
          scannedPOIIds: partData.scannedPOIIds,
          startedAt: partData.startedAt,
          completedAt: partData.completedAt,
          isWinner: partData.isWinner,
          prizeAwarded: partData.prizeAwarded,
        })
        setIsLoading(false)
      })
      .catch(() => {
        setError('Impossibile caricare i dati della verifica')
        setIsLoading(false)
      })
  }, [contestId, participantId])

  async function handleAward() {
    if (!contestId || !participantId || awarding) return
    setAwarding(true)
    try {
      const result = await awardPrize(contestId, participantId)
      setParticipation({
        scannedPOIIds: result.scannedPOIIds,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        isWinner: result.isWinner,
        prizeAwarded: result.prizeAwarded,
      })
    } catch { /* ignore */ }
    setAwarding(false)
  }

  if (isLoading) return null
  if (error || !contest || !participation) {
    return (
      <div className={`page-shell ${styles.page}`}>
        <p className={styles.error}>{error ?? 'Verifica non trovata'}</p>
      </div>
    )
  }

  const isWin = participation.isWinner === true

  return (
    <div className={`page-shell ${styles.page}`}>
      <h1 className={styles.title}>Verifica Contest</h1>
      <p className={styles.contestName}>{contest.name}</p>

      <div className={`${styles.result} ${isWin ? styles.win : styles.lose}`}>
        {isWin ? (
          <>
            <span className={styles.resultIcon}>&#127881;</span>
            <span className={styles.resultText}>Complimenti, hai vinto!</span>
          </>
        ) : participation.isWinner === false ? (
          <>
            <span className={styles.resultIcon}>&#10060;</span>
            <span className={styles.resultText}>Non hai completato il contest.</span>
          </>
        ) : (
          <>
            <span className={styles.resultIcon}>&#9203;</span>
            <span className={styles.resultText}>Partecipazione in corso...</span>
          </>
        )}
      </div>

      <section className={styles.section}>
        <h2>POI trovati ({participation.scannedPOIIds.length} / {pois.length})</h2>
        <div className={styles.poiList}>
          {pois.map((poi) => {
            const found = participation.scannedPOIIds.includes(poi.id)
            return (
              <div key={poi.id} className={`${styles.poiRow} ${found ? styles.poiFound : ''}`}>
                <span className={styles.poiStatus}>{found ? '\u2713' : '\u274C'}</span>
                <span className={styles.poiName}>{poi.name}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Dettagli</h2>
        <div className={styles.details}>
          <div>
            <strong>Iniziato:</strong>{' '}
            {new Date(participation.startedAt).toLocaleString('it-IT')}
          </div>
          {participation.completedAt && (
            <div>
              <strong>Completato:</strong>{' '}
              {new Date(participation.completedAt).toLocaleString('it-IT')}
            </div>
          )}
          <div>
            <strong>Stato:</strong>{' '}
            {isWin ? 'Vinto' : participation.isWinner === false ? 'Fallito' : 'In corso'}
          </div>
          {(contest.prizes ?? []).length > 0 && (
            <div>
              <strong>Premi assegnati:</strong> {(contest.prizes ?? []).filter((p) => p.awarded).length}/{(contest.prizes ?? []).length}
            </div>
          )}
          <div>
            <strong>Premio ritirato:</strong> {participation.prizeAwarded ? 'S\u00ec' : 'No'}
          </div>
        </div>
      </section>

      {isWin && !participation.prizeAwarded && isAuthenticated && (
        <button className={styles.awardBtn} onClick={handleAward} disabled={awarding}>
          {awarding ? 'Consegna in corso...' : 'Consegna premio'}
        </button>
      )}
    </div>
  )
}
