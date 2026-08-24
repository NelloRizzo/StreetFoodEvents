import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import { ConfirmModal } from '../components/ConfirmModal'
import { QRCodeDownload } from '../components/QRCodeDownload'
import { useAuth } from '../features/auth/auth-context'
import { listContestPois, createContestPoi, deleteContestPoi, listContests, createContest, updateContest, deleteContest, startContest, getContestPoiQrCodes } from '../lib/contests'
import styles from './EventDetailPage.module.scss'

type ContestPrizeItem = { label: string; awarded: boolean }

type ContestItem = {
  id: string
  name: string
  isActive: boolean
  orderedPOIIds: string[]
  durationMinutes: number
  startsAt: string | null
  prizes: ContestPrizeItem[]
  awardedPrizesCount: number
  requireSequence: boolean
  description: string | null
  pickConfig: { groupPicks: { group: string; count: number }[] } | null
  autoPickedPOIIds: string[]
  poiHintSelections: { poiId: string; hintIndex: number }[]
}

const emptyContestForm = {
  name: '',
  description: '',
  startsAt: '',
  durationMinutes: 30,
  requireSequence: false,
  prizes: [{ label: '' }] as { label: string }[],
  isActive: true,
  orderedPOIIds: [] as string[],
  pickConfig: null as { groupPicks: { group: string; count: number }[] } | null,
  poiHintSelections: [] as { poiId: string; hintIndex: number }[],
}

export function EventContestManagePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [stands, setStands] = useState<{ id: string; name: string }[]>([])
  const [pois, setPois] = useState<{ id: string; name: string }[]>([])

  const [cpois, setCpois] = useState<{ id: string; name: string; hints: string[]; groups: string[]; standId: string | null; poiId: string | null }[]>([])
  const [showCpoiForm, setShowCpoiForm] = useState(false)
  const [cpoiForm, setCpoiForm] = useState({ name: '', hintsInput: '', groupsInput: '', standId: '', poiId: '' })
  const [savingCpoi, setSavingCpoi] = useState(false)

  const [contests, setContests] = useState<ContestItem[]>([])
  const [showContestForm, setShowContestForm] = useState(false)
  const [editingContestId, setEditingContestId] = useState<string | null>(null)
  const [contestForm, setContestForm] = useState(emptyContestForm)
  const [savingContest, setSavingContest] = useState(false)

  const [modal, setModal] = useState<{
    open: boolean
    variant: 'confirm' | 'alert'
    title: string
    message: string
    danger?: boolean
    onConfirm?: (value?: string) => void | Promise<void>
  }>({ open: false, variant: 'alert', title: '', message: '' })

  useEffect(() => {
    if (!eventId || !isAuthenticated) return
    apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
      .then((d) => setEventName(d.item.name))
      .catch(() => {})
    apiRequest<{ items: { id: string; name: string }[] }>(`/stands?eventId=${eventId}`)
      .then((d) => setStands(d.items))
      .catch(() => {})
    apiRequest<{ items: { id: string; name: string }[] }>(`/pois?eventId=${eventId}`)
      .then((d) => setPois(d.items))
      .catch(() => {})
    apiRequest<{ isPlatformAdmin: boolean; roles: { slug: string; scope: string; eventId: string | null }[] }>('/auth/me/roles')
      .then((data) => {
        const eventRoles = data.roles.filter(
          (r) => r.scope === 'platform' || (r.scope === 'event' && r.eventId === eventId)
        )
        const ok = data.isPlatformAdmin || eventRoles.some((r) => r.slug === 'contest-admin')
        if (!ok) {
          setForbidden(true)
          setLoading(false)
          return
        }
        Promise.all([
          listContestPois(eventId),
          listContests(eventId),
        ])
          .then(([poisData, contestsData]) => {
            setCpois(poisData.items)
            setContests(contestsData.items)
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      })
      .catch(() => setLoading(false))
  }, [eventId, isAuthenticated])

  async function printQrCodes(contest: ContestItem) {
    try {
      const data = await getContestPoiQrCodes(contest.id)
      const win = window.open('', '_blank')
      if (!win) return
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>QR Code POI - ${contest.name}</title>
  <style>
    @page { size: A4; margin: 1cm; }
    body { font-family: sans-serif; margin: 0; padding: 0.5cm; }
    .page-break { page-break-after: always; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5cm; }
    .card { text-align: center; padding: 0.5cm; border: 1px solid #ddd; border-radius: 8px; break-inside: avoid; }
    .card img { width: 200px; height: 200px; image-rendering: pixelated; }
    .card h2 { margin: 0.3rem 0; font-size: 1rem; }
    .card p { margin: 0; font-size: 0.75rem; color: #666; }
  </style>
</head>
<body>
  ${data.items.reduce((acc, item, i) => {
    if (i % 4 === 0) acc += '<div class="grid">'
    acc += `
    <div class="card">
      <h2>${item.poiName}</h2>
      <img src="${item.qrCode}" alt="QR ${item.poiName}" onload="this.style.opacity=1" style="opacity:0;transition:opacity .2s" />
      <p>Inquadra il QR per scansionare il POI</p>
    </div>`
    if (i % 4 === 3 || i === data.items.length - 1) {
      acc += '</div>'
      if (i < data.items.length - 1) acc += '<div class="page-break"></div>'
    }
    return acc
  }, '')}
  <script>
    let loaded = document.querySelectorAll('img').length;
    if (loaded === 0) { window.print(); window.close(); return; }
    let count = 0;
    document.querySelectorAll('img').forEach(img => img.onload = () => { if (++count >= loaded) { window.print(); window.close(); } });
  </script>
</body>
</html>`
      win.document.write(html)
      win.document.close()
    } catch { /* ignore */ }
  }

  if (forbidden) {
    return (
      <div className={`page-shell ${styles.page}`}>
        <h1 className={styles.pageTitle}>Accesso negato</h1>
        <p>Non hai i permessi per gestire i contest di questo evento.</p>
        <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all&apos;evento</Link>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <Link to={`/events/${eventId}`} className={styles.backLink}>&larr; Torna all&apos;evento</Link>
      <h1 className={styles.pageTitle}>Gestione contest — {eventName || 'Caricamento...'}</h1>

      {loading ? (
        <p>Caricamento...</p>
      ) : (<>
        <h2 className={styles.sectionTitle}>
          Contest <span className={styles.count}>{contests.length}</span>
        </h2>

        <Link to={`/events/${eventId}/contests`} className={styles.actionBtn} style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
          Vedi contest pubblici
        </Link>
        <QRCodeDownload apiPath={`/events/${eventId}/contests-qrcode`} fileName={`contests-${eventName}`} />

        {/* Contest POI management */}
        <h3 style={{ color: 'var(--color-ink-strong)', fontSize: '1rem', margin: '1rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          POI del contest
          <button className={styles.poiToggleBtn} onClick={() => setShowCpoiForm((p) => !p)}>
            {showCpoiForm ? 'Chiudi' : 'Nuovo POI'}
          </button>
        </h3>

        {showCpoiForm && (
          <div className={styles.poiForm}>
            <label className={styles.poiField}>
              Stand (opzionale — il POI rappresenta uno stand dell'evento, il QR porta al menu dello stand)
              <select
                value={cpoiForm.standId}
                onChange={(e) => {
                  const standId = e.target.value
                  const stand = stands.find((s) => s.id === standId)
                  setCpoiForm((p) => ({
                    ...p,
                    standId,
                    poiId: standId ? '' : p.poiId,
                    name: stand ? stand.name : p.name,
                  }))
                }}
              >
                <option value="">— Nessuno —</option>
                {stands.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.poiField}>
              POI dell'evento (opzionale — il POI rappresenta un punto d'interesse della mappa)
              <select
                value={cpoiForm.poiId}
                onChange={(e) => {
                  const poiId = e.target.value
                  const poi = pois.find((p) => p.id === poiId)
                  setCpoiForm((p) => ({
                    ...p,
                    poiId,
                    standId: poiId ? '' : p.standId,
                    name: poi ? poi.name : p.name,
                  }))
                }}
              >
                <option value="">— Nessuno —</option>
                {pois.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.poiField}>
              Nome
              <input type="text" value={cpoiForm.name} onChange={(e) => setCpoiForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label className={styles.poiField}>
              Indizi / enigmi (uno per riga)
              <textarea rows={3} value={cpoiForm.hintsInput} onChange={(e) => setCpoiForm((p) => ({ ...p, hintsInput: e.target.value }))} style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-sm)' }} />
            </label>
            <label className={styles.poiField}>
              Gruppi (separati da virgola)
              <input type="text" value={cpoiForm.groupsInput} placeholder="es. Cibo, Bevande, Giochi" onChange={(e) => setCpoiForm((p) => ({ ...p, groupsInput: e.target.value }))} />
            </label>
            <div className={styles.poiFormActions}>
              <button className={styles.saveBtn} onClick={async () => {
                if (!eventId || savingCpoi || !cpoiForm.name.trim()) return
                setSavingCpoi(true)
                try {
                  const groups = cpoiForm.groupsInput.split(',').map((g) => g.trim()).filter(Boolean)
                  const hints = cpoiForm.hintsInput.split('\n').map((h) => h.trim()).filter(Boolean)
                  await createContestPoi({
                    eventId,
                    standId: cpoiForm.standId || undefined,
                    poiId: cpoiForm.poiId || undefined,
                    name: cpoiForm.name.trim(),
                    hints: hints.length > 0 ? hints : undefined,
                    groups: groups.length > 0 ? groups : undefined,
                  })
                  const data = await listContestPois(eventId)
                  setCpois(data.items)
                  setCpoiForm({ name: '', hintsInput: '', groupsInput: '', standId: '', poiId: '' })
                  setShowCpoiForm(false)
                } catch { /* ignore */ }
                setSavingCpoi(false)
              }} disabled={savingCpoi}>
                {savingCpoi ? 'Salvataggio...' : 'Crea POI'}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setShowCpoiForm(false); setCpoiForm({ name: '', hintsInput: '', groupsInput: '', standId: '', poiId: '' }) }}>Annulla</button>
            </div>
          </div>
        )}

        <div className={styles.poiList}>
          {cpois.map((cpoi) => (
            <div key={cpoi.id} className={styles.poiCard}>
              <div className={styles.poiCardBody}>
                <strong className={styles.poiCardName}>{cpoi.name}</strong>
                {cpoi.standId && (
                  <span className={styles.poiGroupBadge} style={{ marginTop: '0.25rem' }}>
                    🏪 {stands.find((s) => s.id === cpoi.standId)?.name ?? 'Stand'}
                  </span>
                )}
                {!cpoi.standId && cpoi.poiId && (
                  <span className={styles.poiGroupBadge} style={{ marginTop: '0.25rem' }}>
                    📍 {pois.find((p) => p.id === cpoi.poiId)?.name ?? 'POI evento'}
                  </span>
                )}
                {cpoi.hints.length > 0 && <span className={styles.poiCardDesc} style={{ fontStyle: 'italic' }}>{cpoi.hints.join(' · ')}</span>}
                {cpoi.groups.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {cpoi.groups.map((g) => (
                      <span key={g} className={styles.poiGroupBadge}>{g}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.poiCardActions}>
                <button className={styles.dangerBtn} onClick={async () => {
                  try {
                    await deleteContestPoi(cpoi.id)
                    setCpois((prev) => prev.filter((p) => p.id !== cpoi.id))
                  } catch { /* ignore */ }
                }}>Elimina</button>
              </div>
            </div>
          ))}
        </div>

        {/* Contest list + create */}
        <h3 style={{ color: 'var(--color-ink-strong)', fontSize: '1rem', margin: '1.5rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Contest
          <button className={styles.poiToggleBtn} onClick={() => { setShowContestForm((p) => !p); if (!showContestForm) { setEditingContestId(null); setContestForm({ ...emptyContestForm, orderedPOIIds: cpois.map((p) => p.id) }) } }}>
            {showContestForm ? 'Chiudi' : editingContestId ? 'Modifica contest' : 'Nuovo contest'}
          </button>
        </h3>

        {showContestForm && (
          <div className={styles.poiForm}>
            <label className={styles.poiField}>
              Nome
              <input type="text" value={contestForm.name} onChange={(e) => setContestForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label className={styles.poiField}>
              Descrizione
              <textarea rows={2} value={contestForm.description} onChange={(e) => setContestForm((p) => ({ ...p, description: e.target.value }))} />
            </label>
            <label className={styles.poiField}>
              Start (opzionale — imposta con "Avvia Contest")
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="datetime-local" value={contestForm.startsAt} onChange={(e) => setContestForm((p) => ({ ...p, startsAt: e.target.value }))} style={{ flex: 1 }} />
                {contestForm.startsAt && (
                  <button type="button" className={styles.textBtn} onClick={() => setContestForm((p) => ({ ...p, startsAt: '' }))}>&times;</button>
                )}
              </div>
            </label>
            <label className={styles.poiField}>
              Durata (minuti)
              <input type="number" min={1} value={contestForm.durationMinutes} onChange={(e) => setContestForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))} />
            </label>
              <label className={styles.poiField}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={contestForm.requireSequence} onChange={(e) => setContestForm((p) => ({ ...p, requireSequence: e.target.checked }))} />
                  Sequenza ordinata
                </label>
              </label>
            <label className={styles.poiField}>
              <span>Premi</span>
              {contestForm.prizes.map((prize, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                  <input
                    type="text" value={prize.label} placeholder={`Premio ${i + 1}`}
                    onChange={(e) => {
                      const arr = [...contestForm.prizes]
                      arr[i] = { label: e.target.value }
                      setContestForm((p) => ({ ...p, prizes: arr }))
                    }}
                    style={{ flex: 1 }}
                  />
                  {contestForm.prizes.length > 1 && (
                    <button type="button" className={styles.textBtn} onClick={() => {
                      setContestForm((p) => ({ ...p, prizes: p.prizes.filter((_, j) => j !== i) }))
                    }}>&times;</button>
                  )}
                </div>
              ))}
              <button type="button" className={styles.textBtn} style={{ marginTop: '0.25rem' }} onClick={() => {
                setContestForm((p) => ({ ...p, prizes: [...p.prizes, { label: '' }] }))
              }}>+ Aggiungi premio</button>
            </label>
            <label className={styles.poiField}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={contestForm.isActive} onChange={(e) => setContestForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Attivo
              </label>
            </label>

            {cpois.filter((p) => p.groups.length > 0).length > 0 && (
              <div className={styles.poiField}>
                <span>Prelievo automatico per gruppi</span>
                <small style={{ opacity: 0.6, display: 'block', marginBottom: '0.25rem' }}>
                  Configura quanti POI prelevare da ciascun gruppo. "Aggiungi" inserisce N POI casuali per gruppo nella lista ordinata.
                </small>
                {(contestForm.pickConfig?.groupPicks ?? []).map((gp, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                    <input type="text" value={gp.group} placeholder="Nome gruppo"
                      onChange={(e) => {
                        const arr = [...(contestForm.pickConfig?.groupPicks ?? [])]
                        arr[i] = { ...arr[i], group: e.target.value }
                        setContestForm((p) => ({ ...p, pickConfig: { groupPicks: arr } }))
                      }}
                      style={{ flex: 1 }}
                    />
                    <input type="number" min={1} value={gp.count}
                      onChange={(e) => {
                        const arr = [...(contestForm.pickConfig?.groupPicks ?? [])]
                        arr[i] = { ...arr[i], count: Number(e.target.value) }
                        setContestForm((p) => ({ ...p, pickConfig: { groupPicks: arr } }))
                      }}
                      style={{ width: '70px' }}
                    />
                    <button type="button" className={styles.textBtn} onClick={() => {
                      const arr = (contestForm.pickConfig?.groupPicks ?? []).filter((_, j) => j !== i)
                      setContestForm((p) => ({ ...p, pickConfig: arr.length > 0 ? { groupPicks: arr } : null }))
                    }}>&times;</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                  <button type="button" className={styles.textBtn} onClick={() => {
                    const arr = [...(contestForm.pickConfig?.groupPicks ?? []), { group: '', count: 1 }]
                    setContestForm((p) => ({ ...p, pickConfig: { groupPicks: arr } }))
                  }}>+ Aggiungi gruppo</button>
                  {(contestForm.pickConfig?.groupPicks ?? []).length > 0 && (
                    <button type="button" className={styles.textBtn} style={{ color: 'var(--color-brand)' }} onClick={() => {
                      const picks = contestForm.pickConfig?.groupPicks ?? []
                      const newIds: string[] = []
                      for (const gp of picks) {
                        if (!gp.group) continue
                        const pool = cpois.filter((p) => p.groups.includes(gp.group))
                        const shuffled = [...pool].sort(() => Math.random() - 0.5)
                        for (let n = 0; n < gp.count; n++) {
                          const p = shuffled[n % shuffled.length]
                          if (p) newIds.push(p.id)
                        }
                      }
                      setContestForm((p) => ({ ...p, orderedPOIIds: [...p.orderedPOIIds, ...newIds] }))
                    }}>Aggiungi</button>
                  )}
                </div>
              </div>
            )}

            <label className={styles.poiField}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <span>POI disponibili</span>
                  <div className={styles.poiPool}>
                    {cpois.filter((p) => p.groups.length === 0).length > 0 && (
                      <div className={styles.poiGroupHeader}>Senza gruppo</div>
                    )}
                    {cpois.filter((p) => p.groups.length === 0).map((cpoi) => (
                      <div key={cpoi.id} className={styles.poiPoolItem}>
                        <span className={styles.poiPoolItemName}>{cpoi.name}</span>
                        <button type="button" className={styles.poiPoolItemAdd} onClick={() => {
                          setContestForm((p) => ({ ...p, orderedPOIIds: [...p.orderedPOIIds, cpoi.id] }))
                        }}>+</button>
                      </div>
                    ))}
                    {[...new Set(cpois.flatMap((p) => p.groups))].map((group) => (
                      <div key={group}>
                        <div className={styles.poiGroupHeader}>{group}</div>
                        {cpois.filter((p) => p.groups.includes(group)).map((cpoi) => (
                          <div key={cpoi.id} className={styles.poiPoolItem}>
                            <span className={styles.poiPoolItemName}>{cpoi.name}</span>
                            <button type="button" className={styles.poiPoolItemAdd} onClick={() => {
                              setContestForm((p) => ({ ...p, orderedPOIIds: [...p.orderedPOIIds, cpoi.id] }))
                            }}>+</button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <span>Ordine POI <small style={{ opacity: 0.6 }}>(&times; per rimuovere)</small></span>
                  <div className={styles.poiOrderedList}>
                    {contestForm.orderedPOIIds.length === 0 && (
                      <div className={styles.poiOrderedEmpty}>
                        Nessun POI selezionato
                      </div>
                    )}
                    {contestForm.orderedPOIIds.map((poiId, idx) => {
                      const poi = cpois.find((p) => p.id === poiId)
                      return (
                        <div key={`${poiId}-${idx}`} className={styles.poiOrderedItem}>
                          <span className={styles.poiOrderedItemLabel}>{idx + 1}. {poi?.name || poiId}</span>
                          <button type="button" className={styles.poiOrderedItemRemove}
                            onClick={() => {
                              setContestForm((p) => ({ ...p, orderedPOIIds: p.orderedPOIIds.filter((_, i) => i !== idx) }))
                            }}
                          >&times;</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </label>
            <div className={styles.poiFormActions}>
              <button className={styles.saveBtn} onClick={async () => {
                if (!eventId || savingContest || !contestForm.name.trim()) return
                setSavingContest(true)
                try {
                  const payload: {
                    eventId: string; name: string; description: string | null; startsAt?: string;
                    durationMinutes: number; requireSequence: boolean; prizes: { label: string }[];
                    isActive: boolean; orderedPOIIds: string[]; pickConfig: { groupPicks: { group: string; count: number }[] } | null;
                    poiHintSelections: { poiId: string; hintIndex: number }[];
                  } = {
                    eventId,
                    name: contestForm.name.trim(),
                    description: contestForm.description.trim() || null,
                    durationMinutes: contestForm.durationMinutes,
                    prizes: contestForm.prizes.filter((p) => p.label.trim()).map((p) => ({ label: p.label.trim() })),
                    requireSequence: contestForm.requireSequence,
                    isActive: contestForm.isActive,
                    orderedPOIIds: contestForm.orderedPOIIds,
                    pickConfig: contestForm.pickConfig,
                    poiHintSelections: contestForm.poiHintSelections,
                  }
                  if (contestForm.startsAt) {
                    payload.startsAt = new Date(contestForm.startsAt).toISOString()
                  } else {
                    payload.startsAt = null as unknown as string
                  }
                  if (editingContestId) {
                    await updateContest(editingContestId, payload)
                  } else {
                    await createContest(payload)
                  }
                  const data = await listContests(eventId)
                  setContests(data.items)
                  setShowContestForm(false)
                  setEditingContestId(null)
                } catch { /* ignore */ }
                setSavingContest(false)
              }} disabled={savingContest}>
                {savingContest ? 'Salvataggio...' : editingContestId ? 'Aggiorna contest' : 'Crea contest'}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setShowContestForm(false); setEditingContestId(null) }}>Annulla</button>
            </div>
          </div>
        )}

        <div className={styles.poiList}>
          {contests.map((contest) => (
            <div key={contest.id} className={styles.poiCard}>
              <div className={styles.poiCardBody}>
                <strong className={styles.poiCardName}>{contest.name}</strong>
                <span>{!contest.startsAt ? 'Non avviato' : contest.isActive ? 'Attivo' : 'Terminato'} &middot; {contest.durationMinutes} min &middot; {contest.requireSequence ? 'Ordinato' : 'Libero'}</span>
                {(contest.prizes ?? []).length > 0 && <span className={styles.poiCardDesc}>Premi: {(contest.prizes ?? []).filter((p) => p.awarded).length}/{(contest.prizes ?? []).length}</span>}
              </div>
              <div className={styles.poiCardActions}>
                {(!contest.startsAt || !contest.isActive) && contest.orderedPOIIds.length > 0 && (
                  <button className={styles.textBtn} style={{ color: 'var(--color-brand)' }} onClick={async () => {
                    try {
                      const data = await startContest(contest.id)
                      setContests((prev) => prev.map((c) => c.id === contest.id ? data.item : c))
                    } catch { /* ignore */ }
                  }}>Avvia</button>
                )}
                {contest.isActive && contest.startsAt && (
                  <button className={styles.dangerBtn} onClick={() => {
                    setModal({
                      open: true,
                      variant: 'confirm',
                      title: 'Interrompere il contest?',
                      message: 'Il contest verrà interrotto e potrà essere riavviato.',
                      danger: true,
                      onConfirm: async () => {
                        try {
                          const data = await updateContest(contest.id, { isActive: false, endsAt: new Date().toISOString() })
                          setContests((prev) => prev.map((c) => c.id === contest.id ? data.item : c))
                        } catch { /* ignore */ }
                        setModal((prev) => ({ ...prev, open: false }))
                      },
                    })
                  }}>Interrompi</button>
                )}
                <button className={styles.textBtn} onClick={async () => {
                  setEditingContestId(contest.id)
                  setContestForm({
                    name: contest.name,
                    description: contest.description ?? '',
                    startsAt: contest.startsAt ? contest.startsAt.slice(0, 16) : '',
                    durationMinutes: contest.durationMinutes,
                    requireSequence: contest.requireSequence,
                    prizes: (contest.prizes ?? []).length > 0 ? contest.prizes.map((p) => ({ label: p.label })) : [{ label: '' }],
                    isActive: contest.isActive,
                    orderedPOIIds: contest.orderedPOIIds,
                    pickConfig: contest.pickConfig,
                    poiHintSelections: contest.poiHintSelections,
                  })
                  setShowContestForm(true)
                }}>Modifica</button>
                <button className={styles.dangerBtn} onClick={() => {
                  setModal({
                    open: true,
                    variant: 'confirm',
                    title: 'Eliminare contest?',
                    message: 'Questa azione è irreversibile.',
                    danger: true,
                    onConfirm: async () => {
                      try {
                        await deleteContest(contest.id)
                        setContests((prev) => prev.filter((c) => c.id !== contest.id))
                      } catch { /* ignore */ }
                      setModal((prev) => ({ ...prev, open: false }))
                    },
                  })
                }}>Elimina</button>
              </div>
            </div>
          ))}
        </div>

        {/* QR print button */}
        {contests.map((contest) => (
          contest.orderedPOIIds.length > 0 && (
            <button key={contest.id} className={styles.actionBtn} style={{ margin: '0.5rem 0', display: 'block' }} onClick={() => printQrCodes(contest)}>
              Stampa QR - {contest.name}
            </button>
          )
        ))}
      </>)}

      <ConfirmModal
        open={modal.open}
        variant={modal.variant}
        title={modal.title}
        message={modal.message}
        danger={modal.danger}
        confirmLabel={modal.variant === 'confirm' ? 'Elimina' : 'OK'}
        onConfirm={() => {
          modal.onConfirm?.()
          if (modal.variant === 'alert') setModal((prev) => ({ ...prev, open: false }))
        }}
        onCancel={() => setModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
