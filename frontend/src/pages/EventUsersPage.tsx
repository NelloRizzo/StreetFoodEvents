import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import { QRScanner } from '../components/QRScanner'
import { ConfirmModal } from '../components/ConfirmModal'
import styles from './EventUsersPage.module.scss'

type Event = { id: string; name: string; currencyName: string }
type User = { id: string; firstName: string; lastName: string; email: string }

type EventUser = {
  id: string
  eventId: string
  userId: string
  balance: number
  isActive: boolean
  joinedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

type Transaction = {
  id: string
  eventUserId: string
  type: string
  direction: string
  amount: number
  balanceAfter: number
  description: string | null
  occurredAt: string
}

export function EventUsersPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [eventUsers, setEventUsers] = useState<EventUser[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const [showScanner, setShowScanner] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)

  const [txnType] = useState<'top-up' | 'purchase' | 'refund' | 'manual_adjustment' | 'bonus'>('top-up')
  const [txnDirection, setTxnDirection] = useState<'credit' | 'debit'>('credit')
  const [txnAmount, setTxnAmount] = useState('')
  const [txnDesc, setTxnDesc] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showTxn, setShowTxn] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiRequest<{ items: Event[] }>('/events'),
      apiRequest<{ items: User[] }>('/users'),
    ]).then(([eventsData, usersData]) => {
      setEvents(eventsData.items)
      setUsers(usersData.items)
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    setEventUsers([])
    setShowTxn(null)
    if (!selectedEventId) return
    apiRequest<{ items: EventUser[] }>(`/events/${selectedEventId}/users`)
      .then((d) => setEventUsers(d.items))
      .catch(() => setEventUsers([]))
  }, [selectedEventId])

  const handleScan = useCallback(async (qrData: string) => {
    setShowScanner(false)
    const userId = qrData.trim()
    if (!userId) return
    try {
      const res = await apiRequest<{ item: User }>(`/users/${userId}`)
      setSelectedUserId(res.item.id)
    } catch {
      setAlertMsg('Utente non trovato. Il QR code non corrisponde a un utente valido.')
    }
  }, [])

  const handleLink = async () => {
    if (!selectedEventId || !selectedUserId) return
    await apiRequest('/event-users', {
      method: 'POST',
      bodyJson: { eventId: selectedEventId, userId: selectedUserId, notes: notes || null },
    })
    setSelectedUserId('')
    setNotes('')
    const d = await apiRequest<{ items: EventUser[] }>(`/events/${selectedEventId}/users`)
    setEventUsers(d.items)
  }

  const handleTransaction = async (eventUserId: string) => {
    if (!txnAmount) return
    await apiRequest(`/event-users/${eventUserId}/transactions`, {
      method: 'POST',
      bodyJson: {
        type: txnType,
        direction: txnDirection,
        amount: Number(txnAmount),
        description: txnDesc || null,
        performedByUserId: user?.id ?? null,
      },
    })
    setTxnAmount('')
    setTxnDesc('')
    const d = await apiRequest<{ items: EventUser[] }>(`/events/${selectedEventId}/users`)
    setEventUsers(d.items)
    if (showTxn === eventUserId) {
      loadTransactions(eventUserId)
    }
  }

  const loadTransactions = async (eventUserId: string) => {
    const d = await apiRequest<{ items: Transaction[] }>(`/event-users/${eventUserId}/transactions`)
    setTransactions(d.items)
  }

  const toggleTxn = (eventUserId: string) => {
    if (showTxn === eventUserId) {
      setShowTxn(null)
      setTransactions([])
      return
    }
    setShowTxn(eventUserId)
    loadTransactions(eventUserId)
  }

  const userName = (id: string) => {
    const u = users.find((u) => u.id === id)
    return u ? `${u.firstName} ${u.lastName}` : id
  }

  const linkedUserIds = () => new Set(eventUsers.map((eu) => eu.userId))
  const availableUsers = users.filter((u) => !linkedUserIds().has(u.id))

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('it-IT') : '—'

  const directionLabel: Record<string, string> = { credit: 'Accredita', debit: 'Addebita' }

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Gestione</span>
            <h1 className={styles.title}>Partecipanti evento</h1>
          </div>
        </div>

        <div className={styles.filters}>
          <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">Seleziona evento</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        {selectedEventId && (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Collega utente all&apos;evento</h2>
              <div className={styles.linkRow}>
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                  <option value="">Seleziona utente</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                  ))}
                </select>
                <button className={styles.qrBtn} onClick={() => setShowScanner(true)} title="Scansiona QR code utente">
                  &#128247; QR
                </button>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (opzionali)" />
                <button className={styles.primaryBtn} onClick={handleLink} disabled={!selectedUserId}>
                  Collega
                </button>
              </div>
              {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                Partecipanti ({eventUsers.length})
              </h2>
              <div className={styles.list}>
                {eventUsers.map((eu) => {
                  const event = events.find((e) => e.id === eu.eventId)
                  return (
                    <article key={eu.id} className={styles.card}>
                      <div className={styles.cardBody}>
                        <strong className={styles.cardName}>{userName(eu.userId)}</strong>
                        <span className={styles.cardBalance}>
                          Saldo: {eu.balance} {event?.currencyName ?? 'crediti'}
                        </span>
                        <span className={styles.cardMeta}>
                          {eu.isActive ? 'Attivo' : 'Disattivato'} · Iscritto: {fmtDate(eu.joinedAt)}
                        </span>
                        {eu.notes && <span className={styles.cardNotes}>{eu.notes}</span>}
                      </div>
                      <div className={styles.cardActions}>
                        <button className={styles.textBtn} onClick={() => toggleTxn(eu.id)}>
                          {showTxn === eu.id ? 'Chiudi' : 'Transazioni'}
                        </button>
                      </div>

                      {showTxn === eu.id && (
                        <div className={styles.txnSection}>
                          <div className={styles.txnRow}>
                            <select value={txnDirection} onChange={(e) => setTxnDirection(e.target.value as 'credit' | 'debit')}>
                              <option value="credit">Accredita</option>
                              <option value="debit">Addebita</option>
                            </select>
                            <input type="number" min={0} step={0.01} value={txnAmount} onChange={(e) => setTxnAmount(e.target.value)} placeholder="Importo" />
                            <input value={txnDesc} onChange={(e) => setTxnDesc(e.target.value)} placeholder="Descrizione" />
                            <button className={styles.primaryBtn} onClick={() => handleTransaction(eu.id)} disabled={!txnAmount}>
                              {directionLabel[txnDirection]}
                            </button>
                          </div>

                          {transactions.length > 0 && (
                            <div className={styles.txnList}>
                              {transactions.map((tx) => (
                                <div key={tx.id} className={styles.txnRow}>
                                  <span className={tx.direction === 'credit' ? styles.txnCredit : styles.txnDebit}>
                                    {tx.direction === 'credit' ? '+' : '-'}{tx.amount.toFixed(2)}
                                  </span>
                                  <span className={styles.txnType}>{tx.type}</span>
                                  <span className={styles.txnDesc}>{tx.description ?? ''}</span>
                                  <span className={styles.txnDate}>{fmtDate(tx.occurredAt)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {transactions.length === 0 && (
                            <p className={styles.empty}>Nessuna transazione.</p>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}

                {eventUsers.length === 0 && (
                  <p className={styles.empty}>Nessun partecipante.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <ConfirmModal
        open={alertMsg !== null}
        variant="alert"
        title="Attenzione"
        message={alertMsg ?? ''}
        confirmLabel="OK"
        onConfirm={() => setAlertMsg(null)}
        onCancel={() => setAlertMsg(null)}
      />
    </div>
  )
}
