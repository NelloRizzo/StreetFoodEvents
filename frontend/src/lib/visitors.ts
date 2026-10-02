import { apiRequest } from './api'

export type VisitorCategoryEstimate = {
  label: string
  quantity: number
  coefficient: number
  estimatedVisitors: number
  /** Quota dei crediti liquidati di QUESTO stand attribuita a questa
   *  categoria in proporzione al suo peso nel fatturato dello stand. */
  settledCredits: number
}

export type VisitorStandEstimate = {
  standId: string
  standName: string
  number: number | null
  hasOrders: boolean
  ordersCount: number
  distinctCustomers: number
  categories: VisitorCategoryEstimate[]
  estimatedVisitorsTotal: number
  /** Crediti guadagnati su tutto l'evento (non filtrato dalla finestra). */
  earnedCredits: number
  /** Crediti liquidati nella finestra. */
  settledCredits: number
}

/** Categoria a livello di EVENTO: come quella per stand, più il peso di
 *  sovrapposizione. */
export type VisitorCategoryPool = {
  label: string
  quantity: number
  coefficient: number
  /** `quantity * coefficient`, senza pesi. */
  estimatedVisitors: number
  /** Quota di carrelli che contengono questa categoria e nessun'altra. */
  soloQuota: number
  /** `1` per la categoria più grande, `soloQuota` per le altre. */
  weight: number
  weightedVisitors: number
}

/** Diagnostica della sovrapposizione fra categorie. */
export type VisitorOverlap = {
  /** Quota di carrelli con prodotti di almeno due categorie diverse. */
  multiCategoryBasketShare: number
  mixedBaskets: number
  totalBaskets: number
}

export type VisitorsEstimate = {
  eventId: string
  eventName: string
  currencyName: string
  currencySymbol: { url: string } | null
  exchangeRate: number
  window: { from: string; to: string }
  coefficientMap: Record<string, number>
  defaultCoefficient: number
  tokensPerVisitor: number
  overlap: VisitorOverlap
  totals: {
    /** Dai prodotti, con la sovrapposizione fra categorie già corretta. */
    productEstimated: number
    /** Stessa somma SENZA correzione: serve a misurare quanto vale la
     *  correzione, non è una quarta stima. */
    productEstimatedUnweighted: number
    tokenBasedEstimated: number
    /** DAI CREDITI LIQUIDATI. `null` se non è mai stata fatta una
     *  liquidazione: dato assente, non zero visitatori. */
    settlementBasedEstimated: number | null
    distinctTokenBuyers: number
    distinctOrderCustomers: number
    nonCancelledOrders: number
    netTokensSold: number
    settledCredits: number
    /** Crediti liquidati da stand che non hanno vendite nella finestra: senza
     *  il loro mix di vendita non sono attribuibili ad alcuna categoria. */
    unattributedSettledCredits: number
    earnedCredits: number
  }
  categories: VisitorCategoryPool[]
  stands: VisitorStandEstimate[]
}

export function fetchVisitorsEstimate(
  eventId: string,
  from?: string,
  to?: string,
  standId?: string,
) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (standId) params.set('standId', standId)
  const qs = params.toString()
  return apiRequest<VisitorsEstimate>(`/events/${eventId}/visitors${qs ? `?${qs}` : ''}`)
}