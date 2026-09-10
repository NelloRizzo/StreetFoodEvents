import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { ALLERGEN_LABELS } from '../lib/allergens'
import type { UploadedImage } from '../lib/upload'
import styles from './AdhesionsManagePage.module.scss'

type AdhesionStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

type AdhesionItem = {
  id: string
  eventId: string
  standId: string | null
  status: AdhesionStatus
  reviewedAt: string | null
  reviewNote: string | null
  standName: string
  standType: 'food' | 'artigianato' | 'divertimento'
  slogan: string | null
  description: string | null
  banner: UploadedImage | null
  logo: UploadedImage | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  products: Array<{
    name: string
    description: string | null
    price: number | null
    coverImage: UploadedImage | null
    ingredients: string | null
    allergens: string[]
    isFrozen: boolean
  }>
  haccpConfirmed: boolean
  haccpNote: string | null
  acceptsPointLight: boolean
  energyNeeds: Array<{ equipment: string; powerKw: number; connectionType: string }>
  participationFeeAccepted: boolean
  depositAccepted: boolean
  regulationAccepted: boolean
  exclusionAccepted: boolean
  signature: string | null
  signedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

type EventRef = {
  id: string
  name: string
  currencyName: string
  participationFee: number | null
  deposit: number | null
}

const STATUS_LABEL: Record<AdhesionStatus, string> = {
  draft: 'Bozza',
  submitted: 'In attesa',
  approved: 'Approvata',
  rejected: 'Rifiutata',
}

const STATUS_ORDER: AdhesionStatus[] = ['submitted', 'draft', 'rejected', 'approved']

const STAND_TYPE_LABEL: Record<AdhesionItem['standType'], string> = {
  food: 'Enogastronomico',
  artigianato: 'Artigianato',
  divertimento: 'Divertimento',
}

export function AdhesionsManagePage() {
  const { eventId } = useParams<{ eventId: string }>()

  const [event, setEvent] = useState<EventRef | null>(null)
  const [items, setItems] = useState<AdhesionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const d = await apiRequest<{ items: AdhesionItem[] }>(`/events/${eventId}/adhesions`)
      const ordered = [...d.items].sort((a, b) => {
        const rank = (s: AdhesionStatus) => STATUS_ORDER.indexOf(s)
        if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status)
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
      setItems(ordered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossibile caricare le adesioni.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    let cancelled = false

    void apiRequest<{ item: EventRef }>(`/events/${eventId}`)
      .then((d) => { if (!cancelled) setEvent(d.item) })
      .catch(() => {})

    void apiRequest<{ items: AdhesionItem[] }>(`/events/${eventId}/adhesions`)
      .then((d) => {
        if (cancelled) return
        const ordered = [...d.items].sort((a, b) => {
          const rank = (s: AdhesionStatus) => STATUS_ORDER.indexOf(s)
          if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status)
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })
        setItems(ordered)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Impossibile caricare le adesioni.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [eventId])

  const runAction = async (action: () => Promise<unknown>, successMsg: string) => {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await action()
      setMsg(successMsg)
      await fetchItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante l\u2019operazione.')
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = (id: string) =>
    runAction(
      () => apiRequest(`/events/${eventId}/adhesions/${id}/approve`, { method: 'POST', bodyJson: {} }),
      'Adesione approvata.'
    )

  const handleReject = (note: string) =>
    runAction(
      () => apiRequest(`/events/${eventId}/adhesions/${rejectingId}/reject`, {
        method: 'POST',
        bodyJson: { reviewNote: note },
      }),
      'Adesione rifiutata.'
    )

  if (loading) return null

  const countByStatus = (s: AdhesionStatus) => items.filter((i) => i.status === s).length

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Adesioni</span>
            <h1 className={styles.title}>Adesioni stand</h1>
            {event && (
              <p className={styles.subtitle}>
                {event.name} &middot; {items.length} adesioni totali
              </p>
            )}
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.ghostBtn} to={`/admin/events/${eventId}/stand-adhesion`}>
              Compila adesione
            </Link>
          </div>
        </div>

        <div className={styles.statsRow}>
          <span className={styles.statPill}>In attesa: {countByStatus('submitted')}</span>
          <span className={styles.statPill}>Bozze: {countByStatus('draft')}</span>
          <span className={styles.statPill}>Rifiutate: {countByStatus('rejected')}</span>
          <span className={styles.statPill}>Approvate: {countByStatus('approved')}</span>
        </div>

        {msg && <div className={styles.alert} onClick={() => setMsg(null)}>{msg}</div>}
        {error && <div className={styles.errorMsg}>{error}</div>}

        {items.length === 0 && (
          <p className={styles.empty}>
            Nessuna adesione per questo evento.
          </p>
        )}

        <div className={styles.list}>
          {items.map((a) => (
            <article key={a.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>
                  <strong>{a.standName}</strong>
                  <span className={styles.cardType}>{STAND_TYPE_LABEL[a.standType]}</span>
                </div>
                <div className={styles.cardMeta}>
                  <span className={`${styles.statusBadge} ${styles[`status_${a.status}`]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  {a.submittedAt && (
                    <span className={styles.cardDate}>
                      Invio: {new Date(a.submittedAt).toLocaleString('it-IT')}
                    </span>
                  )}
                  {a.reviewedAt && (
                    <span className={styles.cardDate}>
                      Revis.: {new Date(a.reviewedAt).toLocaleString('it-IT')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                >
                  {expandedId === a.id ? 'Chiudi' : 'Dettagli'}
                </button>
              </div>

              {a.reviewNote && (
                <div className={styles.reviewNote}>
                  <strong>Nota del gestore:</strong> {a.reviewNote}
                </div>
              )}

              {expandedId === a.id && (
                <div className={styles.details}>
                  {a.slogan && <p><strong>Slogan:</strong> {a.slogan}</p>}
                  {a.description && <p><strong>Descrizione:</strong> {a.description}</p>}
                  {(a.banner || a.logo) && (
                    <div className={styles.imgRow}>
                      {a.banner && <img src={a.banner.url} alt="banner" className={styles.thumb} />}
                      {a.logo && <img src={a.logo.url} alt="logo" className={styles.thumb} />}
                    </div>
                  )}
                  {a.contactName || a.contactEmail || a.contactPhone ? (
                    <p>
                      <strong>Contatti:</strong> {[a.contactName, a.contactEmail, a.contactPhone].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}

                  {a.products.length > 0 && (
                    <div className={styles.subSection}>
                      <h4 className={styles.subTitle}>Prodotti ({a.products.length})</h4>
                      {a.products.map((p) => (
                        <div key={p.name} className={styles.productLine}>
                          <span className={styles.productName}>{p.name}</span>
                          {p.price != null && <span>{p.price} {event?.currencyName || '€'}</span>}
                          {p.isFrozen && <span className={styles.tag}>surgelato</span>}
                          <span className={styles.dim}>{[
                            p.ingredients,
                            p.allergens.length ? `Allergeni: ${p.allergens.map((al) => ALLERGEN_LABELS[al] ?? al).join(', ')}` : '',
                          ].filter(Boolean).join(' — ')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.subSection}>
                    <h4 className={styles.subTitle}>Requisiti</h4>
                    <p>
                      HACCP: {a.haccpConfirmed ? 'confermato' : 'non confermato'}
                      {a.haccpNote ? ` · ${a.haccpNote}` : ''}
                    </p>
                    <p>Punto luce: {a.acceptsPointLight ? 'accettato' : 'non accettato'}</p>
                    {a.energyNeeds.length > 0 && (
                      <p>
                        Esigenze energetiche:{' '}
                        {a.energyNeeds.map((n) => `${n.equipment} (${n.powerKw} kW, ${n.connectionType})`).join(', ')}
                      </p>
                    )}
                    {event?.participationFee != null && (
                      <p>Quota di partecipazione ({event.participationFee} €): {a.participationFeeAccepted ? 'accettata' : 'non accettata'}</p>
                    )}
                    {event?.deposit != null && (
                      <p>Caparra ({event.deposit} €): {a.depositAccepted ? 'accettata' : 'non accettata'}</p>
                    )}
                    <p>Regolamento: {a.regulationAccepted ? 'accettato' : 'non accettato'}</p>
                    <p>Clausola di esclusione: {a.exclusionAccepted ? 'accettata' : 'non accettata'}</p>
                  </div>

                  <p>
                    <strong>Firma:</strong> {a.signature}
                    {a.signedAt ? ` · ${new Date(a.signedAt).toLocaleString('it-IT')}` : ''}
                  </p>
                </div>
              )}

              {(a.status === 'submitted' || a.status === 'draft') && (
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={`${styles.primaryBtn} ${styles.approveBtn}`}
                    disabled={busy}
                    onClick={() => void handleApprove(a.id)}
                  >
                    Approva
                  </button>
                  <button
                    type="button"
                    className={`${styles.primaryBtn} ${styles.rejectBtn}`}
                    disabled={busy}
                    onClick={() => setRejectingId(a.id)}
                  >
                    Rifiuta
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={rejectingId !== null}
        variant="prompt"
        title="Rifiuta adesione"
        message="Inserisci il motivo del rifiuto (sarà visibile allo stand)."
        confirmLabel="Rifiuta adesione"
        danger
        onConfirm={(note) => {
          void handleReject(note ?? '')
          setRejectingId(null)
        }}
        onCancel={() => setRejectingId(null)}
      />
    </div>
  )
}