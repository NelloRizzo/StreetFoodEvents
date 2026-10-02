import { apiRequest } from './api'

export type AnalyticsHourBucket = {
  /** Inizio del bucket in ora UTC, serializzato ISO. */
  bucketStart: string
  orders: number
  quantity: number
  /** Fatturato in crediti dell'evento. */
  revenue: number
}

export type AnalyticsTopProduct = {
  eventProductId: string
  productName: string
  standId: string
  standName: string
  number: number | null
  quantity: number
  revenue: number
}

export type AnalyticsPrepBucket = {
  label: string
  count: number
}

/** Totali delle liquidazioni stand nella finestra. */
export type AnalyticsSettlementTotals = {
  /** Crediti guadagnati dagli stand su TUTTO l'evento (non filtrato). */
  earnedCredits: number
  /** Crediti liquidati nella finestra. */
  settledCredits: number
  /** Lordo in euro delle liquidazioni. */
  settledEuro: number
  /** Crediti caricati al banco con DARE (carico crediti allo stand). */
  loadedCredits: number
  grossEuro: number
  feeEuro: number
  payoutEuro: number
  /** Caricati e non ancora liquidati: segnale di chiusura mancante. */
  toReturnCredits: number
  /** Guadagnati e non ancora liquidati: il residuo da corrispondere. */
  remainingEarnedCredits: number
  settlementCount: number
  loadCount: number
  /** Stand che hanno guadagnato crediti ma non hanno MAI ricevuto una
   *  liquidazione (controllo su tutto l'evento, non solo la finestra). */
  standsNeverSettled: number
}

/**
 * Resoconto dei token della moneta evento.
 *
 * `period` è filtrato dalla finestra e riguarda i soli ordini; `snapshot` è
 * uno stato istantaneo e NON è filtrabile per data (per costruzione).
 */
export type AnalyticsTokenLedger = {
  period: {
    loaded: number
    cashRefunded: number
    orderRefunded: number
    netLoaded: number
    spent: number
    spentShareOfNetLoaded: number | null
    /** Caricati nel periodo e ancora non spesi: NON è il saldo dei portafogli. */
    remaining: number
  }
  snapshot: {
    /** Somme dei saldi di tutti i portafogli dell'evento. */
    inCirculation: number
    netFromTransactions: number
    /** `inCirculation - netFromTransactions`: se non è 0 va segnalato, non nascosto. */
    gap: number
    /** Token fisicamente nelle casse (fondo - carichi + rimborsi + movimenti). */
    inCash: number
    cashRegisterCount: number
    registerFloats: number
    legacyFloat: number
    movementsIn: number
    movementsOut: number
  }
}

export type AnalyticsTokenProduct = {
  eventProductId: string
  productName: string
  standName: string
  /** Token attribuiti al prodoto ripartendo `creditAmountUsed` sul `subtotal`. */
  tokens: number
  /** Quota sul totale speso nella finestra. */
  share: number
  quantity: number
}

export type AnalyticsStandRow = {
  standId: string
  standName: string
  number: number | null
  /** null se lo stand non ha una posizione per questo evento. */
  location: { lat: number; lng: number } | null
  orders: number
  quantity: number
  revenue: number
  creditRevenue: number
  posRevenue: number
  cashRevenue: number
  prepOrders: number
  /** Secondi; null se nessun ordine di questo stand è arrivato a "pronto". */
  avgPrepSeconds: number | null
  /** Crediti guadagnati su tutto l'evento, non filtrato dalla finestra. */
  earnedCredits: number
  settledCredits: number
  settledEuro: number
  loadedCredits: number
  grossEuro: number
  feeEuro: number
  payoutEuro: number
  toReturnCredits: number
  remainingEarnedCredits: number
  settlementCount: number
  loadCount: number
  /** Liquidazioni su tutto l'evento, anche fuori finestra. */
  settlementCountAllTime: number
  lastSettlementAt: string | null
  /** Ha venduto ma non è mai stato liquidato: la riga va segnalata. */
  neverSettled: boolean
}

export type EventAnalytics = {
  eventId: string
  eventName: string
  currencyName: string
  currencySymbol: { url: string; publicId: string } | null
  exchangeRate: number
  window: { from: string; to: string }
  totals: {
    orders: number
    quantity: number
    revenue: number
    creditRevenue: number
    posRevenue: number
    cashRevenue: number
    avgOrderValue: number
    distinctCustomers: number
    giftOrders: number
    prepOrders: number
    avgPrepSeconds: number | null
    settlements: AnalyticsSettlementTotals
  }
  hourly: AnalyticsHourBucket[]
  topProducts: AnalyticsTopProduct[]
  prepBuckets: AnalyticsPrepBucket[]
  byStand: AnalyticsStandRow[]
  tokens: AnalyticsTokenLedger
  tokensByProduct: AnalyticsTokenProduct[]
}

export function fetchEventAnalytics(
  eventId: string,
  from?: string,
  to?: string,
  standId?: string,
): Promise<EventAnalytics> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (standId) params.set('standId', standId)
  const qs = params.toString()
  return apiRequest<EventAnalytics>(`/events/${eventId}/analytics${qs ? `?${qs}` : ''}`)
}

/**
 * Etichetta oraria in ora LOCALE.
 *
 * Il backend allinea i bucket sull'ora UTC e restituisce `bucketStart`: è il
 * frontend che lo converte, perché l'operatore sta sul fuso dell'evento. Se il
 * backend raggruppassasse per `$hour` e rimandasse un numero 0-23, la
 * distribuzione sarebbe spostata di due ore su un evento italiano.
 */
export function formatHourLabel(bucketStart: string): string {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })
    .format(new Date(bucketStart))
}

/** Etichetta dell'ora in forma compatta ("18:00"), per le barre accorpate. */
export function hourKeyOf(bucketStart: string): number {
  return new Date(bucketStart).getHours()
}

export function formatHourKey(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/**
 * Giorno locale del bucket in chiave `YYYY-MM-DD`.
 *
 * I bucket arrivano dal backend allineati sull'ora **UTC** e sono uno per
 * ogni ora di ogni giorno: su una finestra di tre giorni arrivano tre bucket
 * con la stessa etichetta "18:00". Per poterli accorpare o separare serve
 * sapere a quale giorno appartiene ciascuno, e il riferimento è l'ora locale
 * del browser (la stessa usata da `formatHourLabel`).
 */
export function localDayKey(bucketStart: string): string {
  const d = new Date(bucketStart)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Etichetta leggibile del giorno ("1 ott"). */
export function formatDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })
    .format(new Date(y, m - 1, d))
}

/**
 * Accorpa i bucket orari per **ora del giorno**, sommando i giorni.
 *
 * Serve a non stampare N barre con la stessa etichetta: su un evento di tre
 * giorni l'ora 18:00 compare tre volte e senza accorpamento il grafico
 * ripete la stessa fascia. Sommando, l'operatore legge il profilo orario
 * dell'evento ("a che ora si vende di più"), che è la domanda che il
 * grafico deve rispondere; per il dettaglio di un singono giorno si filtra
 * prima con `dayKey`.
 *
 * L'ordine è quello delle ore presenti (0-23), quindi le fasce vuote non
 * vengono inventate: si vede solo ciò che è stato effettivamente venduto.
 */
export function aggregateHourlyByHour(buckets: AnalyticsHourBucket[]): (AnalyticsHourBucket & { hour: number })[] {
  const byHour = new Map<number, AnalyticsHourBucket & { hour: number }>()
  for (const bucket of buckets) {
    const hour = hourKeyOf(bucket.bucketStart)
    const current = byHour.get(hour)
    if (!current) {
      byHour.set(hour, { ...bucket, hour })
      continue
    }
    current.orders += bucket.orders
    current.quantity += bucket.quantity
    current.revenue += bucket.revenue
  }
  return [...byHour.values()].sort((a, b) => a.hour - b.hour)
}

/** Tiene solo i bucket di un giorno locale (`dayKey`), o tutti se `null`. */
export function filterBucketsByDay(buckets: AnalyticsHourBucket[], dayKey: string | null): AnalyticsHourBucket[] {
  if (!dayKey) return buckets
  return buckets.filter((bucket) => localDayKey(bucket.bucketStart) === dayKey)
}

/**
 * Giorni presenti nei bucket, in ordine.
 *
 * Vengono ricavati dai bucket e non dalla finestra `from`/`to`: un giorno
 * senza ordini non produce alcun bucket, quindi elencarlo sarebbe
 * promettere dati che il backend non ha. La barra "Nessun ordine nel
 * periodo" copre già il caso di un filtro su un giorno vuoto.
 */
export function listBucketDays(buckets: AnalyticsHourBucket[]): string[] {
  const days = new Set(buckets.map((bucket) => localDayKey(bucket.bucketStart)))
  return [...days].sort()
}

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`
}