import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { useAuth } from '../features/auth/auth-context'
import {
  createPromotion,
  deletePromotion,
  fetchPromotionUsage,
  fetchPromotions,
  updatePromotion,
  type CreatePromotionInput,
  type Promotion,
  type PromotionType,
  type PromotionUsage,
  couponDescription,
} from '../lib/promotions'
import styles from './EventPromotionsPage.module.scss'

type StandLite = { id: string; name: string }

type ProductLite = {
  id: string
  standId: string
  priceOverride: number | null
  available: boolean
  product: { id: string; name: string; price: number } | null
}

type FormState = {
  code: string
  title: string
  type: PromotionType
  standId: string
  discountType: 'percent' | 'fixed'
  discountValue: string
  eventProductId: string
  formulaApplied: boolean
  formulaPaid: string
  formulaTotal: string
  formulaMaxFree: string
  valueAmount: string
  maxPresentations: string
  perUserLimit: string
  expiresAt: string
}

const emptyForm = (): FormState => ({
  code: '',
  title: '',
  type: 'discount',
  standId: '',
  discountType: 'percent',
  discountValue: '',
  eventProductId: '',
  formulaApplied: false,
  formulaPaid: '1',
  formulaTotal: '2',
  formulaMaxFree: '',
  valueAmount: '',
  maxPresentations: '',
  perUserLimit: '',
  expiresAt: '',
})

function toForm(p: Promotion): FormState {
  return {
    code: p.code,
    title: p.title ?? '',
    type: p.type,
    standId: p.standId ?? '',
    discountType: p.discountType ?? 'percent',
    discountValue: p.discountValue != null ? String(p.discountValue) : '',
    eventProductId: p.eventProductId ?? '',
    formulaApplied: !!p.formula,
    formulaPaid: p.formula ? String(p.formula.paid) : '1',
    formulaTotal: p.formula ? String(p.formula.total) : '2',
    formulaMaxFree: p.formulaMaxFree != null ? String(p.formulaMaxFree) : '',
    valueAmount: p.valueAmount != null ? String(p.valueAmount) : '',
    maxPresentations: p.maxPresentations != null ? String(p.maxPresentations) : '',
    perUserLimit: p.perUserLimit != null ? String(p.perUserLimit) : '',
    expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '',
  }
}

function buildInput(f: FormState): CreatePromotionInput {
  const input: CreatePromotionInput = {
    code: f.code.trim().toUpperCase(),
    title: f.title.trim() || null,
    type: f.type,
    standId: f.standId || null,
    maxPresentations: f.maxPresentations === '' ? null : Number(f.maxPresentations),
    perUserLimit: f.perUserLimit === '' ? null : Number(f.perUserLimit),
    expiresAt: f.expiresAt === '' ? null : f.expiresAt,
  }
  if (f.type === 'discount') {
    input.discountType = f.discountType
    input.discountValue = Number(f.discountValue)
  }
  if (f.type === 'product') {
    input.eventProductId = f.eventProductId
    input.formula = f.formulaApplied ? { paid: Number(f.formulaPaid), total: Number(f.formulaTotal) } : null
    input.formulaMaxFree = f.formulaMaxFree === '' ? null : Number(f.formulaMaxFree)
  }
  if (f.type === 'value') {
    input.valueAmount = Number(f.valueAmount)
  }
  return input
}

function downloadQr(qrCode: string, code: string) {
  const a = document.createElement('a')
  a.href = qrCode
  a.download = `coupon-${code}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function EventPromotionsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [eventName, setEventName] = useState('')
  const [currencyName, setCurrencyName] = useState('')
  const [items, setItems] = useState<Promotion[]>([])
  const [stands, setStands] = useState<StandLite[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [usages, setUsages] = useState<Record<string, PromotionUsage[]>>({})

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const load = useCallback(async () => {
    if (!eventId) return
    const [promos, standsRes, productsRes] = await Promise.all([
      fetchPromotions(eventId),
      apiRequest<{ items: StandLite[] }>(`/stands?eventId=${eventId}`),
      apiRequest<{ items: ProductLite[] }>(`/event-products?eventId=${eventId}`),
    ])
    setItems(promos.items ?? [])
    setStands(standsRes.items ?? [])
    setProducts(productsRes.items ?? [])
  }, [eventId])

  useEffect(() => {
    if (!eventId || !isAuthenticated) return
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
      .then(async (data) => {
        const eventRoles = data.roles.filter(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        const ok = data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'event-admin')
        if (!ok) {
          setForbidden(true)
          setLoading(false)
          return
        }
        try {
          const ev = await apiRequest<{ item: { name: string; currencyName: string } }>(`/events/${eventId}`)
          setEventName(ev.item.name)
          setCurrencyName(ev.item.currencyName)
          await load()
        } catch {
          /* ignore */
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [eventId, isAuthenticated, load])

  const productName = (promo: Promotion) => {
    if (!promo.eventProductId) return null
    return products.find((p) => p.id === promo.eventProductId)?.product?.name ?? null
  }

  const standName = (promo: Promotion) => {
    if (!promo.standId) return 'Tutti gli stand'
    return stands.find((s) => s.id === promo.standId)?.name ?? 'Stand specifico'
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (p: Promotion) => {
    setEditing(p)
    setForm(toForm(p))
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!eventId || saving) return
    setSaving(true)
    try {
      const input = buildInput(form)
      if (editing) {
        await updatePromotion(eventId, editing.id, input)
      } else {
        await createPromotion(eventId, input)
      }
      setModalOpen(false)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Errore durante il salvataggio')
    }
    setSaving(false)
  }

  const toggleActive = async (p: Promotion) => {
    if (!eventId || saving) return
    setSaving(true)
    try {
      await updatePromotion(eventId, p.id, { ...buildInput(toForm(p)), isActive: !p.isActive })
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Errore durante la modifica')
    }
    setSaving(false)
  }

  const remove = async (p: Promotion) => {
    if (!eventId || saving) return
    if (!window.confirm(`Eliminare il coupon ${p.code}?`)) return
    setSaving(true)
    try {
      await deletePromotion(eventId, p.id)
      await load()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Errore durante l\'eliminazione')
    }
    setSaving(false)
  }

  const showUsage = async (p: Promotion) => {
    if (!eventId || usages[p.id]) return
    try {
      const res = await fetchPromotionUsage(eventId, p.id)
      setUsages((prev) => ({ ...prev, [p.id]: res.items ?? [] }))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Errore durante il caricamento')
    }
  }

  if (forbidden) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Accesso negato.</p>
      </div>
    )
  }

  if (loading) return null

  const isPercent = form.type === 'discount' && form.discountType === 'percent'

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className="page-title">Promozioni e Coupon &mdash; {eventName || 'Caricamento...'}</h2>
        <div className={styles.toolbar}>
          <button type="button" className={styles.createBtn} onClick={openCreate}>
            Nuovo coupon
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Nessun coupon configurato per questo evento. Crea il primo con &ldquo;Nuovo coupon&rdquo;.
        </p>
      ) : (
        <div className={styles.grid}>
          {items.map((p) => (
            <div key={p.id} className={`${styles.card}${p.isActive ? '' : ` ${styles.inactive}`}`}>
              <div className={styles.cardTop}>
                <span className={styles.codeBadge}>{p.code}</span>
                <span className={`${styles.typeChip} ${styles[p.type]}`}>{p.typeLabel}</span>
              </div>
              {p.title && <div className={styles.title}>{p.title}</div>}
              <div className={styles.desc}>{couponDescription(p, productName(p))}</div>
              <div className={styles.meta}>
                <div className={styles.metaRow}>
                  <span>Stand</span>
                  <span>{standName(p)}</span>
                </div>
                {p.maxPresentations != null && (
                  <div className={styles.metaRow}>
                    <span>Presentazioni</span>
                    <span>{p.usedCount} / {p.maxPresentations}</span>
                  </div>
                )}
                {p.perUserLimit != null && (
                  <div className={styles.metaRow}>
                    <span>Limite per cliente</span>
                    <span>{p.perUserLimit}</span>
                  </div>
                )}
                {p.expiresAt && (
                  <div className={styles.metaRow}>
                    <span>Scadenza</span>
                    <span>{new Date(p.expiresAt).toLocaleDateString('it-IT')}</span>
                  </div>
                )}
                <div className={styles.metaRow}>
                  <span>Stato</span>
                  <span>{p.isActive ? 'Attivo' : 'Disattivato'}</span>
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.actionBtn} onClick={() => toggleActive(p)} disabled={saving}>
                  {p.isActive ? 'Disattiva' : 'Attiva'}
                </button>
                <button type="button" className={styles.actionBtn} onClick={() => openEdit(p)} disabled={saving}>
                  Modifica
                </button>
                <button type="button" className={styles.actionBtn} onClick={() => remove(p)} disabled={saving}>
                  Elimina
                </button>
              </div>
              {p.qrCode && (
                <div className={styles.qrBlock}>
                  <img className={styles.qrImg} src={p.qrCode} alt={`QR coupon ${p.code}`} />
                  <div className={styles.qrText}>
                    <span>QR per la cassa (scansiona per applicare)</span>
                    <button type="button" className={styles.actionBtn} onClick={() => p.qrCode && downloadQr(p.qrCode, p.code)}>
                      Scarica QR
                    </button>
                  </div>
                </div>
              )}
              <details onToggle={(e) => (e.currentTarget.open ? showUsage(p) : undefined)}>
                <summary className={styles.hint}>Utilizzazioni ({p.usedCount})</summary>
                {usages[p.id] && (
                  <div className={styles.usageList}>
                    {usages[p.id].length === 0 ? (
                      <span>Nessuna utilizzazione</span>
                    ) : (
                      usages[p.id].map((u) => (
                        <div key={u.id} className={styles.usageRow}>
                          <span>
                            {u.type === 'value' ? `Buono +${u.valueAmount.toFixed(2)}` : u.discountAmount > 0 ? `Sconto -${u.discountAmount.toFixed(2)} ${currencyName}` : u.freeUnits > 0 ? `${u.freeUnits} gratis` : 'Usato'}
                          </span>
                          <span>{new Date(u.createdAt).toLocaleString('it-IT')}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </details>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className={styles.modal} onClick={() => !saving && setModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>{editing ? `Modifica coupon ${editing.code}` : 'Nuovo coupon'}</div>

            <div className={styles.formRow}>
              <label htmlFor="promo-code">Codice</label>
              <input
                id="promo-code"
                className={styles.input}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="es. WELCOME10"
              />
            </div>

            <div className={styles.formRow}>
              <label htmlFor="promo-type">Tipo</label>
              <select
                id="promo-type"
                className={styles.select}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PromotionType }))}
              >
                <option value="discount">Sconto su ordine</option>
                <option value="product">Prodotto omaggio / formula</option>
                <option value="value">Buono valore (crediti)</option>
              </select>
            </div>

            <div className={styles.formRow}>
              <label htmlFor="promo-title">Titolo (facoltativo)</label>
              <input
                id="promo-title"
                className={styles.input}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="es. Sconto di benvenuto"
              />
            </div>

            {form.type === 'discount' && (
              <>
                <div className={styles.inputsRow}>
                  <div className={styles.formRow}>
                    <label htmlFor="promo-dt">Tipo sconto</label>
                    <select
                      id="promo-dt"
                      className={styles.select}
                      value={form.discountType}
                      onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as 'percent' | 'fixed' }))}
                    >
                      <option value="percent">Percentuale</option>
                      <option value="fixed">Importo fisso</option>
                    </select>
                  </div>
                  <div className={styles.formRow}>
                    <label htmlFor="promo-dv">
                      {form.discountType === 'percent' ? 'Percentuale' : `Importo (${currencyName})`}
                    </label>
                    <input
                      id="promo-dv"
                      className={styles.input}
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.discountValue}
                      onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                    />
                  </div>
                </div>
                {isPercent && <p className={styles.hint}>Gli sconti percentuali non possono essere usati nei pagamenti in crediti.</p>}
              </>
            )}

            {form.type === 'product' && (
              <>
                <div className={styles.formRow}>
                  <label htmlFor="promo-ep">Prodotto</label>
                  <select
                    id="promo-ep"
                    className={styles.select}
                    value={form.eventProductId}
                    onChange={(e) => {
                      const ep = products.find((p) => p.id === e.target.value)
                      setForm((f) => ({ ...f, eventProductId: e.target.value, standId: ep ? ep.standId : f.standId }))
                    }}
                  >
                    <option value="">Seleziona un prodotto</option>
                    {products.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.product?.name ?? ep.id} {ep.product ? `(${ep.product.price.toFixed(2)} ${currencyName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.checkboxRow}>
                  <input
                    id="promo-formula"
                    type="checkbox"
                    checked={form.formulaApplied}
                    onChange={(e) => setForm((f) => ({ ...f, formulaApplied: e.target.checked }))}
                  />
                  <label htmlFor="promo-formula">Formula combinata (es. 2x1, 3x2)</label>
                </div>
                {form.formulaApplied && (
                  <>
                    <div className={styles.inputsRow}>
                      <div className={styles.formRow}>
                        <label htmlFor="promo-paid">Pagati</label>
                        <input
                          id="promo-paid"
                          className={styles.input}
                          type="number"
                          min={1}
                          value={form.formulaPaid}
                          onChange={(e) => setForm((f) => ({ ...f, formulaPaid: e.target.value }))}
                        />
                      </div>
                      <div className={styles.formRow}>
                        <label htmlFor="promo-total">Ricevuti (gratis inclusi)</label>
                        <input
                          id="promo-total"
                          className={styles.input}
                          type="number"
                          min={2}
                          value={form.formulaTotal}
                          onChange={(e) => setForm((f) => ({ ...f, formulaTotal: e.target.value }))}
                        />
                      </div>
                    </div>
                    <p className={styles.hint}>Formula {form.formulaTotal}x{form.formulaPaid}: paghi {form.formulaPaid}, ricevi {form.formulaTotal}.</p>
                    <div className={styles.formRow}>
                      <label htmlFor="promo-maxfree">Max pezzi gratis per presentazione (facoltativo)</label>
                      <input
                        id="promo-maxfree"
                        className={styles.input}
                        type="number"
                        min={1}
                        value={form.formulaMaxFree}
                        onChange={(e) => setForm((f) => ({ ...f, formulaMaxFree: e.target.value }))}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {form.type === 'value' && (
              <div className={styles.formRow}>
                <label htmlFor="promo-value">Importo del buono ({currencyName})</label>
                <input
                  id="promo-value"
                  className={styles.input}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.valueAmount}
                  onChange={(e) => setForm((f) => ({ ...f, valueAmount: e.target.value }))}
                />
              </div>
            )}

            <div className={styles.formRow}>
              <label htmlFor="promo-stand">Stand (facoltativo)</label>
              <select
                id="promo-stand"
                className={styles.select}
                value={form.standId}
                onChange={(e) => setForm((f) => ({ ...f, standId: e.target.value }))}
              >
                <option value="">Tutti gli stand</option>
                {stands.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.inputsRow}>
              <div className={styles.formRow}>
                <label htmlFor="promo-maxpres">Max presentazioni (facoltativo)</label>
                <input
                  id="promo-maxpres"
                  className={styles.input}
                  type="number"
                  min={1}
                  value={form.maxPresentations}
                  onChange={(e) => setForm((f) => ({ ...f, maxPresentations: e.target.value }))}
                />
              </div>
              <div className={styles.formRow}>
                <label htmlFor="promo-peruser">Limite per cliente (facoltativo)</label>
                <input
                  id="promo-peruser"
                  className={styles.input}
                  type="number"
                  min={1}
                  value={form.perUserLimit}
                  onChange={(e) => setForm((f) => ({ ...f, perUserLimit: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label htmlFor="promo-exp">Scadenza (facoltativo)</label>
              <input
                id="promo-exp"
                className={styles.input}
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)} disabled={saving}>
                Annulla
              </button>
              <button type="button" className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Salvataggio...' : editing ? 'Salva' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}