/**
 * Stato temporale di un evento lato interfaccia.
 *
 * Esistono due copie diverse di questa logica (una per evento, una per data)
 * e cinque implementazioni sparpagliate tra le pagine: qui nasce l'unica
 * fonte, così la dashboard operatore, la home e la pagina di dettaglio non
 * possono dire cose diverse sullo stesso evento.
 *
 * `now` va catturato **una volta** dal chiamante (`useState(() => Date.now())`)
 * e passato dentro: il lint React vieta `Date.now()` nel corpo di render, e
 * un `now` che cambia a ogni render farebbe saltare i controlli mentre la
 * pagina è aperta.
 */

/** Fine giornata della data di fine, nel fuso del browser. */
export function endOfDay(date: string | null | undefined): Date | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(23, 59, 59, 999)
  return d
}

/** L'evento è iniziato? Stessa regola del backend (`utils/event-schedule.ts`). */
export function isEventStarted(startDate: string | null | undefined, now: number): boolean {
  if (!startDate) return true
  const start = new Date(startDate).getTime()
  if (Number.isNaN(start)) return true
  return start <= now
}

/** L'evento è terminato (fine giornata passata)? */
export function isEventFinished(endDate: string | null | undefined, now: number): boolean {
  const end = endOfDay(endDate)
  if (!end) return false
  return end.getTime() < now
}

/** L'evento è nel suo periodo di apertura, oggi compreso? */
export function isEventOngoing(
  event: { startDate?: string | null; endDate?: string | null } | null | undefined,
  now: number
): boolean {
  if (!event) return false
  return isEventStarted(event.startDate, now) && !isEventFinished(event.endDate, now)
}

/**
 * Testo del blocco: usato al posto di un semplice "nascosto", così l'operatore
 * capisce **perché** non vede i pulsanti invece di pensare che il software sia
 * rotto. Restituisce `null` quando l'evento è aperto e non va mostrato nulla.
 */
export function notStartedMessage(
  event: { startDate?: string | null; name?: string | null } | null | undefined,
  now: number
): string | null {
  if (!event || isEventStarted(event.startDate, now)) return null
  const start = new Date(event.startDate ?? '')
  const data = Number.isNaN(start.getTime())
    ? 'la data di inizio'
    : `il ${start.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`
  return `L'evento non è ancora iniziato: le operazioni si aprono da ${data}.`
}