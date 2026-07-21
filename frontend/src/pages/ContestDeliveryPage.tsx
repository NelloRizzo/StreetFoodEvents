import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import { awardPrize, getContest } from '../lib/contests'
import { apiRequest } from '../lib/api'
import { QRScanner } from '../components/QRScanner'
import styles from './ContestDeliveryPage.module.scss'

type ContestData = {
  name: string
  prizes: { label: string; awarded: boolean }[]
}

type ParticipationData = {
  id: string
  contestId: string
  participantId: string
  scannedPOIIds: string[]
  completedAt: string | null
  isWinner: boolean | null
  prizeAwarded: boolean
  awardedPrizeLabel: string | null
  claimCode: string | null
}

export function ContestDeliveryPage() {
  const { contestId } = useParams<{ contestId: string }>()
  const [searchParams] = useSearchParams()
  const claimCodeParam = searchParams.get('claimCode')

  const [contest, setContest] = useState<ContestData | null>(null)
  const [participation, setParticipation] = useState<ParticipationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [inputCode, setInputCode] = useState('')
  const [awarding, setAwarding] = useState(false)
  const [awardResult, setAwardResult] = useState<string | null>(null)

  // Load contest info
  useEffect(() => {
    if (!contestId) return
    getContest(contestId)
      .then((data) => {
        setContest(data.item)
        setIsLoading(false)
      })
      .catch(() => {
        setError('Contest non trovato')
        setIsLoading(false)
      })
  }, [contestId])

  // Auto-lookup by claimCode from URL
  useEffect(() => {
    if (!contestId || !claimCodeParam) return
    lookupClaimCode(claimCodeParam)
  }, [contestId, claimCodeParam]) // eslint-disable-line react-hooks/exhaustive-deps

  async function lookupClaimCode(code: string) {
    if (!contestId) return
    setError(null)
    setParticipation(null)
    setAwardResult(null)
    try {
      const data = await apiRequest<ParticipationData>(`/contests/${contestId}/claim/${code.toUpperCase()}`)
      setParticipation(data)
    } catch {
      setError('Codice non valido o partecipazione non trovata')
    }
  }

  async function handleLookup() {
    if (!inputCode.trim()) return
    await lookupClaimCode(inputCode.trim())
  }

  function handleQrScan(decodedText: string) {
    setShowScanner(false)
    try {
      const url = new URL(decodedText)
      const code = url.searchParams.get('claimCode')
      if (code) {
        lookupClaimCode(code)
      } else {
        setError('QR code non valido')
        setTimeout(() => setError(null), 3000)
      }
    } catch {
      setError('QR code non valido')
      setTimeout(() => setError(null), 3000)
    }
  }

  async function handleAward() {
    if (!contestId || !participation || awarding) return
    setAwarding(true)
    try {
      await awardPrize(contestId, participation.participantId)
      setAwardResult('Premio consegnato con successo!')
      setParticipation((prev) => prev ? { ...prev, prizeAwarded: true } : null)
    } catch {
      setAwardResult('Errore durante la consegna')
    }
    setAwarding(false)
  }

  if (isLoading) return null
  if (!contest) {
    return (
      <div className={`page-shell ${styles.page}`}>
        <p className={styles.error}>{error ?? 'Contest non trovato'}</p>
      </div>
    )
  }

  return (
    <div className={`page-shell ${styles.page}`}>
      <h1 className={styles.title}>Consegna premio</h1>
      <p className={styles.contestName}>{contest.name}</p>

      {/* Search section */}
      <section className={styles.section}>
        <h2>Identifica il vincitore</h2>
        <div className={styles.inputRow}>
          <input
            className={styles.textInput}
            type="text"
            placeholder="Inserisci codice"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            maxLength={10}
          />
          <button className={styles.lookupBtn} onClick={handleLookup}>
            Cerca
          </button>
        </div>
        <button className={styles.scanBtn} onClick={() => setShowScanner(true)}>
          Scansiona QR Code
        </button>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {participation && (
        <section className={styles.section}>
          <div className={styles.participantCard}>
            <div className={styles.partRow}>
              <strong>Codice:</strong> {participation.claimCode}
            </div>
            <div className={styles.partRow}>
              <strong>Completato:</strong>{' '}
              {participation.completedAt
                ? new Date(participation.completedAt).toLocaleString('it-IT')
                : 'No'}
            </div>
            <div className={styles.partRow}>
              <strong>POI trovati:</strong> {participation.scannedPOIIds.length}
            </div>
            <div className={styles.partRow}>
              <strong>Premio:</strong> {participation.awardedPrizeLabel ?? 'Nessun premio'}
            </div>
            <div className={styles.partRow}>
              <strong>Stato:</strong>{' '}
              {participation.prizeAwarded ? (
                <span className={styles.delivered}>Già consegnato</span>
              ) : participation.isWinner ? (
                <span className={styles.ready}>Da consegnare</span>
              ) : (
                <span className={styles.notWin}>Non vincitore</span>
              )}
            </div>

            {participation.isWinner && participation.awardedPrizeLabel && !participation.prizeAwarded && (
              <button className={styles.awardBtn} onClick={handleAward} disabled={awarding}>
                {awarding ? 'Consegna in corso...' : 'Conferma consegna premio'}
              </button>
            )}

            {awardResult && (
              <p className={awardResult.includes('successo') ? styles.success : styles.error}>
                {awardResult}
              </p>
            )}
          </div>
        </section>
      )}

      {showScanner && (
        <QRScanner
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
