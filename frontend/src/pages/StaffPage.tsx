import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import styles from './StaffPage.module.scss'

type Stand = { id: string; name: string }
type Station = { id: string; name: string; standId: string }
type User = { id: string; firstName: string; lastName: string; email: string }
type UserStation = {
  id: string
  userId: string
  stationId: string
  isActive: boolean
  station: { id: string; name: string; standId: string } | null
}

export function StaffPage() {
  const [stands, setStands] = useState<Stand[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [assignments, setAssignments] = useState<UserStation[]>([])

  const [selectedStandId, setSelectedStandId] = useState('')
  const [selectedStationId, setSelectedStationId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const fetchStands = async () => {
    const data = await apiRequest<{ items: Stand[] }>('/stands')
    setStands(data.items)
  }

  const fetchUsers = async () => {
    const data = await apiRequest<{ items: User[] }>('/users')
    setUsers(data.items)
  }

  const fetchAssignments = async (stationId: string) => {
    const data = await apiRequest<{ items: UserStation[] }>(`/user-stations?stationId=${stationId}`)
    setAssignments(data.items)
  }

  useEffect(() => {
    Promise.all([fetchStands(), fetchUsers()]).finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    setSelectedStationId('')
    setAssignments([])
    if (!selectedStandId) {
      setStations([])
      return
    }
    apiRequest<{ items: Station[] }>(`/stations?standId=${selectedStandId}`)
      .then((d) => setStations(d.items))
      .catch(() => setStations([]))
  }, [selectedStandId])

  useEffect(() => {
    setSelectedUserId('')
    if (selectedStationId) {
      fetchAssignments(selectedStationId)
    } else {
      setAssignments([])
    }
  }, [selectedStationId])

  const handleAssign = async () => {
    if (!selectedStationId || !selectedUserId) return
    await apiRequest('/user-stations', {
      method: 'POST',
      bodyJson: { userId: selectedUserId, stationId: selectedStationId },
    })
    setSelectedUserId('')
    await fetchAssignments(selectedStationId)
  }

  const handleRemove = async (assignmentId: string) => {
    await apiRequest(`/user-stations/${assignmentId}`, { method: 'DELETE' })
    await fetchAssignments(selectedStationId)
  }

  const userName = (id: string) => {
    const u = users.find((u) => u.id === id)
    return u ? `${u.firstName} ${u.lastName}` : id
  }

  const assignedUserIds = (stationId: string) =>
    assignments.filter((a) => a.stationId === stationId).map((a) => a.userId)

  const availableUsers = users.filter((u) => !assignedUserIds(selectedStationId).includes(u.id))

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Gestione</span>
            <h1 className={styles.title}>Staff & Postazioni</h1>
          </div>
        </div>

        <div className={styles.filters}>
          <select value={selectedStandId} onChange={(e) => setSelectedStandId(e.target.value)}>
            <option value="">Seleziona stand</option>
            {stands.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select value={selectedStationId} onChange={(e) => setSelectedStationId(e.target.value)} disabled={!selectedStandId}>
            <option value="">Seleziona postazione</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {selectedStationId && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Personale assegnato a {stations.find((s) => s.id === selectedStationId)?.name}
            </h2>

            <div className={styles.assignRow}>
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">Seleziona utente</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                ))}
              </select>
              <button className={styles.primaryBtn} onClick={handleAssign} disabled={!selectedUserId}>
                Assegna
              </button>
            </div>

            <div className={styles.list}>
              {assignments
                .filter((a) => a.stationId === selectedStationId)
                .map((a) => (
                  <div key={a.id} className={styles.card}>
                    <span className={styles.cardName}>{userName(a.userId)}</span>
                    <button className={styles.dangerBtn} onClick={() => handleRemove(a.id)}>
                      Rimuovi
                    </button>
                  </div>
                ))}

              {assignments.filter((a) => a.stationId === selectedStationId).length === 0 && (
                <p className={styles.empty}>Nessun personale assegnato a questa postazione.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
