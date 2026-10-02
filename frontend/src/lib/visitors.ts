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

/** Da dove arriva il mix di categorie con cui sono ripartiti i crediti
 *  liquidati: `stand` = fatturato di quel banco, `event` = percentuale globale
 *  dell'evento (stand senza ordini nella finestra). */
export type VisitorsMixSource = 'stand' | 'event'

export type VisitorStandEstimate = {
  standId: string
  standName: string
  number: number | null
  hasOrders: boolean
  ordersCount: number
  distinctCustomers: number
  categories: VisitorCategoryEstimate[]
  /** Da quale mix sono ripartiti i crediti liquidati nelle categorie. */
  categoriesMix: VisitorsMixSource | null
  /** Base del numero in `estimatedVisitorsTotal`: `orders` = quantità per
   *  categoria, `settlements` = dedotto dal fatturato liquidato, `null` = nessuna
   *  delle due (stand fermo). */
  estimationBasis: 'orders' | 'settlements' | null
  /** Fatturato della finestra. Con ordini è la somma delle righe; senza ordini
   *  è il dato liquidato, che è l'unico fatturato attestato per quel banco. */
  revenue: number
  revenueSource: 'orders' | 'settlements' | null
  /** Visitatori dedotti dal fatturato liquidato (solo stand senza ordini). */
  estimatedVisitorsFromSettlements: number | null
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
     *  il loro mix di vendita proprio sono ripartiti sulle percentuali
     *  globali dell'evento, e restano non attribuibili solo se l'evento non ha
     *  vendite da cui prendere quelle percentuali. */
    unattributedSettledCredits: number
    earnedCredits: number
    /** Stand senza ordini nella finestra, con fatturato liquidato. */
    settlementOnlyStands: number
    /** Fatturato dei soli stand senza ordini (è il dato liquidato). */
    settlementOnlyRevenue: number
    /** Visitatori dedotti per quegli stand. */
    settlementOnlyEstimatedVisitors: number
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