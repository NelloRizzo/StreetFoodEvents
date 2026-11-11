import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '../lib/api'
import styles from './EventAnalyticsPage.module.scss'

type CompareVisitors = {
  productEstimated: number
  tokenBasedEstimated: number | null
  settlementBasedEstimated: number | null
}

type CompareFeeBand = { maxAmount: number; feePercent: number; feeFlat: number }

type CompareEvent = {
  eventId: string
  eventName: string
  currencyName: string
  exchangeRate: number
  feeBands?: CompareFeeBand[]
  window: { from: string; to: string }
  visitors?: CompareVisitors
  totals: {
    orders: number
    quantity: number
    revenue: number
    orderRevenue: number
    creditRevenue: number
    posRevenue: number
    cashRevenue: number
    avgOrderValue: number
    distinctCustomers: number
    giftOrders: number
    cancelledOrders: number
    prepOrders: number
    avgPrepSeconds: number | null
    settlements: {
      earnedCredits: number
      settledCredits: number
      payoutEuro: number
      feeEuro: number
      grossEuro: number
      remainingEarnedCredits: number
      standsNeverSettled: number
    }
  }
}

type EventOption = { id: string; name: string; startDate?: string }

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

function fmtEuro(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/* Se l'evento usa una moneta diversa dall'euro (ticket/crediti), aggiunge il
   corrispettivo in ticket tra parentesi. */
function isEuroCurrency(name: string | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return n === '' || n === 'euro' || n === 'eur' || n === '€';
}

function ticketSuffix(e: CompareEvent, credits: number): string {
  if (isEuroCurrency(e.currencyName)) return '';
  return ` (${fmt(credits)} ${e.currencyName})`;
}

/* Replica di resolveSettlementFee (backend) per calcolare il fee potenziale
   sul fatturato lordo dell'evento, usando le feeBands configurate. */
function resolveFeePotenziale(feeBands: CompareFeeBand[] | undefined, grossEuro: number): { feePercent: number; feeFlat: number } {
  const bands = Array.isArray(feeBands) ? feeBands : [];
  if (bands.length === 0) return { feePercent: 0, feeFlat: 0 };
  const capped = bands.filter((b) => (b.maxAmount ?? 0) > 0).sort((a, b) => (a.maxAmount ?? 0) - (b.maxAmount ?? 0));
  const residual = bands.find((b) => (b.maxAmount ?? 0) <= 0);
  const matching = capped.find((b) => grossEuro <= (b.maxAmount ?? 0)) ?? residual;
  if (!matching) return { feePercent: 0, feeFlat: 0 };
  return { feePercent: matching.feePercent ?? 0, feeFlat: matching.feeFlat ?? 0 };
}

function feePotenzialeEuro(e: CompareEvent, grossEuro: number): number {
  const { feePercent, feeFlat } = resolveFeePotenziale(e.feeBands, grossEuro);
  const fee = grossEuro * (feePercent / 100) + feeFlat;
  return Math.min(grossEuro, fee);
}

function fmtSeconds(seconds: number | null): string {
  if (seconds === null) return '—'
  const total = Math.round(seconds)
  if (total < 60) return `${total}"`
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${minutes}'` : `${minutes}'${rest}"`
}

export function EventComparePage() {
  const [events, setEvents] = useState<EventOption[]>([])
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [data, setData] = useState<CompareEvent[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void apiRequest<{ items?: EventOption[] } | EventOption[]>('/events')
      .then((res) => {
        if (cancelled) return
        const items = Array.isArray(res) ? res : (res.items ?? [])
        setEvents(items.map((e) => ({ id: (e as { id?: string; _id?: string }).id ?? (e as { _id?: string })._id ?? '', name: e.name, startDate: e.startDate })))
      })
      .catch(() => { if (!cancelled) setEvents([]) })
    return () => { cancelled = true }
  }, [])

  const compare = useCallback(async () => {
    if (!a || !b || a === b) {
      setError('Seleziona due eventi diversi.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiRequest<{ events: CompareEvent[] }>(`/events/compare?ids=${a},${b}`)
      const withVisitors = await Promise.all(res.events.map(async (e) => {
        try {
          const v = await apiRequest<{ totals: { productEstimated: number; tokenBasedEstimated: number | null; settlementBasedEstimated: number | null } }>(`/events/${e.eventId}/visitors`)
          return { ...e, visitors: { productEstimated: v.totals.productEstimated, tokenBasedEstimated: v.totals.tokenBasedEstimated, settlementBasedEstimated: v.totals.settlementBasedEstimated } }
        } catch {
          return e
        }
      }))
      setData(withVisitors)
    } catch {
      setError('Impossibile caricare il confronto.')
      setData(null)
    }
    setIsLoading(false)
  }, [a, b])

  const rows: { label: string; get: (e: CompareEvent) => string }[] = data
    ? [
        { label: 'Periodo', get: (e) => `${new Date(e.window.from).toLocaleDateString('it-IT')} – ${new Date(e.window.to).toLocaleDateString('it-IT')}` },
        { label: 'Fatturato', get: (e) => `${fmt(e.totals.revenue / (e.exchangeRate || 1))} €${ticketSuffix(e, e.totals.revenue)}` },
        { label: 'Fatturato da ordini', get: (e) => `${fmt(e.totals.orderRevenue / (e.exchangeRate || 1))} €${ticketSuffix(e, e.totals.orderRevenue)}` },
        { label: 'Fatturato da liquidazioni', get: (e) => `${fmt((e.totals.revenue - e.totals.orderRevenue) / (e.exchangeRate || 1))} €${ticketSuffix(e, e.totals.revenue - e.totals.orderRevenue)}` },
        { label: 'Ordini', get: (e) => String(e.totals.orders) },
        { label: 'Prodotti venduti', get: (e) => String(e.totals.quantity) },
        { label: 'Omaggi esclusi', get: (e) => String(e.totals.giftOrders) },
        { label: 'Annullati', get: (e) => String(e.totals.cancelledOrders) },
        { label: 'Clienti distinti', get: (e) => String(e.totals.distinctCustomers) },
        { label: 'Scontrino medio', get: (e) => `${fmt(e.totals.avgOrderValue / (e.exchangeRate || 1))} €${ticketSuffix(e, e.totals.avgOrderValue)}` },
        { label: 'Tempo medio prep.', get: (e) => fmtSeconds(e.totals.avgPrepSeconds) },
        { label: 'Ordini arrivati a pronto', get: (e) => String(e.totals.prepOrders) },
        { label: 'Crediti guadagnati', get: (e) => `${fmt(e.totals.settlements.earnedCredits / (e.exchangeRate || 1))} €${ticketSuffix(e, e.totals.settlements.earnedCredits)}` },
        { label: 'Crediti liquidati', get: (e) => `${fmt(e.totals.settlements.settledCredits / (e.exchangeRate || 1))} €${ticketSuffix(e, e.totals.settlements.settledCredits)}` },
        { label: 'Netto erogato', get: (e) => `${fmtEuro(e.totals.settlements.payoutEuro)} €` },
        { label: 'Trattenute (fee, reali)', get: (e) => `${fmtEuro(e.totals.settlements.feeEuro)} €` },
        { label: 'Trattenute (fee, potenziali)', get: (e) => {
            const grossEuro = e.totals.revenue / (e.exchangeRate || 1);
            return `${fmtEuro(feePotenzialeEuro(e, grossEuro))} €`;
          } },
        { label: 'Lordo liquidazioni', get: (e) => `${fmtEuro(e.totals.settlements.grossEuro)} €` },
        { label: 'Fatturato netto (dopo fee)', get: (e) => {
            const rate = e.exchangeRate || 1;
            const grossEuro = e.totals.revenue / rate;
            const fee = feePotenzialeEuro(e, grossEuro);
            const netEuro = grossEuro - fee;
            const netCredits = e.totals.revenue - fee * rate;
            const suffix = isEuroCurrency(e.currencyName) ? '' : ` (${fmt(netCredits)} ${e.currencyName})`;
            return `${fmtEuro(netEuro)} €${suffix}`;
          } },
        { label: 'Da liquidare', get: (e) => `${fmt(e.totals.settlements.remainingEarnedCredits / (e.exchangeRate || 1))} €${ticketSuffix(e, e.totals.settlements.remainingEarnedCredits)}` },
        { label: 'Stand mai liquidati', get: (e) => String(e.totals.settlements.standsNeverSettled) },
        { label: 'Stima visitatori (prodotti)', get: (e) => (e.visitors ? fmt(e.visitors.productEstimated) : '—') },
        { label: 'Stima visitatori (token)', get: (e) => (e.visitors && e.visitors.tokenBasedEstimated !== null ? fmt(e.visitors.tokenBasedEstimated) : '—') },
        { label: 'Stima visitatori (liquidazioni)', get: (e) => (e.visitors && e.visitors.settlementBasedEstimated !== null ? fmt(e.visitors.settlementBasedEstimated) : '—') },
      ]
    : []

  return (
    <div className={styles.page}>
      <div className="page-shell">
        <div className={styles.header}>
          <h1 className={styles.title}>Confronto eventi</h1>
          <div className={styles.headerActions}>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Evento A</label>
              <select value={a} onChange={(e) => setA(e.target.value)} className={styles.dateInput} aria-label="Evento A">
                <option value="">— seleziona —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.startDate
                      ? `${ev.name} — ${new Date(ev.startDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                      : ev.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.dateGroup}>
              <label className={styles.dateLabel}>Evento B</label>
              <select value={b} onChange={(e) => setB(e.target.value)} className={styles.dateInput} aria-label="Evento B">
                <option value="">— seleziona —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.startDate
                      ? `${ev.name} — ${new Date(ev.startDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                      : ev.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className={styles.secondaryBtn} onClick={compare} disabled={isLoading}>
              {isLoading ? 'Carico…' : 'Confronta'}
            </button>
          </div>
        </div>

        {error && <p className={styles.empty}>{error}</p>}

        {data && (
          <div className={styles.card}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Metrica</th>
                  {data.map((e) => <th key={e.eventId}>{e.eventName}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {data.map((e) => <td key={e.eventId} className={styles.num}>{row.get(e)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}