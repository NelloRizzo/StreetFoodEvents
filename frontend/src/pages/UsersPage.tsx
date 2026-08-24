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
  activatedAt: string | null
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

type InviteNotice = {
  email: string
  emailSent: boolean
  activationUrl?: string
} | null

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UserFormData>(emptyForm)
  const [inviteNotice, setInviteNotice] = useState<InviteNotice>(null)
  const [submitError, setSubmitError] = useState('')
  const [resendingId, setResendingId] = useState<string | null>(null)

  const fetchUsers = async () => {
    const data = await apiRequest<{ items: User[] }>('/users')
    setUsers(data.items)
    setIsLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setSubmitError('')
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
    setSubmitError('')
    setShowForm(true)
  }

  const handleSubmit = async () => {
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || null,
          avatar: form.avatar,
          isActive: form.isActive,
        }
        if (form.password) body.password = form.password
        await apiRequest(`/users/${editingId}`, { method: 'PATCH', bodyJson: body })
      } else {
        const res = await apiRequest<{ item: User; emailSent: boolean; activationUrl?: string }>('/users', {
          method: 'POST',
          bodyJson: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone || null,
            avatar: form.avatar,
          },
        })
        setInviteNotice({
          email: res.item.email,
          emailSent: res.emailSent,
          activationUrl: res.activationUrl,
        })
      }

      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      await fetchUsers()
    } catch (err) {
      setSubmitError((err as { message?: string }).message || 'Errore durante il salvataggio')
    }
  }

  const handleResendInvite = async (user: User) => {
    setResendingId(user.id)
    try {
      const res = await apiRequest<{ item: User; emailSent: boolean; activationUrl?: string }>(
        `/users/${user.id}/resend-invite`,
        { method: 'POST' }
      )
      setInviteNotice({
        email: user.email,
        emailSent: res.emailSent,
        activationUrl: res.activationUrl,
      })
      await fetchUsers()
    } catch (err) {
      setSubmitError((err as { message?: string }).message || 'Errore durante il reinvio dell\'invito')
    } finally {
      setResendingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    await apiRequest(`/users/${id}`, { method: 'DELETE' })
    await fetchUsers()
  }

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('it-IT') : '—'

  function statusLabel(user: User) {
    if (user.isActive && user.activatedAt) return 'Attivo'
    if (!user.activatedAt) return 'Invito in attesa'
    return 'Disattivato'
  }

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
            Invita utente
          </button>
        </div>

        {inviteNotice && (
          <div className={styles.form} style={{ borderColor: 'var(--color-green)' }}>
            <strong>
              {inviteNotice.emailSent
                ? `Invito inviato a ${inviteNotice.email}`
                : `Email non inviata (servizio non configurato) per ${inviteNotice.email}`}
            </strong>
            {!inviteNotice.emailSent && inviteNotice.activationUrl && (
              <p style={{ wordBreak: 'break-all', margin: '0.5rem 0 0' }}>
                Link di attivazione da consegnare manualmente:{' '}
                <a href={inviteNotice.activationUrl}>{inviteNotice.activationUrl}</a>
              </p>
            )}
          </div>
        )}

        {showForm && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
            {!editingId && (
              <p className={styles.empty}>
                L'utente riceverà un'email con un link per attivare l'account e scegliere la propria password.
              </p>
            )}
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="u-first">Nome *</label>
                <input id="u-first" type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </div>
              <div className={styles.field}>
                <label htmlFor="u-last">Cognome *</label>
                <input id="u-last" type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="u-email">Email *</label>
              <input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            {editingId && (
              <div className={styles.field}>
                <label htmlFor="u-password">Nuova password (lascia vuoto per mantenere)</label>
                <input id="u-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor="u-phone">Telefono</label>
              <input id="u-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            {editingId && (
              <div className={styles.field}>
                <label>
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  {' '}Utente attivo
                </label>
              </div>
            )}
            <ImageUploader
                mode="single"
                type="user"
                value={form.avatar}
                onChange={(data) => setForm({ ...form, avatar: data as UploadedImage | null })}
                label="Avatar"
              />
            {submitError && <p className={styles.empty} style={{ color: 'var(--color-red)' }}>{submitError}</p>}
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>
                {editingId ? 'Salva modifiche' : 'Invia invito'}
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
                  {statusLabel(user)} · Ultimo accesso: {fmtDate(user.lastLoginAt)}
                </span>
              </div>
              <div className={styles.cardActions}>
                {!user.activatedAt && (
                  <button
                    className={styles.textBtn}
                    disabled={resendingId === user.id}
                    onClick={() => handleResendInvite(user)}
                  >
                    {resendingId === user.id ? '...' : 'Reinvia invito'}
                  </button>
                )}
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
            <p className={styles.empty}>Nessun utente. Invitane uno nuovo.</p>
          )}
        </div>
      </div>
    </div>
  )
}
