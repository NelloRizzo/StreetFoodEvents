import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import styles from './UsageContractsPage.module.scss'

type EventItem = { id: string; name: string }
type UserItem = { id: string; firstName: string; lastName: string; email: string }

type UsageContract = {
  id: string
  userId: string
  eventId: string
  maxStands: number
  status: string
  startsAt: string | null
  endsAt: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  user: UserItem | null
  event: EventItem | null
  createdByUser: { firstName: string; lastName: string } | null
}

const statusLabels: Record<string, string> = {
  active: 'Attivo',
  suspended: 'Sospeso',
  expired: 'Scaduto',
}

const emptyForm = {
  userId: '',
  eventId: '',
  maxStands: 1,
  notes: '',
  startsAt: '',
  endsAt: '',
}

export function UsageContractsPage() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<UsageContract[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterEventId, setFilterEventId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)

  const loadContracts = useCallback(async (eventId?: string) => {
    const query = eventId ? `?eventId=${eventId}` : ''
    const data = await apiRequest<{ items: UsageContract[] }>(`/usage-contracts${query}`)
    setContracts(data.items)
  }, [])

  const loadRefs = useCallback(async () => {
    const [evData, usData] = await Promise.all([
      apiRequest<{ items: EventItem[] }>('/events'),
      apiRequest<{ items: UserItem[] }>('/users'),
    ])
    setEvents(evData.items)
    setAllUsers(usData.items)
  }, [])

  useEffect(() => {
    Promise.all([loadContracts(), loadRefs()]).finally(() => setIsLoading(false))
  }, [loadContracts, loadRefs])

  useEffect(() => {
    loadContracts(filterEventId || undefined)
  }, [filterEventId, loadContracts])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (c: UsageContract) => {
    setForm({
      userId: c.userId,
      eventId: c.eventId,
      maxStands: c.maxStands,
      notes: c.notes ?? '',
      startsAt: c.startsAt ? c.startsAt.slice(0, 10) : '',
      endsAt: c.endsAt ? c.endsAt.slice(0, 10) : '',
    })
    setEditingId(c.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.userId || !form.eventId) {
      setAlertMsg('Seleziona utente e evento')
      return
    }
    setSaving(true)
    setAlertMsg(null)
    try {
      const body: Record<string, unknown> = {
        userId: form.userId,
        eventId: form.eventId,
        maxStands: form.maxStands,
        notes: form.notes || null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      }
      if (editingId) {
        await apiRequest(`/usage-contracts/${editingId}`, { method: 'PATCH', bodyJson: body })
      } else {
        await apiRequest('/usage-contracts', { method: 'POST', bodyJson: body })
      }
      setShowForm(false)
      await loadContracts(filterEventId || undefined)
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Errore durante il salvataggio')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo contratto?')) return
    try {
      await apiRequest(`/usage-contracts/${id}`, { method: 'DELETE' })
      await loadContracts(filterEventId || undefined)
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Errore durante l\'eliminazione')
    }
  }

  const handleToggleStatus = async (c: UsageContract) => {
    const newStatus = c.status === 'active' ? 'suspended' : 'active'
    try {
      await apiRequest(`/usage-contracts/${c.id}`, { method: 'PATCH', bodyJson: { status: newStatus } })
      await loadContracts(filterEventId || undefined)
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Errore durante l\'aggiornamento')
    }
  }

  const filteredUsers = allUsers.filter((u) => {
    if (!editingId) return !contracts.some((c) => c.userId === u.id)
    return !contracts.some((c) => c.userId === u.id && c.id !== editingId)
  })

  if (isLoading) return null
  if (!user?.isAdmin) return <div className={styles.page}><div className="page-shell"><p className={styles.empty}>Accesso negato.</p></div></div>

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <h1 className={styles.title}>Contratti d&rsquo;Uso</h1>
          <button className={styles.createBtn} onClick={openCreate}>Nuovo contratto</button>
        </div>

        {alertMsg && <div className={styles.alert}>{alertMsg}</div>}

        <div className={styles.filterBar}>
          <label>Filtra per evento</label>
          <select value={filterEventId} onChange={(e) => setFilterEventId(e.target.value)}>
            <option value="">Tutti gli eventi</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.list}>
          {contracts.length === 0 && <p className={styles.empty}>Nessun contratto trovato.</p>}
          {contracts.map((c) => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardBody}>
                <div className={styles.cardRow}>
                  <span className={styles.cardLabel}>Utente</span>
                  <span className={styles.cardValue}>
                    {c.user ? `${c.user.firstName} ${c.user.lastName}` : '—'}
                    {c.user && <span className={styles.cardSub}>{c.user.email}</span>}
                  </span>
                </div>
                <div className={styles.cardRow}>
                  <span className={styles.cardLabel}>Evento</span>
                  <span className={styles.cardValue}>{c.event?.name ?? '—'}</span>
                </div>
                <div className={styles.cardRow}>
                  <span className={styles.cardLabel}>Max stand</span>
                  <span className={styles.cardValue}>{c.maxStands}</span>
                </div>
                <div className={styles.cardRow}>
                  <span className={styles.cardLabel}>Stato</span>
                  <span className={`${styles.statusBadge} ${styles[`status_${c.status}`]}`}>
                    {statusLabels[c.status] ?? c.status}
                  </span>
                </div>
                {c.notes && (
                  <div className={styles.cardRow}>
                    <span className={styles.cardLabel}>Note</span>
                    <span className={styles.cardValue}>{c.notes}</span>
                  </div>
                )}
                <div className={styles.cardMeta}>
                  Creato il {new Date(c.createdAt).toLocaleDateString('it-IT')}
                  {c.createdByUser && ` da ${c.createdByUser.firstName} ${c.createdByUser.lastName}`}
                </div>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.actionBtn} onClick={() => openEdit(c)}>Modifica</button>
                <button
                  className={`${styles.actionBtn} ${c.status === 'active' ? styles.warnBtn : styles.okBtn}`}
                  onClick={() => handleToggleStatus(c)}
                >
                  {c.status === 'active' ? 'Sospendi' : 'Attiva'}
                </button>
                <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={() => handleDelete(c.id)}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className={styles.overlay} onClick={() => setShowForm(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>{editingId ? 'Modifica contratto' : 'Nuovo contratto'}</h2>

              <label className={styles.field}>
                <span>Utente</span>
                <select
                  value={form.userId}
                  onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
                  disabled={!!editingId}
                >
                  <option value="">Seleziona utente</option>
                  {(editingId ? allUsers : filteredUsers).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Evento</span>
                <select
                  value={form.eventId}
                  onChange={(e) => setForm((prev) => ({ ...prev, eventId: e.target.value }))}
                  disabled={!!editingId}
                >
                  <option value="">Seleziona evento</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Numero massimo stand</span>
                <input
                  type="number"
                  min={1}
                  value={form.maxStands}
                  onChange={(e) => setForm((prev) => ({ ...prev, maxStands: Math.max(1, Number(e.target.value)) }))}
                />
              </label>

              <label className={styles.field}>
                <span>Note (opzionale)</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  maxLength={500}
                  rows={3}
                />
              </label>

              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span>Inizio (opz.)</span>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span>Fine (opz.)</span>
                  <input
                    type="date"
                    value={form.endsAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                  />
                </label>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvataggio...' : editingId ? 'Salva modifiche' : 'Crea contratto'}
                </button>
                <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Annulla</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
