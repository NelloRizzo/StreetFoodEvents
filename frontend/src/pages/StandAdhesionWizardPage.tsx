import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { ImageUploader } from '../components/ImageUploader'
import { ConfirmModal } from '../components/ConfirmModal'
import { ALLERGEN_OPTIONS } from '../lib/allergens'
import type { UploadedImage } from '../lib/upload'
import styles from './StandAdhesionWizardPage.module.scss'

type AdhesionStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

type AdhesionProduct = {
  name: string
  description: string | null
  price: number | null
  coverImage: UploadedImage | null
  ingredients: string | null
  allergens: string[]
  isFrozen: boolean
}

type EnergyNeed = { equipment: string; powerKw: number; connectionType: string }

type AdhesionResponse = {
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
  products: AdhesionProduct[]
  haccpConfirmed: boolean
  haccpNote: string | null
  acceptsPointLight: boolean
  energyNeeds: EnergyNeed[]
  participationFeeAccepted: boolean
  depositAccepted: boolean
  regulationAccepted: boolean
  exclusionAccepted: boolean
  signature: string | null
  signedAt: string | null
  submittedAt: string | null
}

type EventRef = {
  id: string
  name: string
  startDate: string
  endDate: string
  currencyName: string
  participationFee: number | null
  deposit: number | null
  participationFeeDeadline: string | null
  depositDeadline: string | null
  regulationDocument: { url: string } | null
}

type MyStand = { id: string; name: string }

type RoleInfo = { slug: string; scope: string; eventId: string | null; standId: string | null }

type ProductDraft = {
  name: string
  description: string
  price: string
  coverImage: UploadedImage | null
  ingredients: string
  allergens: string[]
  isFrozen: boolean
}

type EnergyDraft = { equipment: string; powerKw: string; connectionType: string }

type FormState = {
  standId: string
  standType: 'food' | 'artigianato' | 'divertimento'
  standName: string
  slogan: string
  description: string
  banner: UploadedImage | null
  logo: UploadedImage | null
  contactName: string
  contactEmail: string
  contactPhone: string
  products: ProductDraft[]
  haccpConfirmed: boolean
  haccpNote: string
  acceptsPointLight: boolean
  energyNeeds: EnergyDraft[]
  participationFeeAccepted: boolean
  depositAccepted: boolean
  regulationAccepted: boolean
  exclusionAccepted: boolean
  signature: string
}

const emptyForm: FormState = {
  standId: '',
  standType: 'food',
  standName: '',
  slogan: '',
  description: '',
  banner: null,
  logo: null,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  products: [],
  haccpConfirmed: false,
  haccpNote: '',
  acceptsPointLight: false,
  energyNeeds: [],
  participationFeeAccepted: false,
  depositAccepted: false,
  regulationAccepted: false,
  exclusionAccepted: false,
  signature: '',
}

const STATUS_LABEL: Record<AdhesionStatus, string> = {
  draft: 'Bozza',
  submitted: 'In attesa di approvazione',
  approved: 'Approvata',
  rejected: 'Rifiutata',
}

const newProduct = (): ProductDraft => ({
  name: '',
  description: '',
  price: '',
  coverImage: null,
  ingredients: '',
  allergens: [],
  isFrozen: false,
})

const newEnergyNeed = (): EnergyDraft => ({ equipment: '', powerKw: '', connectionType: 'monofase' })

const tokenKey = (eventId: string | undefined) => `sfe_adhesion_access_token_${eventId}`

function getStoredToken(eventId: string | undefined): string | null {
  try {
    return window.localStorage.getItem(tokenKey(eventId))
  } catch {
    return null
  }
}

function storeToken(eventId: string | undefined, token: string) {
  try {
    window.localStorage.setItem(tokenKey(eventId), token)
  } catch {
    /* ignore */
  }
}

function getsTokenHeaders(eventId: string | undefined): Record<string, string> {
  const token = getStoredToken(eventId)
  return token ? { 'x-access-token': token } : {}
}

function fromAdhesion(a: AdhesionResponse): FormState {
  return {
    standId: a.standId ?? '',
    standType: a.standType,
    standName: a.standName,
    slogan: a.slogan ?? '',
    description: a.description ?? '',
    banner: a.banner,
    logo: a.logo,
    contactName: a.contactName ?? '',
    contactEmail: a.contactEmail ?? '',
    contactPhone: a.contactPhone ?? '',
    products: a.products.map((p) => ({
      name: p.name,
      description: p.description ?? '',
      price: p.price != null ? String(p.price) : '',
      coverImage: p.coverImage,
      ingredients: p.ingredients ?? '',
      allergens: p.allergens ?? [],
      isFrozen: p.isFrozen,
    })),
    haccpConfirmed: a.haccpConfirmed,
    haccpNote: a.haccpNote ?? '',
    acceptsPointLight: a.acceptsPointLight,
    energyNeeds: (a.energyNeeds ?? []).map((n) => ({
      equipment: n.equipment,
      powerKw: String(n.powerKw),
      connectionType: n.connectionType,
    })),
    participationFeeAccepted: a.participationFeeAccepted,
    depositAccepted: a.depositAccepted,
    regulationAccepted: a.regulationAccepted,
    exclusionAccepted: a.exclusionAccepted,
    signature: a.signature ?? '',
  }
}

function buildPayload(form: FormState) {
  return {
    ...(form.standId ? { standId: form.standId } : {}),
    standType: form.standType,
    standName: form.standName,
    slogan: form.slogan || null,
    description: form.description || null,
    banner: form.banner,
    logo: form.logo,
    contactName: form.contactName || null,
    contactEmail: form.contactEmail || null,
    contactPhone: form.contactPhone || null,
    products: form.products
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name,
        description: p.description || null,
        price: p.price ? Number(p.price) : null,
        coverImage: p.coverImage,
        ingredients: p.ingredients || null,
        allergens: p.allergens,
        isFrozen: p.isFrozen,
      })),
    haccpConfirmed: form.haccpConfirmed,
    haccpNote: form.haccpNote || null,
    acceptsPointLight: form.acceptsPointLight,
    energyNeeds: form.energyNeeds
      .filter((n) => n.equipment.trim())
      .map((n) => ({
        equipment: n.equipment,
        powerKw: n.powerKw ? Number(n.powerKw) : 0,
        connectionType: n.connectionType,
      })),
    participationFeeAccepted: form.participationFeeAccepted,
    depositAccepted: form.depositAccepted,
    regulationAccepted: form.regulationAccepted,
    exclusionAccepted: form.exclusionAccepted,
    signature: form.signature,
  }
}

export function StandAdhesionWizardPage() {
  const { eventId } = useParams<{ eventId: string }>()

  const [event, setEvent] = useState<EventRef | null>(null)
  const [myStands, setMyStands] = useState<MyStand[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adhesion, setAdhesion] = useState<AdhesionResponse | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)

  const editable = adhesion === null || adhesion.status === 'draft' || adhesion.status === 'rejected'

  useEffect(() => {
    let cancelled = false

    void Promise.allSettled([
      apiRequest<{ item: EventRef }>(`/events/${eventId}`)
        .then((d) => { if (!cancelled) setEvent(d.item) })
        .catch(() => { if (!cancelled) setError('Evento non trovato.') }),
      apiRequest<{ stands: MyStand[] }>('/auth/me/stands')
        .then((d) => { if (!cancelled) setMyStands(d.stands) })
        .catch(() => {}),
      apiRequest<{ isPlatformAdmin: boolean; roles: RoleInfo[] }>('/auth/me/roles')
        .then((d) => {
          const admin = d.isPlatformAdmin || d.roles.some((r) => r.scope === 'event' && r.eventId === eventId)
          if (!cancelled) setIsAdmin(admin)
        })
        .catch(() => {}),
      apiRequest<{ item: AdhesionResponse | null }>(`/events/${eventId}/adhesions/mine`, {
        headers: getsTokenHeaders(eventId),
      })
        .then((d) => {
          if (cancelled) return
          if (d.item) {
            setAdhesion(d.item)
            setForm(fromAdhesion(d.item))
          }
        })
        .catch(() => {}),
    ]).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [eventId])

  const persist = async (payload: ReturnType<typeof buildPayload>) => {
    if (adhesion) {
      const d = await apiRequest<{ item: AdhesionResponse }>(`/events/${eventId}/adhesions/${adhesion.id}`, {
        method: 'PATCH',
        bodyJson: payload,
        headers: getsTokenHeaders(eventId),
      })
      return d.item
    }
    const d = await apiRequest<{ item: AdhesionResponse; accessToken?: string }>(`/events/${eventId}/adhesions`, {
      method: 'POST',
      bodyJson: payload,
      headers: getsTokenHeaders(eventId),
    })
    if (d.accessToken) storeToken(eventId, d.accessToken)
    return d.item
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const item = await persist(buildPayload(form))
      setAdhesion(item)
      setForm(fromAdhesion(item))
      setMsg('Bozza salvata.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante il salvataggio.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      let item = adhesion
      if (!item) {
        item = await persist(buildPayload(form))
        setAdhesion(item)
        setForm(fromAdhesion(item))
      }
      const d = await apiRequest<{ item: AdhesionResponse; activationUrl?: string | null }>(`/events/${eventId}/adhesions/${item.id}/submit`, {
        method: 'POST',
        headers: getsTokenHeaders(eventId),
      })
      setAdhesion(d.item)
      setForm(fromAdhesion(d.item))
      if (d.activationUrl) {
        setMsg(`Adesione inviata per approvazione. Attiva il tuo account al link: ${d.activationUrl}`)
      } else {
        setMsg('Adesione inviata per approvazione.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'invio.")
    } finally {
      setBusy(false)
    }
  }

  const handleWithdraw = async () => {
    setConfirmWithdraw(false)
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const d = await apiRequest<{ item: AdhesionResponse }>(`/events/${eventId}/adhesions/${adhesion!.id}/withdraw`, {
        method: 'POST',
        headers: getsTokenHeaders(eventId),
      })
      setAdhesion(d.item)
      setForm(fromAdhesion(d.item))
      setMsg('Adesione ritirata, torna in bozza.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante il ritiro.')
    } finally {
      setBusy(false)
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const missing = useMemo(() => {
    const list: string[] = []
    if (!form.standName.trim()) list.push('nome dello stand')
    if (!form.haccpConfirmed) list.push('requisiti HACCP')
    if (!form.acceptsPointLight) list.push('punto luce energia')
    if (!form.participationFeeAccepted && event?.participationFee != null) list.push('accettazione quota di partecipazione')
    if (!form.depositAccepted && event?.deposit != null) list.push('accettazione caparra')
    if (!form.regulationAccepted) list.push('regolamento')
    if (!form.exclusionAccepted) list.push('clausola di esclusione')
    if (!form.signature.trim()) list.push('firma')
    if (!form.standId) {
      if (!form.contactName.trim()) list.push('nome del referente')
      if (!form.contactEmail.trim()) list.push('email del referente')
    }
    return list
  }, [form, event])

  if (loading) return null

  if (event && !event.regulationDocument) {
    return (
      <div className={styles.page}>
        <div className="page-shell">
          <div className={styles.header}>
            <div>
              <span className="eyebrow">Adesione stand</span>
              <h1 className={styles.title}>Modulo di adesione alla manifestazione</h1>
              {event && (
                <p className={styles.subtitle}>
                  {event.name} &middot; {new Date(event.startDate).toLocaleDateString('it-IT')} &ndash;{' '}
                  {new Date(event.endDate).toLocaleDateString('it-IT')}
                </p>
              )}
            </div>
          </div>
          <div className={styles.noRegulation}>
            Il modulo di adesione è disponibile solo se l&apos;organizzazione ha pubblicato il regolamento
            della manifestazione. Riprova più tardi.
          </div>
        </div>
      </div>
    )
  }

  const canSubmit = editable && missing.length === 0

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">Adesione stand</span>
            <h1 className={styles.title}>Modulo di adesione alla manifestazione</h1>
            {event && (
              <p className={styles.subtitle}>
                {event.name} &middot; {new Date(event.startDate).toLocaleDateString('it-IT')} &ndash;{' '}
                {new Date(event.endDate).toLocaleDateString('it-IT')}
              </p>
            )}
          </div>
          <div className={styles.headerActions}>
            {adhesion && (
              <span className={`${styles.statusBadge} ${styles[`status_${adhesion.status}`]}`}>
                {STATUS_LABEL[adhesion.status]}
              </span>
            )}
          </div>
        </div>

        {adhesion?.reviewNote && (
          <div className={styles.reviewNote}>
            <strong>{adhesion.status === 'approved' ? 'Nota di approvazione' : 'Nota del gestore evento'}:</strong>{' '}
            {adhesion.reviewNote}
          </div>
        )}

        {msg && <div className={styles.alert} onClick={() => setMsg(null)}>{msg}</div>}
        {error && <div className={styles.errorMsg}>{error}</div>}

        {myStands.length === 0 && !isAdmin && !adhesion && (
          <p className={styles.hint}>
            Stai compilando un&apos;adesione per uno stand nuovo: i dati che inserisci verranno usati per creare
            lo stand di tua proprietà, che sarà attivato dopo l&apos;approvazione dall&apos;organizzazione.
            Se invece sei gestore di uno stand esistente, accedi con il tuo account e selezionalo dal menu.
          </p>
        )}

        <form
          className={styles.form}
          onSubmit={(e) => { e.preventDefault(); void handleSubmit() }}
        >
          <fieldset className={styles.fieldset} disabled={!editable}>
            <legend className={styles.legend}>{'\u2460'} Dati dello stand</legend>

            {isAdmin && (
              <div className={styles.field}>
                <label htmlFor="adh-standid">Stand collegato <em>(opzionale per i gestori evento)</em></label>
                <input
                  id="adh-standid"
                  list="adh-stand-list"
                  value={form.standId}
                  onChange={(e) => set('standId', e.target.value)}
                />
              </div>
            )}

            {myStands.length > 0 && (
              <div className={styles.field}>
                <label htmlFor="adh-stand-select">I tuoi stand</label>
                <select
                  id="adh-stand-select"
                  value={form.standId}
                  onChange={(e) => {
                    const stand = myStands.find((s) => s.id === e.target.value)
                    set('standId', e.target.value)
                    if (stand && !form.standName.trim()) set('standName', stand.name)
                  }}
                >
                  <option value="">— Seleziona uno stand —</option>
                  {myStands.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="adh-type">Tipologia</label>
              <select id="adh-type" value={form.standType} onChange={(e) => set('standType', e.target.value as FormState['standType'])}>
                <option value="food">Enogastronomico</option>
                <option value="artigianato">Artigianato</option>
                <option value="divertimento">Divertimento / animazione</option>
              </select>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="adh-name">Nome attività / ragione sociale *</label>
                <input id="adh-name" value={form.standName} onChange={(e) => set('standName', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="adh-slogan">Slogan</label>
                <input id="adh-slogan" value={form.slogan} onChange={(e) => set('slogan', e.target.value)} />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="adh-desc">Descrizione attività</label>
              <textarea id="adh-desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="adh-contact">Referente</label>
                <input id="adh-contact" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="adh-email">Email</label>
                <input id="adh-email" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="adh-phone">Telefono</label>
                <input id="adh-phone" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <ImageUploader
                  mode="single"
                  type="stand"
                  value={form.banner}
                  onChange={(data) => set('banner', data as UploadedImage | null)}
                  label="Icona / banner dello stand"
                />
              </div>
              <div className={styles.field}>
                <ImageUploader
                  mode="single"
                  type="stand"
                  value={form.logo}
                  onChange={(data) => set('logo', data as UploadedImage | null)}
                  label="Logo dello stand"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className={styles.fieldset} disabled={!editable}>
            <legend className={styles.legend}>{'\u2461'} Prodotti e men&ugrave;</legend>
            {form.products.map((p, i) => (
              <div key={i} className={styles.productBox}>
                <div className={styles.fieldRow}>
                  <div className={styles.field} style={{ flex: 2 }}>
                    <label>Nome prodotto *</label>
                    <input value={p.name} onChange={(e) => {
                      const products = [...form.products]
                      products[i] = { ...products[i], name: e.target.value }
                      set('products', products)
                    }} />
                  </div>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label>Prezzo ({event?.currencyName || '€'})</label>
                    <input type="number" min="0" step="0.01" value={p.price} onChange={(e) => {
                      const products = [...form.products]
                      products[i] = { ...products[i], price: e.target.value }
                      set('products', products)
                    }} />
                  </div>
                  <div className={styles.field} style={{ flex: 1, alignSelf: 'flex-end' }}>
                    <label className={styles.checkLabel}>
                      <input type="checkbox" checked={p.isFrozen} onChange={(e) => {
                        const products = [...form.products]
                        products[i] = { ...products[i], isFrozen: e.target.checked }
                        set('products', products)
                      }} />
                      <span>Surgelato</span>
                    </label>
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Descrizione</label>
                  <input value={p.description} onChange={(e) => {
                    const products = [...form.products]
                    products[i] = { ...products[i], description: e.target.value }
                    set('products', products)
                  }} />
                </div>
                <div className={styles.field}>
                  <label>Ingredienti</label>
                  <input value={p.ingredients} placeholder="es. pane, manzo, formaggio" onChange={(e) => {
                    const products = [...form.products]
                    products[i] = { ...products[i], ingredients: e.target.value }
                    set('products', products)
                  }} />
                </div>
                <div className={styles.field}>
                  <label>Allergeni</label>
                  <div className={styles.allergenRow}>
                    {ALLERGEN_OPTIONS.map((opt) => (
                      <label key={opt.value} className={styles.checkChip}>
                        <input
                          type="checkbox"
                          checked={p.allergens.includes(opt.value)}
                          onChange={(e) => {
                            const products = [...form.products]
                            const allergens = e.target.checked
                              ? [...products[i].allergens, opt.value]
                              : products[i].allergens.filter((a) => a !== opt.value)
                            products[i] = { ...products[i], allergens }
                            set('products', products)
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <ImageUploader
                    mode="single"
                    type="product"
                    value={p.coverImage}
                    onChange={(data) => {
                      const products = [...form.products]
                      products[i] = { ...products[i], coverImage: data as UploadedImage | null }
                      set('products', products)
                    }}
                    label="Foto prodotto"
                  />
                </div>
                <button type="button" className={styles.removeBtn} onClick={() => set('products', form.products.filter((_, idx) => idx !== i))}>
                  Rimuovi prodotto
                </button>
              </div>
            ))}
            <button type="button" className={styles.secondaryBtn} onClick={() => set('products', [...form.products, newProduct()])}>
              + Aggiungi prodotto
            </button>
          </fieldset>

          <fieldset className={styles.fieldset} disabled={!editable}>
            <legend className={styles.legend}>{'\u2462'} Requisiti igienico-sanitari</legend>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.haccpConfirmed} onChange={(e) => set('haccpConfirmed', e.target.checked)} />
              <span>
                Dichiaro di rispettare i requisiti igienico-sanitari previsti dall&apos;attuale normativa HACCP per l&apos;attività
                di somministrazione/vendita *</span>
            </label>
            <div className={styles.field}>
              <label htmlFor="adh-haccp-note">Note (es. STP, registrazione sanitaria)</label>
              <input id="adh-haccp-note" value={form.haccpNote} onChange={(e) => set('haccpNote', e.target.value)} />
            </div>
          </fieldset>

          <fieldset className={styles.fieldset} disabled={!editable}>
            <legend className={styles.legend}>{'\u2463'} Energia elettrica</legend>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.acceptsPointLight} onChange={(e) => set('acceptsPointLight', e.target.checked)} />
              <span>Accetto la dotazione di un solo punto luce dall&apos;organizzazione *</span>
            </label>
            <p className={styles.hint}>
              Esigenze energetiche aggiuntive (da elencare) saranno a carico dello stand.
            </p>
            {form.energyNeeds.map((n, i) => (
              <div key={i} className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Attrezzatura</label>
                  <input value={n.equipment} placeholder="es. friggitrice" onChange={(e) => {
                    const energyNeeds = [...form.energyNeeds]
                    energyNeeds[i] = { ...energyNeeds[i], equipment: e.target.value }
                    set('energyNeeds', energyNeeds)
                  }} />
                </div>
                <div className={styles.field}>
                  <label>Potenza (kW)</label>
                  <input type="number" min="0" step="0.1" value={n.powerKw} onChange={(e) => {
                    const energyNeeds = [...form.energyNeeds]
                    energyNeeds[i] = { ...energyNeeds[i], powerKw: e.target.value }
                    set('energyNeeds', energyNeeds)
                  }} />
                </div>
                <div className={styles.field}>
                  <label>Allacciamento</label>
                  <select value={n.connectionType} onChange={(e) => {
                    const energyNeeds = [...form.energyNeeds]
                    energyNeeds[i] = { ...energyNeeds[i], connectionType: e.target.value }
                    set('energyNeeds', energyNeeds)
                  }}>
                    <option value="monofase">Monofase</option>
                    <option value="trifase">Trifase</option>
                  </select>
                </div>
                <button type="button" className={styles.removeBtn} onClick={() => set('energyNeeds', form.energyNeeds.filter((_, idx) => idx !== i))}>
                  Rimuovi
                </button>
              </div>
            ))}
            <button type="button" className={styles.secondaryBtn} onClick={() => set('energyNeeds', [...form.energyNeeds, newEnergyNeed()])}>
              + Aggiungi esigenza energetica
            </button>
          </fieldset>

          <fieldset className={styles.fieldset} disabled={!editable}>
            <legend className={styles.legend}>{'\u2464'} Partecipazione economica</legend>
            <div className={styles.feeBox}>
              <div className={styles.feeLine}>
                <strong>Quota di partecipazione:</strong>{' '}
                {event?.participationFee != null ? `${event.participationFee} €` : 'non indicata dall\u2019organizzazione'}
                {event?.participationFeeDeadline != null && (
                  <>
                    {' '}
                    <em>(saldo entro il {new Date(event.participationFeeDeadline).toLocaleDateString('it-IT')})</em>
                  </>
                )}
              </div>
              <div className={styles.feeLine}>
                <strong>Caparra:</strong>{' '}
                {event?.deposit != null ? `${event.deposit} €` : 'non indicata dall\u2019organizzazione'}
                {event?.depositDeadline != null && (
                  <>
                    {' '}
                    <em>(saldo entro il {new Date(event.depositDeadline).toLocaleDateString('it-IT')})</em>
                  </>
                )}
              </div>
              <p className={styles.hint}>
                Il pagamento degli importi non avviene tramite questa piattaforma: le modalità di versamento
                saranno comunicate dall\u2019organizzazione.
              </p>
              {event?.participationFee != null && (
                <label className={styles.checkLabel}>
                  <input type="checkbox" checked={form.participationFeeAccepted} onChange={(e) => set('participationFeeAccepted', e.target.checked)} />
                  <span>Accetto il pagamento della quota di partecipazione *</span>
                </label>
              )}
              {event?.deposit != null && (
                <label className={styles.checkLabel}>
                  <input type="checkbox" checked={form.depositAccepted} onChange={(e) => set('depositAccepted', e.target.checked)} />
                  <span>Accetto il pagamento della caparra *</span>
                </label>
              )}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset} disabled={!editable}>
            <legend className={styles.legend}>{'\u2465'} Dichiarazioni e firma</legend>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.regulationAccepted} onChange={(e) => set('regulationAccepted', e.target.checked)} />
              <span>Dichiaro di aver letto e accettato il regolamento della manifestazione *</span>
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.exclusionAccepted} onChange={(e) => set('exclusionAccepted', e.target.checked)} />
              <span>Accetto la clausola di esclusione prevista dal modulo *</span>
            </label>
            <div className={styles.field}>
              <label htmlFor="adh-signature">Firma del richiedente *</label>
              <input id="adh-signature" value={form.signature} placeholder="Nome e cognome (vale come firma)" onChange={(e) => set('signature', e.target.value)} />
            </div>
            {adhesion?.signedAt && (
              <p className={styles.hint}>Documento firmato in data: {new Date(adhesion.signedAt).toLocaleString('it-IT')}</p>
            )}
          </fieldset>

          {editable && (
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={() => void handleSave()}>
                {busy ? 'Salvataggio\u2026' : 'Salva bozza'}
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={busy || !canSubmit}>
                Invia per approvazione
              </button>
              {missing.length > 0 && (
                <p className={styles.hint} style={{ width: '100%' }}>
                  Dati mancanti per l&apos;invio: {missing.join(', ')}.
                </p>
              )}
            </div>
          )}

          {adhesion?.status === 'submitted' && (
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={() => setConfirmWithdraw(true)}>
                Ritira adesione
              </button>
            </div>
          )}
        </form>
      </div>

      <ConfirmModal
        open={confirmWithdraw}
        variant="confirm"
        title="Ritira adesione"
        message="L'adesione tornerà in stato di bozza e potrà essere modificata e reinviata."
        confirmLabel="Ritira"
        danger
        onConfirm={() => void handleWithdraw()}
        onCancel={() => setConfirmWithdraw(false)}
      />
    </div>
  )
}