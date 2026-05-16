import { useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import { type UploadedImage } from '../lib/upload'
import { ImageUploader } from '../components/ImageUploader'
import styles from './UsersPage.module.scss'

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  avatar: UploadedImage | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

type UserFormData = {
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string
  avatar: UploadedImage | null
  isActive: boolean
}

const emptyForm: UserFormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  avatar: null,
  isActive: true,
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)

  const fetchUsers = async () => {
    const data = await apiRequest<{ items: User[] }>('/users')
    setUsers(data.items)
    setIsLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (user: User) => {
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      phone: user.phone ?? '',
      avatar: user.avatar,
      isActive: user.isActive,
    })
    setEditingId(user.id)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (editingId) {
      const body: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        avatar: form.avatar,
        isActive: form.isActive,
      }
      if (form.password) body.passwordHash = form.password
      await apiRequest(`/users/${editingId}`, { method: 'PATCH', bodyJson: body })
    } else {
      await apiRequest('/users', {
        method: 'POST',
        bodyJson: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          passwordHash: form.password,
          phone: form.phone || null,
          avatar: form.avatar,
          isActive: form.isActive,
        },
      })
    }

    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    await fetchUsers()
  }

  const handleDelete = async (id: string) => {
    await apiRequest(`/users/${id}`, { method: 'DELETE' })
    await fetchUsers()
  }

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('it-IT') : '—'

  if (isLoading) return null

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Gestione</span>
            <h1 className={styles.title}>Utenti</h1>
          </div>
          <button className={styles.primaryBtn} onClick={openCreate}>
            Nuovo utente
          </button>
        </div>

        {showForm && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="u-first">Nome *</label>
                <input id="u-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </div>
              <div className={styles.field}>
                <label htmlFor="u-last">Cognome *</label>
                <input id="u-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="u-email">Email *</label>
              <input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="u-password">{editingId ? 'Nuova password (lascia vuoto per mantenere)' : 'Password *'}</label>
              <input id="u-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} />
            </div>
            <div className={styles.field}>
              <label htmlFor="u-phone">Telefono</label>
              <input id="u-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                {' '}Utente attivo
              </label>
            </div>
            <ImageUploader
              mode="single"
              value={form.avatar}
              onChange={(data) => setForm({ ...form, avatar: data as UploadedImage | null })}
              label="Avatar"
            />
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>
                {editingId ? 'Salva modifiche' : 'Crea utente'}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                Annulla
              </button>
            </div>
          </form>
        )}

        <div className={styles.list}>
          {users.map((user) => (
            <article key={user.id} className={styles.card}>
              <div className={styles.cardBody}>
                <strong className={styles.cardName}>
                  {user.firstName} {user.lastName}
                </strong>
                <span className={styles.cardEmail}>{user.email}</span>
                <span className={styles.cardMeta}>
                  {user.isActive ? 'Attivo' : 'Disattivato'} · Ultimo accesso: {fmtDate(user.lastLoginAt)}
                </span>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.textBtn} onClick={() => openEdit(user)}>
                  Modifica
                </button>
                <button className={styles.dangerBtn} onClick={() => handleDelete(user.id)}>
                  Elimina
                </button>
              </div>
            </article>
          ))}

          {users.length === 0 && (
            <p className={styles.empty}>Nessun utente. Creane uno nuovo.</p>
          )}
        </div>
      </div>
    </div>
  )
}
