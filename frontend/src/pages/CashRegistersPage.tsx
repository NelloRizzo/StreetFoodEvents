import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'

import { apiRequest } from '../lib/api'
import type { UploadedImage } from '../lib/upload'
import { useAuth } from '../features/auth/auth-context'
import { CurrencyDisplay } from '../components/CurrencyDisplay'
import { ConfirmModal } from '../components/ConfirmModal'
import reportStyles from './EventReportPage.module.scss'
import styles from './CashRegistersPage.module.scss'

type CashFloat = { euro: number; credits: number; setAt: string | null }

type ReportItem = {
  id: string
  name: string
  status: 'open' | 'closed'
  openedByUserId: string | null
  openedByName: string | null
  openedAt: string
  closedAt: string | null
  cashFloat: CashFloat
  topUp: number
  refund: number
  topUpCount: number
  refundCount: number
  topUpReal: number
  refundReal: number
  euroContent: number
  creditsContent: number
  sinceTopUpCount: number
  sinceRefundCount: number
  sinceTotalCount: number
}

type CashRegistersReport = {
  eventId: string
  eventName: string
  exchangeRate: number
  currencyName: string
  currencySymbol: UploadedImage | null
  from: string | null
  to: string | null
  items: ReportItem[]
  totals: {
    openCount: number
    closedCount: number
    floatEuro: number
    floatCredits: number
    euroContent: number
    creditsContent: number
    sinceTotalCount: number
    sinceTopUpCount: number
    sinceRefundCount: number
  }
}

type CashRequestKind = 'euro' | 'credits' | 'both'

type CashRequestItem = {
  id: string
  cashRegisterId: string
  cashRegisterName: string | null
  kind: CashRequestKind
  amountEuro: number | null
  amountCredits: number | null
  note: string | null
  isAutomatic: boolean
  contentEuro: number | null
  contentCredits: number | null
  status: 'pending' | 'acknowledged' | 'delivered' | 'confirmed' | 'cancelled'
  requestedByName: string | null
  requestedAt: string
  acknowledgedAt: string | null
  deliveredAt: string | null
  deliveredEuro: number | null
  deliveredCredits: number | null
  cancelledAt: string | null
}

function kindLabel(kind: CashRequestKind): string {
  if (kind === 'euro') return 'Euro'
  if (kind === 'credits') return 'Token'
  return 'Euro + token'
}

function fmtEur(n: number) {
  return `€${n.toFixed(2)}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CassaRow({ item, isTotal, onClose }: { item: ReportItem; isTotal?: boolean; onClose?: (item: ReportItem) => void }) {
  return (
    <tr className={isTotal ? reportStyles.tableTotals : undefined}>
      <td className={styles.cassaName}>
        {item.name}
        {!isTotal && <span className={styles.sub}>Aperta il {fmtDateTime(item.openedAt)}</span>}
      </td>
      <td>
        {isTotal ? (
          '—'
        ) : (
          <span className={`${styles.statusBadge} ${item.status === 'open' ? styles.statusOpen : styles.statusClosed}`}>
            {item.status === 'open' ? 'Aperta' : 'Chiusa'}
          </span>
        )}
      </td>
      <td className={styles.openerName}>{item.openedByName ?? '—'}</td>
      <td className={reportStyles.num}>{fmtEur(item.cashFloat.euro)}</td>
      <td className={reportStyles.num}>{item.cashFloat.credits.toFixed(2)}</td>
      <td className={reportStyles.num}>{fmtEur(item.euroContent)}</td>
      <td className={reportStyles.num}>{item.creditsContent.toFixed(2)}</td>
      <td className={reportStyles.num}>
        {item.sinceTotalCount}
        <span className={styles.sub}>{item.sinceTopUpCount} carichi / {item.sinceRefundCount} rimborsi</span>
      </td>
      <td className={styles.printHide}>
        {!isTotal && item.status === 'open' && onClose ? (
          <button className={styles.closeBtn} onClick={() => onClose(item)}>
            Chiudi
          </button>
        ) : (
          '—'
        )}
      </td>
    </tr>
  )
}

export function CashRegistersPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { isAuthenticated } = useAuth()

  const [report, setReport] = useState<CashRegistersReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [closeTarget, setCloseTarget] = useState<ReportItem | null>(null)
  const [closing, setClosing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /* Richieste dalle postazioni: la master le prende in carico e le consegna. */
  const [requests, setRequests] = useState<CashRequestItem[]>([])
  const [busyRequest, setBusyRequest] = useState<string | null>(null)
  const [deliverTarget, setDeliverTarget] = useState<CashRequestItem | null>(null)
  const [deliverEuro, setDeliverEuro] = useState('')
  const [deliverCredits, setDeliverCredits] = useState('')
  const [resetAllOpen, setResetAllOpen] = useState(false)
  const [resettingAll, setResettingAll] = useState(false)

  const loadRequests = useCallback(async () => {
    if (!eventId || !isAuthenticated) return
    try {
      const res = await apiRequest<{ items: CashRequestItem[] }>(
        /* Anche le consegnate non confermate: la master deve vedere che la
         * postazione non ha ancora confermato la ricezione. */
        `/exchange/${eventId}/cash-requests?status=pending,acknowledged,delivered&limit=50`
      )
      setRequests(res.items)
    } catch {
      setRequests([])
    }
  }, [eventId, isAuthenticated])

  const handleResetAll = async () => {
    if (!eventId) return
    setResettingAll(true)
    try {
      await apiRequest(`/exchange/${eventId}/cash-registers/reset-all`, { method: 'POST', bodyJson: {} })
      setResetAllOpen(false)
      setErrorMsg(null)
      /* Il reset invalida tutto: la postazione non deve più puntare a una cassa
       * chiusa dallo zero. */
      if (eventId) localStorage.removeItem(`sfe_cash_register_${eventId}`)
      await Promise.all([loadRequests(), load(true)])
    } catch (err) {
      setResetAllOpen(false)
      setErrorMsg((err as { message?: string }).message || 'Azzeramento non riuscito')
    } finally {
      setResettingAll(false)
    }
  }

  const load = useCallback(async (silent = false) => {    if (!eventId || !isAuthenticated) return
    if (!silent) setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', new Date(from).toISOString())
      if (to) params.set('to', new Date(to).toISOString())
      const qs = params.toString()
      const data = await apiRequest<CashRegistersReport>(
        `/exchange/${eventId}/cash-registers/report${qs ? `?${qs}` : ''}`
      )
      setReport(data)
      setForbidden(false)
    } catch (err) {
      if ((err as { status?: number }).status === 403) setForbidden(true)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [eventId, isAuthenticated, from, to])

  useEffect(() => { void load() }, [load])

  useEffect(() => { void loadRequests() }, [loadRequests])

  useEffect(() => {
    const id = setInterval(() => { void load(true) }, 5000)
    return () => clearInterval(id)
  }, [load])

  /* Polling 5s anche sulle richieste: sono l'urgenza operativa della master. */
  useEffect(() => {
    const id = setInterval(() => { void loadRequests() }, 5000)
    return () => clearInterval(id)
  }, [loadRequests])

  if (isLoading) return null
  if (forbidden) {
    return (
      <div className={reportStyles.page}>
        <div className="page-shell">
          <p className={styles.empty}>Accesso negato.</p>
        </div>
      </div>
    )
  }
  if (!eventId || !report) return null

  const handleCloseCassa = async () => {
    if (!eventId || !closeTarget || closing) return
    setClosing(true)
    try {
      await apiRequest(`/exchange/${eventId}/cash-registers/${closeTarget.id}/close`, { method: 'POST', bodyJson: {} })
      setCloseTarget(null)
      setErrorMsg(null)
      await load(true)
    } catch (err) {
      setCloseTarget(null)
      setErrorMsg((err as { message?: string }).message || 'Errore durante la chiusura della cassa')
    } finally {
      setClosing(false)
    }
  }

  const { totals } = report

  const handleAckRequest = async (request: CashRequestItem) => {
    if (!eventId || busyRequest) return
    setBusyRequest(request.id)
    setErrorMsg(null)
    try {
      await apiRequest(`/exchange/${eventId}/cash-requests/${request.id}`, {
        method: 'PATCH',
        bodyJson: { status: 'acknowledged' }
      })
      await loadRequests()
    } catch (err) {
      setErrorMsg((err as { message?: string }).message || 'Presa in carico non riuscita')
    } finally {
      setBusyRequest(null)
    }
  }

  const openDeliver = (request: CashRequestItem) => {
    setDeliverTarget(request)
    setDeliverEuro(request.amountEuro !== null ? String(request.amountEuro) : '')
    setDeliverCredits(request.amountCredits !== null ? String(request.amountCredits) : '')
  }

  const handleDeliverRequest = async () => {
    if (!eventId || !deliverTarget || busyRequest) return
    setBusyRequest(deliverTarget.id)
    setErrorMsg(null)
    try {
      await apiRequest(`/exchange/${eventId}/cash-requests/${deliverTarget.id}`, {
        method: 'PATCH',
        bodyJson: {
          status: 'delivered',
          ...(deliverEuro !== '' ? { deliveredEuro: parseFloat(deliverEuro) } : {}),
          ...(deliverCredits !== '' ? { deliveredCredits: parseFloat(deliverCredits) } : {})
        }
      })
      setDeliverTarget(null)
      await Promise.all([loadRequests(), load(true)])
    } catch (err) {
      setErrorMsg((err as { message?: string }).message || 'Consegna non riuscita')
    } finally {
      setBusyRequest(null)
    }
  }

  const handleCancelRequest = async (request: CashRequestItem) => {
    if (!eventId || busyRequest) return
    setBusyRequest(request.id)
    setErrorMsg(null)
    try {
      await apiRequest(`/exchange/${eventId}/cash-requests/${request.id}`, {
        method: 'PATCH',
        bodyJson: { status: 'cancelled' }
      })
      await loadRequests()
    } catch (err) {
      setErrorMsg((err as { message?: string }).message || 'Annullamento non riuscito')
    } finally {
      setBusyRequest(null)
    }
  }

  return (
    <div className={reportStyles.page}>
      <div className="page-shell">
        {errorMsg && (
          <p className={styles.error} role="alert">
            {errorMsg}
          </p>
        )}
        <div className={reportStyles.header}>
          <div>
            <h1 className={reportStyles.title}>
              <CurrencyDisplay currencyName={report.currencyName} currencySymbol={report.currencySymbol} /> Master Cambio — {report.eventName}
            </h1>
          </div>
          <div className={reportStyles.headerActions}>
            <div className={reportStyles.dateGroup}>
              <label className={reportStyles.dateLabel}>Transazioni da</label>
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setIsLoading(true) }}
                className={reportStyles.dateInput}
              />
              <label className={reportStyles.dateLabel}>a</label>
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => { setTo(e.target.value); setIsLoading(true) }}
                className={reportStyles.dateInput}
              />
              {(from || to) && (
                <button
                  className={reportStyles.secondaryBtn}
                  onClick={() => { setFrom(''); setTo(''); setIsLoading(true) }}
                >
                  Azzera
                </button>
              )}
            </div>
            <button className={reportStyles.secondaryBtn} onClick={() => window.print()}>
              Stampa
            </button>
            <button
              className={`${reportStyles.secondaryBtn} ${styles.printHide}`}
              onClick={() => setResetAllOpen(true)}
              disabled={resettingAll}
            >
              {resettingAll ? 'Azzeramento...' : 'Azzera tutto'}
            </button>
          </div>
        </div>

        <div className={reportStyles.reportGrid}>
          <div className={reportStyles.card}>
            <div className={reportStyles.cardTitle}>
              Richieste dalle postazioni
              {requests.length > 0 && <span className={styles.reqBadge}>{requests.length}</span>}
            </div>
            {requests.length === 0 ? (
              <p className={styles.empty}>Nessuna richiesta aperta dalle postazioni.</p>
            ) : (
              <div className={reportStyles.tableWrap}>
                <table className={reportStyles.table}>
                  <thead>
                    <tr>
                      <th>Postazione</th>
                      <th>Serva</th>
                      <th className={reportStyles.num}>Proposta</th>
                      <th>Contenuto ora</th>
                      <th>Stato</th>
                      <th>Chiedente</th>
                      <th className={styles.printHide}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.cashRegisterName ?? '—'}
                          {r.note && <span className={styles.sub}>{r.note}</span>}
                        </td>
                        <td>
                          {kindLabel(r.kind)}
                          {r.isAutomatic && <span className={styles.sub}>sotto soglia</span>}
                        </td>
                        <td className={reportStyles.num}>
                          {r.amountEuro !== null ? fmtEur(r.amountEuro) : '—'}
                          {r.amountCredits !== null ? ` / ${r.amountCredits.toFixed(0)} ${report.currencyName}` : ''}
                        </td>
                        <td className={reportStyles.num}>
                          {r.contentEuro !== null ? fmtEur(r.contentEuro) : '—'}
                          {r.contentCredits !== null ? ` / ${r.contentCredits.toFixed(0)}` : ''}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${r.status === 'pending' ? styles.statusPending : styles.statusAck}`}>
                            {r.status === 'pending' ? 'In attesa' : 'Presa in carico'}
                          </span>
                          {r.status === 'delivered' && (
                            <span className={`${styles.statusBadge} ${styles.statusAck} ${styles.printHide}`}>
                              Consegnata · in attesa conferma postazione
                            </span>
                          )}
                        </td>
                        <td className={styles.openerName}>
                          {r.requestedByName ?? '—'}
                          <span className={styles.sub}>{new Date(r.requestedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className={styles.printHide}>
                          <div className={styles.reqActions}>
                            {r.status === 'pending' && (
                              <button
                                className={styles.reqBtn}
                                disabled={busyRequest === r.id}
                                onClick={() => void handleAckRequest(r)}
                              >
                                Prendi in carico
                              </button>
                            )}
                            {r.status !== 'delivered' && (
                              <>
                                <button
                                  className={styles.reqBtnPrimary}
                                  disabled={busyRequest === r.id}
                                  onClick={() => openDeliver(r)}
                                >
                                  Consegna
                                </button>
                                <button
                                  className={styles.closeBtn}
                                  disabled={busyRequest === r.id}
                                  onClick={() => void handleCancelRequest(r)}
                                >
                                  Rifiuta
                                </button>
                              </>
                            )}
                            {r.status === 'delivered' && (
                              <span className={styles.sub}>in attesa conferma della postazione</span>
                            )}                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.note}>
              Le richieste partono dalle postazioni del banco cambio, manualmente o da sole quando il contenuto
              scende sotto la soglia di sicurezza. La «Consegna» versa il contante/token nella cassa richiedente e
              registra il movimento in ingresso, quindi il contenuto della cassa si aggiorna da solo.
            </p>
          </div>
        </div>

        <div className={reportStyles.reportGrid}>
          <div className={reportStyles.card}>
            <div className={reportStyles.cardTitle}>Riepilogo casse</div>
            <div className={reportStyles.totalsBar}>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Casse aperte</span>
                <span className={reportStyles.totalValue}>{totals.openCount}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Casse chiuse</span>
                <span className={reportStyles.totalValue}>{totals.closedCount}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Fondo €</span>
                <span className={reportStyles.totalValue}>{fmtEur(totals.floatEuro)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Fondo {report.currencyName}</span>
                <span className={reportStyles.totalValue}>{totals.floatCredits.toFixed(2)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Contenuto €</span>
                <span className={reportStyles.totalValue}>{fmtEur(totals.euroContent)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Contenuto {report.currencyName}</span>
                <span className={reportStyles.totalValue}>{totals.creditsContent.toFixed(2)}</span>
              </div>
              <div className={reportStyles.totalItem}>
                <span className={reportStyles.totalLabel}>Transazioni nel periodo</span>
                <span className={reportStyles.totalValue}>{totals.sinceTotalCount}</span>
              </div>
            </div>
          </div>

          <div className={reportStyles.card}>
            <div className={reportStyles.cardTitle}>Dettaglio per cassa</div>
            {report.items.length === 0 ? (
              <p className={styles.empty}>Nessuna cassa registrata per questo evento.</p>
            ) : (
              <div className={reportStyles.tableWrap}>
                <table className={reportStyles.table}>
                  <thead>
                    <tr>
                      <th>Cassa</th>
                      <th>Stato</th>
                      <th>Aperta da</th>
                      <th className={reportStyles.num}>Fondo €</th>
                      <th className={reportStyles.num}>Fondo {report.currencyName}</th>
                      <th className={reportStyles.num}>Contenuto €</th>
                      <th className={reportStyles.num}>Contenuto {report.currencyName}</th>
                      <th className={reportStyles.num}>Transazioni</th>
                      <th className={styles.printHide}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((item) => (
                      <CassaRow key={item.id} item={item} onClose={setCloseTarget} />
                    ))}
                    <CassaRow
                      isTotal
                      item={{
                        id: '__tot',
                        name: 'TOTALE',
                        status: 'open',
                        openedByUserId: null,
                        openedByName: null,
                        openedAt: report.from ?? new Date().toISOString(),
                        closedAt: null,
                        cashFloat: { euro: totals.floatEuro, credits: totals.floatCredits, setAt: null },
                        topUp: 0, refund: 0, topUpCount: 0, refundCount: 0,
                        topUpReal: 0, refundReal: 0,
                        euroContent: totals.euroContent,
                        creditsContent: totals.creditsContent,
                        sinceTopUpCount: totals.sinceTopUpCount, sinceRefundCount: totals.sinceRefundCount,
                        sinceTotalCount: totals.sinceTotalCount,
                      }}
                    />
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.note}>
              «Fondo» è la dotazione iniziale impostata per la cassa; «Contenuto» è il valore attuale (fondo + incassi
              reali − rimborsi reali + movimenti cassa). Le «Transazioni» conteggiano solo i carichi e i rimborsi effettuati
              dalla cassa a partire da {report.from ? fmtDateTime(report.from) : "inizio evento"}
              {report.to ? ` fino a ${fmtDateTime(report.to)}` : ''}. Le casse chiuse restano visibili come storico in sola
              lettura.
            </p>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deliverTarget !== null}
        variant="confirm"
        title="Consegna alla postazione"
        message={
          deliverTarget
            ? `Indicare quanto consegnare alla cassa "${deliverTarget.cashRegisterName ?? ''}". Il contante/token entra nella cassa come movimento in carico.`
            : ''
        }
        confirmLabel="Consegna"
        confirmDisabled={
          busyRequest !== null ||
          (deliverTarget?.kind !== 'credits' && deliverEuro === '') ||
          (deliverTarget?.kind !== 'euro' && deliverTarget?.kind !== 'both' && deliverCredits === '')
        }
        onConfirm={() => void handleDeliverRequest()}
        onCancel={() => setDeliverTarget(null)}
      >
        <div className={styles.deliverGrid}>
          {deliverTarget?.kind !== 'credits' && (
            <label className={styles.deliverField}>
              Euro consegnati
              <input
                type="number"
                min="0"
                step="0.01"
                value={deliverEuro}
                onChange={(e) => setDeliverEuro(e.target.value)}
                placeholder="0.00"
              />
            </label>
          )}
          {deliverTarget?.kind !== 'euro' && (
            <label className={styles.deliverField}>
              {report.currencyName} consegnati
              <input
                type="number"
                min="0"
                step="1"
                value={deliverCredits}
                onChange={(e) => setDeliverCredits(e.target.value)}
                placeholder="0"
              />
            </label>
          )}
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={closeTarget !== null}
        variant="confirm"
        danger
        title="Chiudi cassa"
        message={
          closeTarget
            ? `Chiudere la cassa "${closeTarget.name}"? Non saranno più possibili operazioni su questa cassa: resterà visibile come storico in sola lettura.`
            : ''
        }
        confirmLabel="Chiudi cassa"
        onConfirm={() => void handleCloseCassa()}
        onCancel={() => setCloseTarget(null)}
      />

      <ConfirmModal
        open={resetAllOpen}
        variant="confirm"
        danger
        title="Azzera tutto il banco cambio"
        message={`Cosa verrà fatto, senza possibilità di annullare:
- chiuse TUTTE le casse dell'evento (anche quelle aperte) e azzera i loro fondi;
- cancella fisicamente tutte le transazioni di cambio (carichi e rimborsi);
- cancella i movimenti di cassa e le richieste delle postazioni;
- azzera a zero tutti i portafogli clienti dell'evento.

Restano invece invariati ordini e liquidazioni stand.`}
        confirmLabel="Azzera tutto"
        onConfirm={() => void handleResetAll()}
        onCancel={() => setResetAllOpen(false)}
      />
    </div>
  )
}
