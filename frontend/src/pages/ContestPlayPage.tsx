import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getContest, getParticipation, registerScan } from '../lib/contests'
import { QRScanner } from '../components/QRScanner'
import styles from './ContestPlayPage.module.scss'

type ContestData = {
  id: string
  name: string
  durationMinutes: number
  requireSequence: boolean
  prizes: { label: string; awarded: boolean }[]
  awardedPrizesCount: number
}

type PoiBrief = {
  id: string
  name: string
  hint: string | null
}

type ParticipationState = {
  scannedPOIIds: string[]
  completedAt: string | null
  isWinner: boolean | null
  prizeAwarded: boolean
  awardedPrizeLabel: string | null
}

function getParticipantId(contestId: string): string | null {
  return localStorage.getItem(`contest_${contestId}_participantId`)
}

export function ContestPlayPage() {
  const { contestId } = useParams<{ contestId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [contest, setContest] = useState<ContestData | null>(null)
  const [pois, setPois] = useState<PoiBrief[]>([])
  const [participation, setParticipation] = useState<ParticipationState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [scanMessage, setScanMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [finished, setFinished] = useState(false)
  const startedAtRef = useRef<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const participantIdLocal = getParticipantId(contestId!)
  const scanPoiId = searchParams.get('poi')

  // Handle direct QR scan URL: /contest/{contestId}/play?poi={poiId}
  useEffect(() => {
    if (scanPoiId && contestId && participantIdLocal && !showScanner) {
      handleScanPoi(scanPoiId)
    }
  }, [scanPoiId, contestId, participantIdLocal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load contest + participation
  useEffect(() => {
    if (!contestId) return
    const pid = getParticipantId(contestId) || crypto.randomUUID()
    localStorage.setItem(`contest_${contestId}_participantId`, pid)

    getContest(contestId)
      .then((data) => {
        setContest(data.item)
        setPois(data.pois)
        // Try to recover existing participation
        return getParticipation(contestId, pid).catch(() => null)
      })
      .then((part) => {
        if (part) {
          setParticipation({
            scannedPOIIds: part.scannedPOIIds,
            completedAt: part.completedAt,
            isWinner: part.isWinner,
            prizeAwarded: part.prizeAwarded,
            awardedPrizeLabel: part.awardedPrizeLabel ?? null,
          })
          if (part.completedAt || part.isWinner !== null) {
            setFinished(true)
          }
        }
        setIsLoading(false)
      })
      .catch(() => {
        setError('Impossibile caricare il contest')
        setIsLoading(false)
      })
  }, [contestId])

  // Countdown timer
  useEffect(() => {
    if (!contest || finished) return

    if (!startedAtRef.current) {
      startedAtRef.current = Date.now()
    }

    function tick() {
      const elapsed = (Date.now() - startedAtRef.current!) / 1000
      const remaining = Math.max(0, contest!.durationMinutes * 60 - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0) {
        setFinished(true)
        setParticipation((prev) => prev ? { ...prev, isWinner: false, completedAt: new Date().toISOString() } : null)
      }
    }

    tick()
    pollRef.current = setInterval(tick, 1000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [contest, finished])

  async function handleScanPoi(poiId: string) {
    if (!contestId || !participantIdLocal || finished) return

    try {
      const result = await registerScan(contestId, participantIdLocal, poiId)
      setParticipation({
        scannedPOIIds: result.scannedPOIIds,
        completedAt: result.completedAt,
        isWinner: result.isWinner,
        prizeAwarded: result.prizeAwarded,
        awardedPrizeLabel: result.awardedPrizeLabel ?? null,
      })
      setScanMessage({ ok: true, text: 'POI trovato!' })
      setTimeout(() => setScanMessage(null), 2000)

      if (result.completedAt || result.isWinner !== null) {
        setFinished(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore scansione'
      setScanMessage({ ok: false, text: msg })
      setTimeout(() => setScanMessage(null), 3000)
    }
  }

  function handleQrScan(decodedText: string) {
    setShowScanner(false)
    // Decoded URL format: {origin}/contest/{contestId}/play?poi={poiId}
    try {
      const url = new URL(decodedText)
      const poi = url.searchParams.get('poi')
      if (poi) {
        handleScanPoi(poi)
      } else {
        setScanMessage({ ok: false, text: 'QR code non valido' })
        setTimeout(() => setScanMessage(null), 3000)
      }
    } catch {
      // Maybe raw poi:id format
      if (decodedText.startsWith('poi:')) {
        const poi = decodedText.slice(4)
        if (poi) handleScanPoi(poi)
      } else {
        setScanMessage({ ok: false, text: 'QR code non valido' })
        setTimeout(() => setScanMessage(null), 3000)
      }
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (isLoading) return null
  if (error || !contest) {
    return (
      <div className={`page-shell ${styles.page}`}>
        <p className={styles.error}>{error ?? 'Contest non trovato'}</p>
      </div>
    )
  }

  if (finished) {
    const isWin = participation?.isWinner === true
    const scannedCount = participation?.scannedPOIIds.length ?? 0

    return (
      <div className={`page-shell ${styles.page}`}>
        <div className={styles.finishedCard}>
          {isWin ? (
            <>
              <span className={styles.finishIcon}>&#127881;</span>
              <h2 className={styles.finishTitle}>Complimenti!</h2>
              <p className={styles.finishDesc}>Hai trovato tutti i POI!</p>
              {participation?.awardedPrizeLabel && <span className={styles.prizeTag}>Hai vinto: {participation.awardedPrizeLabel}</span>}
              <button
                className={styles.verifyBtn}
                onClick={() => navigate(`/contest/${contestId}/verify/${participantIdLocal}`)}
              >
                Mostra verifica
              </button>
            </>
          ) : participation?.completedAt ? (
            <>
              <span className={styles.finishIcon}>&#9203;</span>
              <h2 className={styles.finishTitle}>Tempo scaduto!</h2>
              <p className={styles.finishDesc}>Hai trovato {scannedCount} di {pois.length} POI.</p>
              <button
                className={styles.verifyBtn}
                onClick={() => navigate(`/contest/${contestId}/verify/${participantIdLocal}`)}
              >
                Mostra verifica
              </button>
            </>
          ) : (
            <>
              <span className={styles.finishIcon}>&#9203;</span>
              <h2 className={styles.finishTitle}>Tempo scaduto!</h2>
              <p className={styles.finishDesc}>Hai trovato {scannedCount} di {pois.length} POI.</p>
              <button
                className={styles.verifyBtn}
                onClick={() => navigate(`/contest/${contestId}/verify/${participantIdLocal}`)}
              >
                Mostra verifica
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const scannedIds = participation?.scannedPOIIds ?? []

  return (
    <div className={styles.page}>
      <div className={`page-shell ${styles.inner}`}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.contestName}>{contest.name}</h1>
          {contest.prizes.length > 0 && (
            <div className={styles.prizeStatus}>
              Prizes: {contest.awardedPrizesCount}/{contest.prizes.length}
            </div>
          )}
          <div className={`${styles.timer} ${timeLeft !== null && timeLeft < 60 ? styles.timerUrgent : ''}`}>
            {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
          </div>
        </div>

        {/* Scan message toast */}
        {scanMessage && (
          <div className={`${styles.toast} ${scanMessage.ok ? styles.toastOk : styles.toastErr}`}>
            {scanMessage.text}
          </div>
        )}

        {/* POI List */}
        <div className={styles.poiGrid}>
          {pois.map((poi) => {
            const found = scannedIds.includes(poi.id)
            return (
              <div key={poi.id} className={`${styles.poiItem} ${found ? styles.poiFound : ''}`}>
                <span className={styles.poiStatus}>{found ? '\u2713' : '\u2753'}</span>
                <div className={styles.poiName}>{poi.name}</div>
              </div>
            )
          })}
        </div>

        {/* Scan button */}
        <button className={styles.scanBtn} onClick={() => setShowScanner(true)}>
          Scansiona QR Code
        </button>
      </div>

      {showScanner && (
        <QRScanner
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
