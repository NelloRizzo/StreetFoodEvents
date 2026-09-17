import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { trackCurrencyExchange } from '../lib/analytics'
import { ConfirmModal } from '../components/ConfirmModal'
import { useAuth } from '../features/auth/auth-context'
import cambioStyles from './EventExchangePage.module.scss'

type ExchangeUser = {
  id: string
  eventId: string
  userId: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  balance: number
  isAnonymous: boolean
  isActive: boolean
  joinedAt: string
  displayName: string | null
}

type Transaction = {
  id: string
  eventUserId: string
  eventId: string
  userId: string | null
  type: string
  direction: string
  amount: number
  realAmount: number | null
  balanceAfter: number
  description: string | null
  performedByUserId: string | null
  performedByName: string | null
  occurredAt: string
}

type BalanceSummary = {
  totalTopUp: number
  totalRefund: number
  netBalance: number
  topUpCount: number
  refundCount: number
  totalTopUpReal: number
  totalRefundReal: number
  myTopUp: number
  myRefund: number
  myNetBalance: number
  myTopUpCount: number
  myRefundCount: number
  sinceResetTopUp: number
  sinceResetRefund: number
  netSinceReset: number
  mySinceResetTopUp: number
  mySinceResetRefund: number
  myNetSinceReset: number
  lastResetAt: string | null
  exchangeRate: number
  currencyName: string
  currencySymbol: string | null
  cashFloat: { euro: number; credits: number; setAt: string | null } | null
  euroContent: number
  creditsContent: number
  cashMovements: { euroIn: number; euroOut: number; creditsIn: number; creditsOut: number }
}

type CashMovement = {
  id: string
  eventId: string
  currency: 'euro' | 'credits'
  direction: 'in' | 'out'
  amount: number
  description: string | null
  performedByUserId: string | null
  performedByName: string | null
  occurredAt: string
}

type CashRegister = {
  id: string
  eventId: string
  name: string
  status: 'open' | 'closed'
  openedByUserId: string | null
  openedByName: string | null
  openedAt: string
  closedAt: string | null
  cashFloat: { euro: number; credits: number; setAt: string | null }
}

type CashRegisterBalance = {
  id: string
  name: string
  status: 'open' | 'closed'
  exchangeRate: number
  currencyName: string
  currencySymbol: string | null
  cashFloat: { euro: number; credits: number; setAt: string | null }
  topUp: number
  refund: number
  topUpCount: number
  refundCount: number
  topUpReal: number
  refundReal: number
  euroContent: number
  creditsContent: number
  cashMovements: { euroIn: number; euroOut: number; creditsIn: number; creditsOut: number }
}

function CurrencySymbol({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <span className={cambioStyles.currencyCircle} title={name}>
      {initial}
    </span>
  )
}

export function EventExchangePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [eventName, setEventName] = useState('')
  const [balance, setBalance] = useState<BalanceSummary | null>(null)

  const cassaStorageKey = eventId ? `sfe_cash_register_${eventId}` : ''
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([])
  const [activeCassa, setActiveCassa] = useState<CashRegister | null>(null)
  const [cassaBalance, setCassaBalance] = useState<CashRegisterBalance | null>(null)
  const [cassaName, setCassaName] = useState('')
  const [cassaNameEdit, setCassaNameEdit] = useState('')
  const [cassaNotice, setCassaNotice] = useState<string | null>(null)
  const [openingCassa, setOpeningCassa] = useState(false)
  const [closingCassa, setClosingCassa] = useState(false)
  const [renamingCassa, setRenamingCassa] = useState(false)
  const [duplicateCassa, setDuplicateCassa] = useState<CashRegister | null>(null)
  const [confirmCloseCassa, setConfirmCloseCassa] = useState(false)

  const [users, setUsers] = useState<ExchangeUser[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txPage, setTxPage] = useState(1)
  const [txTotalPages, setTxTotalPages] = useState(1)

  const [cashMovements, setCashMovements] = useState<CashMovement[]>([])
  const [cmPage, setCmPage] = useState(1)
  const [cmTotalPages, setCmTotalPages] = useState(1)
const [floatEuro, setFloatEuro] = useState('')
const [floatCredits, setFloatCredits] = useState('')
const [savingFloat, setSavingFloat] = useState(false)
const [showCashSetup, setShowCashSetup] = useState(false)
  const [mvCurrency, setMvCurrency] = useState<'euro' | 'credits'>('euro')
  const [mvDirection, setMvDirection] = useState<'in' | 'out'>('in')
  const [mvAmount, setMvAmount] = useState('')
  const [mvDesc, setMvDesc] = useState('')
  const [addingMovement, setAddingMovement] = useState(false)

  const [selectedUserId, setSelectedUserId] = useState('')
  const selectedUserIdRef = useRef('')
  const [selUserBalance, setSelUserBalance] = useState(0)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpDesc, setTopUpDesc] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDesc, setRefundDesc] = useState('')
  const [submitting, setSubmitting] = useState<'topup' | 'refund' | null>(null)
  const [guestName, setGuestName] = useState('')
  const [creatingGuest, setCreatingGuest] = useState(false)

  const [modal, setModal] = useState<{ open: boolean; variant: 'confirm' | 'alert'; title: string; message: string }>({
    open: false, variant: 'alert', title: '', message: ''
  })

  const fetchData = useCallback(async () => {
    if (!eventId || !isAuthenticated) return
    setLoading(true)
    let any403 = false
    try {
      const ev = await apiRequest<{ item: { name: string } }>(`/events/${eventId}`)
      setEventName(ev.item.name)
    } catch { /* event name non essenziale */}
    try {
      const [bal, usrs, txs, cms, crs] = await Promise.all([
        apiRequest<BalanceSummary>(`/exchange/${eventId}/balance`),
        apiRequest<{ items: ExchangeUser[] }>(`/exchange/${eventId}/users`),
        apiRequest<{ items: Transaction[]; pagination: { page: number; totalPages: number } }>(`/exchange/${eventId}/transactions?page=${txPage}&limit=20`),
        apiRequest<{ items: CashMovement[]; pagination: { page: number; totalPages: number } }>(`/exchange/${eventId}/cash-movements?page=${cmPage}&limit=10`),
        apiRequest<{ items: CashRegister[] }>(`/exchange/${eventId}/cash-registers`),
      ])
      setBalance(bal)
      setUsers(usrs.items)
      setTransactions(txs.items)
      setTxTotalPages(txs.pagination.totalPages)
      setCashMovements(cms.items)
      setCmTotalPages(cms.pagination.totalPages)
      setCashRegisters(crs.items)

      const storedId = cassaStorageKey ? localStorage.getItem(cassaStorageKey) : null
      const stored = storedId ? crs.items.find((c) => c.id === storedId) : undefined
      if (stored && stored.status === 'open') {
        setActiveCassa(stored)
      } else {
        if (stored && stored.status === 'closed') {
          setCassaNotice(`La cassa "${stored.name}" è stata chiusa.`)
          if (cassaStorageKey) localStorage.removeItem(cassaStorageKey)
        }
        setActiveCassa(null)
      }

      const currentId = selectedUserIdRef.current
      const stillExists = usrs.items.some((u) => u.id === currentId)
      if (!currentId || !stillExists) {
        const anon = usrs.items.find((u) => u.isAnonymous)
        if (anon) {
          setSelectedUserId(anon.id)
          selectedUserIdRef.current = anon.id
          setSelUserBalance(anon.balance)
        }
      }
    } catch (err) {
      if ((err as { status?: number }).status === 403) {
        any403 = true
      }
    }
    if (any403) setForbidden(true)
    setLoading(false)
  }, [eventId, isAuthenticated, txPage, cmPage, cassaStorageKey])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => { selectedUserIdRef.current = selectedUserId }, [selectedUserId])

  useEffect(() => {
    if (activeCassa) setCassaNameEdit(activeCassa.name)
  }, [activeCassa])

  const fetchCassaBalance = useCallback(async () => {
    if (!eventId || !activeCassa) {
      setCassaBalance(null)
      return
    }
    try {
      const cb = await apiRequest<CashRegisterBalance>(`/exchange/${eventId}/cash-registers/${activeCassa.id}/balance`)
      if (cb.status !== 'open') {
        setCassaNotice(`La cassa "${cb.name}" è stata chiusa.`)
        if (cassaStorageKey) localStorage.removeItem(cassaStorageKey)
        setActiveCassa(null)
        setCassaBalance(null)
        return
      }
      setCassaBalance(cb)
    } catch {
      setCassaBalance(null)
    }
  }, [eventId, activeCassa, cassaStorageKey])

  useEffect(() => { fetchCassaBalance() }, [fetchCassaBalance])

  const activateCassa = (cassa: CashRegister) => {
    if (cassaStorageKey) localStorage.setItem(cassaStorageKey, cassa.id)
    setCassaNotice(null)
    setActiveCassa(cassa)
  }

  const handleOpenCassa = async () => {
    if (!eventId) return
    setOpeningCassa(true)
    try {
      const res = await apiRequest<{ item: CashRegister }>(`/exchange/${eventId}/cash-registers`, {
        method: 'POST',
        bodyJson: cassaName.trim() ? { name: cassaName.trim() } : {}
      })
      setCassaName('')
      setDuplicateCassa(null)
      activateCassa(res.item)
      fetchData()
    } catch (err) {
      const e = err as { status?: number; code?: string; item?: CashRegister; message?: string }
      if (e.status === 409 && e.item) {
        setDuplicateCassa(e.item)
        setModal({
          open: true,
          variant: 'confirm',
          title: 'Cassa già aperta',
          message: `Esiste già una cassa aperta "${e.item.name}"${e.item.openedByName ? ` (${e.item.openedByName})` : ''}. Vuoi chiuderla e riaprirla su questa macchina?`
        })
      } else {
        setModal({ open: true, variant: 'alert', title: 'Errore', message: e.message || "Errore durante l'apertura della cassa" })
      }
    } finally {
      setOpeningCassa(false)
    }
  }

  const handleForceOpenCassa = async (duplicate: CashRegister) => {
    if (!eventId) return
    setOpeningCassa(true)
    try {
      const res = await apiRequest<{ item: CashRegister }>(`/exchange/${eventId}/cash-registers`, {
        method: 'POST',
        bodyJson: { name: cassaName.trim() || duplicate.name, force: true, cashRegisterToClose: duplicate.id }
      })
      setCassaName('')
      setDuplicateCassa(null)
      activateCassa(res.item)
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || "Errore durante l'apertura della cassa" })
    } finally {
      setOpeningCassa(false)
    }
  }

  const handleRenameCassa = async () => {
    if (!eventId || !activeCassa) return
    const name = cassaNameEdit.trim()
    if (!name || name === activeCassa.name) return
    setRenamingCassa(true)
    try {
      const res = await apiRequest<{ item: CashRegister }>(`/exchange/${eventId}/cash-registers/${activeCassa.id}`, {
        method: 'PATCH',
        bodyJson: { name }
      })
      setActiveCassa(res.item)
    } catch (err) {
      const e = err as { status?: number; message?: string }
      setModal({ open: true, variant: 'alert', title: e.status === 409 ? 'Nome già in uso' : 'Errore', message: e.message || 'Errore durante la rinomina della cassa' })
      setCassaNameEdit(activeCassa.name)
    } finally {
      setRenamingCassa(false)
    }
  }

  const handleCloseCassa = async () => {
    if (!eventId || !activeCassa) return
    setClosingCassa(true)
    try {
      await apiRequest(`/exchange/${eventId}/cash-registers/${activeCassa.id}/close`, { method: 'POST', bodyJson: {} })
      if (cassaStorageKey) localStorage.removeItem(cassaStorageKey)
      setCassaNotice(`Cassa "${activeCassa.name}" chiusa.`)
      setActiveCassa(null)
      setCassaBalance(null)
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante la chiusura della cassa' })
    } finally {
      setClosingCassa(false)
    }
  }

  const handleTopUp = async () => {
    if (!eventId || !selectedUserId || !topUpAmount || !activeCassa) return
    const amount = parseFloat(topUpAmount)
    if (!amount || amount <= 0) return
    setSubmitting('topup')
    try {
      const res = await apiRequest<{ newBalance: number }>(`/exchange/${eventId}/top-up`, {
        method: 'POST',
        bodyJson: { eventUserId: selectedUserId, amount, description: topUpDesc.trim() || undefined, cashRegisterId: activeCassa.id }
      })
      setSelUserBalance(res.newBalance)
      setTopUpAmount('')
      setTopUpDesc('')
      trackCurrencyExchange({ eventId, amount, type: 'topup' })
      const rate = balance?.exchangeRate ?? 1
      const credits = amount * rate
      setModal({ open: true, variant: 'alert', title: 'Carico completato', message: `Caricati €${amount.toFixed(2)} → ${credits.toFixed(2)} ${balance?.currencyName ?? 'crediti'}. Nuovo saldo: ${res.newBalance}` })
      fetchData()
      fetchCassaBalance()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante il carico' })
    } finally {
      setSubmitting(null)
    }
  }

  const handleRefund = async () => {
    if (!eventId || !selectedUserId || !refundAmount || !activeCassa) return
    const amount = parseFloat(refundAmount)
    if (!amount || amount <= 0) return
    setSubmitting('refund')
    try {
      const res = await apiRequest<{ newBalance: number }>(`/exchange/${eventId}/refund`, {
        method: 'POST',
        bodyJson: { eventUserId: selectedUserId, amount, description: refundDesc.trim() || undefined, cashRegisterId: activeCassa.id }
      })
      setSelUserBalance(res.newBalance)
      setRefundAmount('')
      setRefundDesc('')
      trackCurrencyExchange({ eventId, amount, type: 'refund' })
      const rate = balance?.exchangeRate ?? 1
      const real = amount / rate
      setModal({ open: true, variant: 'alert', title: 'Rimborso completato', message: `Rimborsati ${amount.toFixed(2)} ${balance?.currencyName ?? 'crediti'} → €${real.toFixed(2)}. Nuovo saldo: ${res.newBalance}` })
      fetchData()
      fetchCassaBalance()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante il rimborso' })
    } finally {
      setSubmitting(null)
    }
  }

  const handleSaveFloat = async () => {
    if (!eventId || !activeCassa) return
    setSavingFloat(true)
    try {
      await apiRequest(`/exchange/${eventId}/cash-float`, {
        method: 'POST',
        bodyJson: {
          cashRegisterId: activeCassa.id,
          ...(floatEuro !== '' ? { euro: parseFloat(floatEuro) } : {}),
          ...(floatCredits !== '' ? { credits: parseFloat(floatCredits) } : {})
        }
      })
      setFloatEuro('')
      setFloatCredits('')
      setModal({ open: true, variant: 'alert', title: 'Fondo cassa aggiornato', message: 'Il fondo cassa è stato impostato.' })
      fetchData()
      fetchCassaBalance()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante il salvataggio del fondo cassa' })
    } finally {
      setSavingFloat(false)
    }
  }

  const handleAddMovement = async () => {
    if (!eventId || !mvAmount || !activeCassa) return
    const amount = parseFloat(mvAmount)
    if (!amount || amount <= 0) return
    setAddingMovement(true)
    try {
      await apiRequest(`/exchange/${eventId}/cash-movements`, {
        method: 'POST',
        bodyJson: { currency: mvCurrency, direction: mvDirection, amount, description: mvDesc.trim() || undefined, cashRegisterId: activeCassa.id }
      })
      setMvAmount('')
      setMvDesc('')
      fetchData()
      fetchCassaBalance()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante la registrazione del movimento' })
    } finally {
      setAddingMovement(false)
    }
  }

  const handleCreateGuest = async () => {
    if (!eventId) return
    setCreatingGuest(true)
    try {
      const res = await apiRequest<{ item: ExchangeUser }>(`/exchange/${eventId}/guests`, {
        method: 'POST',
        bodyJson: { displayName: guestName.trim() || undefined }
      })
      setGuestName('')
      setSelectedUserId(res.item.id)
      selectedUserIdRef.current = res.item.id
      setSelUserBalance(res.item.balance)
      fetchData()
    } catch (err) {
      setModal({ open: true, variant: 'alert', title: 'Errore', message: (err as { message?: string }).message || 'Errore durante la creazione del cliente' })
    } finally {
      setCreatingGuest(false)
    }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)
  const rate = balance?.exchangeRate ?? 1
  const currencyName = balance?.currencyName ?? 'crediti'

  function fmt(v: number) { return v.toFixed(2) }
  function fmtEur(v: number) { return `€${v.toFixed(2)}` }

  if (forbidden) {
    return (
      <div className={cambioStyles.fullPage}>
        <h1 className={cambioStyles.exTitle}>Accesso negato</h1>
        <p>Non hai i permessi per accedere a questa pagina.</p>
        <Link to="/admin/dashboard" className={cambioStyles.exBackLink}>&larr; Torna ad admin</Link>
      </div>
    )
  }

  return (
    <div className={cambioStyles.fullPage}>
      <Link to="/admin/dashboard" className={cambioStyles.exBackLink}>&larr; Torna ad admin</Link>
      <h1 className={cambioStyles.exTitle}>
        <CurrencySymbol name={currencyName} /> Cambio - {eventName || 'Caricamento...'}
      </h1>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <>
          <section className={cambioStyles.section}>
            <h2 className={cambioStyles.exSectionTitle}>Contenuto cassa</h2>
            {activeCassa && (
              <div className={cambioStyles.cassaHeader}>
                <div className={cambioStyles.cassaIdentity}>
                  <span className={cambioStyles.cassaStatusOpen}>Aperta</span>
                  <input
                    className={cambioStyles.cassaName}
                    value={cassaNameEdit}
                    onChange={(e) => setCassaNameEdit(e.target.value)}
                  />
                  <button
                    type="button"
                    className={cambioStyles.exTextBtn}
                    onClick={handleRenameCassa}
                    disabled={renamingCassa || !cassaNameEdit.trim() || cassaNameEdit.trim() === activeCassa.name}
                  >
                    {renamingCassa ? '...' : 'Rinomina'}
                  </button>
                  <span className={cambioStyles.cassaMeta}>
                    aperta da {activeCassa.openedByName || 'operatore'} · {new Date(activeCassa.openedAt).toLocaleString('it-IT')}
                  </span>
                </div>
                <div className={cambioStyles.cassaActions}>
                  <button
                    type="button"
                    className={cambioStyles.btnCloseCassa}
                    onClick={() => {
                      setConfirmCloseCassa(true)
                      setModal({
                        open: true,
                        variant: 'confirm',
                        title: 'Chiudi cassa',
                        message: `Confermi la chiusura della cassa "${activeCassa.name}"? Su questa cassa non saranno più possibili operazioni.`
                      })
                    }}
                    disabled={closingCassa}
                  >
                    {closingCassa ? 'Chiusura...' : 'Chiudi cassa'}
                  </button>
                </div>
              </div>
            )}

            {activeCassa && cassaBalance && (
              <>
                <div className={cambioStyles.cardRow}>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>Euro in cassa</div>
                    <div className={cambioStyles.statValue}>{fmtEur(cassaBalance.euroContent)}</div>
                    <div className={cambioStyles.statSub}>
                      Fondo: {fmtEur(cassaBalance.cashFloat?.euro ?? 0)}
                      {' · '}Movimenti: +{fmtEur(cassaBalance.cashMovements.euroIn)} / -{fmtEur(cassaBalance.cashMovements.euroOut)}
                      {' · '}Top-up − Rimborso: {fmtEur(cassaBalance.topUpReal - cassaBalance.refundReal)}
                    </div>
                  </div>
                  <div className={cambioStyles.statCard}>
                    <div className={cambioStyles.statLabel}>{currencyName} in cassa</div>
                    <div className={cambioStyles.statValue}>{fmt(cassaBalance.creditsContent)}</div>
                    <div className={cambioStyles.statSub}>
                      Fondo: {fmt(cassaBalance.cashFloat?.credits ?? 0)}
                      {' · '}Movimenti: +{fmt(cassaBalance.cashMovements.creditsIn)} / -{fmt(cassaBalance.cashMovements.creditsOut)}
                      {' · '}Rimborsi − Top-up: {fmt(cassaBalance.refund - cassaBalance.topUp)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className={cambioStyles.exTextBtn}
                  onClick={() => setShowCashSetup((v) => !v)}
                >
                  {showCashSetup ? '\u25BE Nascondi impostazioni cassa' : '\u25B8 Fondo cassa e movimenti'}
                </button>

                {showCashSetup && (
                  <div className={cambioStyles.formGrid}>
                    <div className={cambioStyles.formCard}>
                      <h3 style={{ marginTop: 0 }}>Imposta fondo cassa</h3>
                      <p className={cambioStyles.statSub}>Contenuto iniziale della cassa (euro e token separatamente). I valori lasciati vuoti restano invariati.</p>
                      <label className={cambioStyles.field}>
                        Fondo Euro
                        <input type="number" min="0" step="0.01" value={floatEuro}
                          onChange={(e) => setFloatEuro(e.target.value)}
                          placeholder={cassaBalance.cashFloat ? String(cassaBalance.cashFloat.euro) : '0'} />
                      </label>
                      <label className={cambioStyles.field}>
                        Fondo {currencyName}
                        <input type="number" min="0" step="0.01" value={floatCredits}
                          onChange={(e) => setFloatCredits(e.target.value)}
                          placeholder={cassaBalance.cashFloat ? String(cassaBalance.cashFloat.credits) : '0'} />
                      </label>
                      <button className={cambioStyles.btnTopUp} onClick={handleSaveFloat} disabled={savingFloat || (floatEuro === '' && floatCredits === '')}>
                        {savingFloat ? 'Salvataggio...' : 'Salva fondo cassa'}
                      </button>
                    </div>

                    <div className={cambioStyles.formCard}>
                      <h3 style={{ marginTop: 0 }}>Registra movimento</h3>
                      <p className={cambioStyles.statSub}>Carico o prelievo di contanti/token dalla cassa (trasferimenti verso o da altre casse).</p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <label className={cambioStyles.field} style={{ flex: 1 }}>
                          Valuta
                          <select className={cambioStyles.userSelect} value={mvCurrency} onChange={(e) => setMvCurrency(e.target.value as 'euro' | 'credits')}>
                            <option value="euro">Euro</option>
                            <option value="credits">{currencyName}</option>
                          </select>
                        </label>
                        <label className={cambioStyles.field} style={{ flex: 1 }}>
                          Tipo
                          <select className={cambioStyles.userSelect} value={mvDirection} onChange={(e) => setMvDirection(e.target.value as 'in' | 'out')}>
                            <option value="in">Carico (entra)</option>
                            <option value="out">Prelievo (esce)</option>
                          </select>
                        </label>
                      </div>
                      <label className={cambioStyles.field}>
                        Importo
                        <input type="number" min="0.01" step="0.01" value={mvAmount}
                          onChange={(e) => setMvAmount(e.target.value)} />
                      </label>
                      <label className={cambioStyles.field}>
                        Note (opzionale)
                        <input type="text" value={mvDesc} onChange={(e) => setMvDesc(e.target.value)} />
                      </label>
                      <button className={mvDirection === 'in' ? cambioStyles.btnTopUp : cambioStyles.btnRefund}
                        onClick={handleAddMovement}
                        disabled={addingMovement || !mvAmount}>
                        {addingMovement ? 'Registrazione...' : mvDirection === 'in' ? 'Registra carico' : 'Registra prelievo'}
                      </button>
                    </div>
                  </div>
                )}

                <h3>Movimenti di cassa</h3>
                {cashMovements.length === 0 ? (
                  <p className={cambioStyles.exEmpty}>Nessun movimento di cassa registrato.</p>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Data</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tipo</th>
                            <th style={{ textAlign: 'right', padding: '0.5rem' }}>Importo</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Note</th>
                            <th style={{ textAlign: 'left', padding: '0.5rem' }}>Operatore</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashMovements.map((cm) => (
                            <tr key={cm.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                                {new Date(cm.occurredAt).toLocaleString('it-IT')}
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                {cm.direction === 'in' ? 'Carico' : 'Prelievo'} {cm.currency === 'euro' ? '€' : currencyName}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: cm.direction === 'in' ? 'var(--color-green)' : 'var(--color-red)' }}>
                                {cm.direction === 'in' ? '+' : '-'}{cm.currency === 'euro' ? fmtEur(cm.amount) : fmt(cm.amount)}
                              </td>
                              <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden' }}>{cm.description || '-'}</td>
                              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{cm.performedByName || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {cmTotalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                        <button className={cambioStyles.exTextBtn} disabled={cmPage <= 1} onClick={() => setCmPage((p) => Math.max(1, p - 1))}>
                          Precedente
                        </button>
                        <span style={{ padding: '0.25rem 0.5rem' }}>{cmPage} / {cmTotalPages}</span>
                        <button className={cambioStyles.exTextBtn} disabled={cmPage >= cmTotalPages} onClick={() => setCmPage((p) => p + 1)}>
                          Successivo
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {!activeCassa && (
              <div className={cambioStyles.cassaOpenCard}>
                <h3>Apri cassa</h3>
                <p className={cambioStyles.statSub}>
                  Apri una cassa su questa postazione per eseguire operazioni di cambio. Il nome è modificabile.
                </p>
                <label className={cambioStyles.field}>
                  Nome cassa
                  <input
                    type="text"
                    value={cassaName}
                    onChange={(e) => setCassaName(e.target.value)}
                    placeholder={`Cassa ${cashRegisters.length + 1} (automatico)`}
                    disabled={openingCassa}
                  />
                </label>
                <button className={cambioStyles.btnTopUp} onClick={handleOpenCassa} disabled={openingCassa}>
                  {openingCassa ? 'Apertura...' : 'Apri cassa'}
                </button>
                {cassaNotice && <p className={cambioStyles.cassaNotice}>{cassaNotice}</p>}
              </div>
            )}
          </section>

          <section className={cambioStyles.section}>
            <h2 className={cambioStyles.exSectionTitle}>Seleziona utente</h2>
            <div className={cambioStyles.userRow}>
              <select
                value={selectedUserId}
                className={cambioStyles.userSelect}
                onChange={(e) => {
                  const uid = e.target.value
                  setSelectedUserId(uid)
                  selectedUserIdRef.current = uid
                  const u = users.find((x) => x.id === uid)
                  setSelUserBalance(u?.balance ?? 0)
                }}
              >
                <option value="">-- Seleziona --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.isAnonymous
                      ? (u.displayName ? `\u{1F464} ${u.displayName} (saldo: ${fmt(u.balance)})` : `\u{1F464} Cliente generico (saldo: ${fmt(u.balance)})`)
                      : `${u.firstName || ''} ${u.lastName || ''} (${u.email || ''}) - saldo: ${fmt(u.balance)}`}
                  </option>
                ))}
              </select>
              <div className={cambioStyles.guestCreate}>
                <input type="text" placeholder="Nome cliente..." value={guestName}
                  className={cambioStyles.guestInput}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGuest() }}
                  disabled={creatingGuest} />
                <button className={cambioStyles.btnGuest} onClick={handleCreateGuest} disabled={creatingGuest}>
                  {creatingGuest ? '...' : '+ Crea'}
                </button>
              </div>
            </div>

            {selectedUser && (
              <p className={cambioStyles.userInfo}>
                Saldo: <strong>{fmt(selUserBalance ?? selectedUser.balance)}</strong>
                <span className={cambioStyles.eurValue}> ({fmtEur((selUserBalance ?? selectedUser.balance) / rate)})</span>
                {selectedUser.isAnonymous && ' - Cliente generico'}
              </p>
            )}
          </section>

          {!activeCassa && (
            <p className={cambioStyles.cassaLocked}>
              Nessuna cassa aperta: apri una cassa per eseguire carichi, rimborsi e movimenti.
            </p>
          )}

          <div className={cambioStyles.formGrid}>
            <section>
              <h2 className={cambioStyles.exSectionTitle}>Carica (Reale &rarr; Virtuale)</h2>
              <div className={cambioStyles.formCard}>
                <label className={cambioStyles.field}>
                  Importo €
                  <input type="number" min="0.01" step="0.01" value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    disabled={!selectedUserId || !activeCassa || submitting === 'topup'} />
                </label>
                {topUpAmount && parseFloat(topUpAmount) > 0 && (
                  <p className={cambioStyles.preview}>
                    ≈ {(parseFloat(topUpAmount) * rate).toFixed(2)} {currencyName}
                  </p>
                )}
                <label className={cambioStyles.field}>
                  Note (opzionale)
                  <input type="text" value={topUpDesc}
                    onChange={(e) => setTopUpDesc(e.target.value)}
                    disabled={!selectedUserId || !activeCassa || submitting === 'topup'} />
                </label>
                <button className={cambioStyles.btnTopUp} onClick={handleTopUp}
                  disabled={!selectedUserId || !topUpAmount || !activeCassa || submitting === 'topup'}>
                  {submitting === 'topup' ? 'Caricamento...' : `Carica €`}
                </button>
              </div>
            </section>

            <section>
              <h2 className={cambioStyles.exSectionTitle}>Rimborsa (Virtuale &rarr; Reale)</h2>
              <div className={cambioStyles.formCard}>
                <label className={cambioStyles.field}>
                  Importo {currencyName}
                  <input type="number" min="0.01" step="0.01" value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    disabled={!selectedUserId || !activeCassa || submitting === 'refund'} />
                </label>
                {refundAmount && parseFloat(refundAmount) > 0 && (
                  <p className={cambioStyles.preview}>
                    ≈ €{(parseFloat(refundAmount) / rate).toFixed(2)}
                  </p>
                )}
                <label className={cambioStyles.field}>
                  Note (opzionale)
                  <input type="text" value={refundDesc}
                    onChange={(e) => setRefundDesc(e.target.value)}
                    disabled={!selectedUserId || !activeCassa || submitting === 'refund'} />
                </label>
                <button className={cambioStyles.btnRefund} onClick={handleRefund}
                  disabled={!selectedUserId || !refundAmount || !activeCassa || submitting === 'refund'}>
                  {submitting === 'refund' ? 'Rimborso in corso...' : `Rimborsa ${currencyName}`}
                </button>
              </div>
            </section>
          </div>

          <section>
            <h2 className={cambioStyles.exSectionTitle}>Storico transazioni</h2>
            {transactions.length === 0 ? (
              <p className={cambioStyles.exEmpty}>Nessuna transazione di cambio registrata.</p>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Data</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tipo</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Importo {currencyName}</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Equivalente €</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem' }}>Saldo dopo<br /><span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(crediti / €)</span></th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Operatore</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {new Date(tx.occurredAt).toLocaleString('it-IT')}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {tx.type === 'top-up' ? 'Carico' : 'Rimborso'}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: tx.type === 'top-up' ? 'var(--color-green)' : 'var(--color-red)' }}>
                            {tx.type === 'top-up' ? '+' : '-'}{fmt(tx.amount)}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                            {fmtEur(tx.realAmount ?? (tx.amount / rate))}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            {fmt(tx.balanceAfter)}
                            <br /><span className={cambioStyles.eurValue}>{fmtEur(tx.balanceAfter / rate)}</span>
                          </td>
                          <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                            {tx.performedByName || '-'}
                          </td>
                          <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden' }}>
                            {tx.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {txTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className={cambioStyles.exTextBtn} disabled={txPage <= 1} onClick={() => setTxPage((p) => Math.max(1, p - 1))}>
                      Precedente
                    </button>
                    <span style={{ padding: '0.25rem 0.5rem' }}>{txPage} / {txTotalPages}</span>
                    <button className={cambioStyles.exTextBtn} disabled={txPage >= txTotalPages} onClick={() => setTxPage((p) => p + 1)}>
                      Successivo
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      <ConfirmModal
        open={modal.open}
        variant={modal.variant}
        title={modal.title}
        message={modal.message}
        confirmLabel={duplicateCassa || confirmCloseCassa ? 'Conferma' : 'OK'}
        onConfirm={() => {
          setModal((prev) => ({ ...prev, open: false }))
          if (duplicateCassa) {
            handleForceOpenCassa(duplicateCassa)
            return
          }
          if (confirmCloseCassa) {
            setConfirmCloseCassa(false)
            handleCloseCassa()
          }
        }}
        onCancel={() => {
          setDuplicateCassa(null)
          setConfirmCloseCassa(false)
          setModal((prev) => ({ ...prev, open: false }))
        }}
      />
    </div>
  )
}