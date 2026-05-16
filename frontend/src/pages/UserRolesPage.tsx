import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import styles from './EventUsersPage.module.scss'

type User = { id: string; firstName: string; lastName: string; email: string }
type Role = { id: string; name: string; slug: string; scope: string; isSystem: boolean }
type Event = { id: string; name: string }
type Stand = { id: string; name: string }

type PopulatedUser = { _id: string; firstName: string; lastName: string; email: string }
type PopulatedRole = { _id: string; name: string; slug: string; scope: string }

type UserRole = {
  id: string
  userId: PopulatedUser
  roleId: PopulatedRole
  eventId: string | null
  standId: string | null
  assignedBy: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const scopeLabels: Record<string, string> = {
  platform: 'Piattaforma',
  event: 'Evento',
  stand: 'Stand',
}

export function UserRolesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [stands, setStands] = useState<Stand[]>([])
  const [assignments, setAssignments] = useState<UserRole[]>([])

  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedStandId, setSelectedStandId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadAssignments = () => {
    apiRequest<{ items: UserRole[] }>('/user-roles')
      .then((d) => setAssignments(d.items))
      .catch(() => {})
  }

  useEffect(() => {
    Promise.all([
      apiRequest<{ items: User[] }>('/users'),
      apiRequest<{ items: Role[] }>('/roles'),
      apiRequest<{ items: Event[] }>('/events'),
      apiRequest<{ items: Stand[] }>('/stands'),
    ]).then(([u, r, e, s]) => {
      setUsers(u.items)
      setRoles(r.items)
      setEvents(e.items)
      setStands(s.items)
    })
    loadAssignments()
  }, [])

  const selectedRole = roles.find((r) => r.id === selectedRoleId)

  const handleCreate = async () => {
    if (!selectedUserId || !selectedRoleId) return
    setIsSubmitting(true)
    try {
      const body: Record<string, string | undefined> = {
        userId: selectedUserId,
        roleId: selectedRoleId,
        eventId: selectedRole?.scope === 'event' ? selectedEventId || undefined : undefined,
        standId: selectedRole?.scope === 'stand' ? selectedStandId || undefined : undefined,
      }
      await apiRequest('/user-roles', { method: 'POST', bodyJson: body })
      loadAssignments()
      setSelectedUserId('')
      setSelectedRoleId('')
      setSelectedEventId('')
      setSelectedStandId('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await apiRequest(`/user-roles/${id}/toggle`, { method: 'PATCH' })
      loadAssignments()
    } catch { }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Rimuovere questa assegnazione di ruolo?')) return
    try {
      await apiRequest(`/user-roles/${id}`, { method: 'DELETE' })
      loadAssignments()
    } catch { }
  }

  function userName(u: PopulatedUser) {
    return `${u.firstName} ${u.lastName}`
  }

  function roleName(r: PopulatedRole) {
    return `${r.name} (${scopeLabels[r.scope] ?? r.scope})`
  }

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Amministrazione</span>
            <h1 className={styles.title}>Ruoli utenti</h1>
          </div>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Assegna ruolo</h2>
          <div className={styles.linkRow}>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">— Utente —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
              ))}
            </select>
            <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>
              <option value="">— Ruolo —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({scopeLabels[r.scope]})</option>
              ))}
            </select>
            {selectedRole?.scope === 'event' && (
              <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                <option value="">— Evento —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            )}
            {selectedRole?.scope === 'stand' && (
              <select value={selectedStandId} onChange={(e) => setSelectedStandId(e.target.value)}>
                <option value="">— Stand —</option>
                {stands.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <button className={styles.primaryBtn} onClick={handleCreate} disabled={!selectedUserId || !selectedRoleId || isSubmitting}>
              {isSubmitting ? 'Salvataggio...' : 'Assegna'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Assegnazioni ({assignments.length})</h2>
          <div className={styles.list}>
            {assignments.map((a) => (
              <article key={a.id} className={styles.card}>
                <div className={styles.cardBody}>
                  <strong className={styles.cardName}>{userName(a.userId)}</strong>
                  <span>{roleName(a.roleId)}</span>
                  {a.eventId && (
                    <span className={styles.cardMeta}>Evento: {events.find((e) => e.id === a.eventId)?.name ?? a.eventId}</span>
                  )}
                  {a.standId && (
                    <span className={styles.cardMeta}>Stand: {stands.find((s) => s.id === a.standId)?.name ?? a.standId}</span>
                  )}
                  <span className={styles.cardMeta}>
                    {a.isActive ? 'Attivo' : 'Disattivato'}
                  </span>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.secondaryBtn} onClick={() => handleToggle(a.id)}>
                    {a.isActive ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button className={styles.dangerBtn} onClick={() => handleDelete(a.id)}>
                    Rimuovi
                  </button>
                </div>
              </article>
            ))}
            {assignments.length === 0 && (
              <p className={styles.empty}>Nessuna assegnazione.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
