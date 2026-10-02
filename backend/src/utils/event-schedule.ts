/**
 * Stato temporale di un evento: è iniziato? è terminato?
 *
 * Serve a bloccare le operazioni operative (cassa, contest, foto) quando
 * l'evento non è ancora iniziato: vendere token, scansionare POI o caricare
 * foto **prima** del via del evento produce dati che nessuno riesce a
 * riconciliare (ordini fuori dal periodo del report, foto di un evento che non
 * c'era ancora, partecipazioni al contest con QR già sparso).
 *
 * La regola è volutamente semplice: si confronta `now` con `Event.startDate`
 * come configurato. Il form admin usa `<input type="date">`, quindi `startDate`
 * è la mezzanotte UTC del primo giorno e il gate apre di fatto alle 02:00
 * locali su un evento italiano: **permissivo di poche ore**, e questo è il
 * lato giusto in cui sbagliare (un gate troppo stretto bloccherebbe la cassa
 * di un evento che è già aperto). Se un evento ha una data-orario esplicita,
 * il gate aspetta quell'ora precisa.
 *
 * Se in futuro servisse la mezzanotte **locale** dell'evento (cioè aprire alle
 * 00:00 di Roma e non alle 02:00), qui si passa per `Event.timezone`: non è
 * fatto adesso perché non ce n'è bisogno e l'offset IANA in JavaScript è una
 * fonte di bug.
 */
export function isEventStarted(
    event: { startDate?: Date | string | null } | null | undefined,
    now: Date = new Date()
): boolean {
    if (!event?.startDate) return true;
    const start = new Date(event.startDate);
    // Una data non valida non deve bloccare le operazioni: fallire aperto.
    if (Number.isNaN(start.getTime())) return true;
    return start.getTime() <= now.getTime();
}

/** Messaggio unico per il 409: l'operatore deve capire il perché, non leggere un errore generico. */
export const EVENT_NOT_STARTED_MESSAGE =
    'L\'evento non è ancora iniziato: le operazioni sono disponibili solo dal giorno di inizio.';

/**
 * Risposta standard del gate. `true` se si può procedere.
 *
 * `409 Conflict` e non `400`: non è una richiesta malformata, è uno stato
 * (l'evento non è ancora iniziato) che impedisce l'operazione.
 */
export function eventNotStartedResponse(res: { status: (code: number) => { json: (body: unknown) => unknown } }): boolean {
    res.status(409).json({ message: EVENT_NOT_STARTED_MESSAGE, code: 'event_not_started' });
    return false;
}

/** Controllo in linea: `if (!ensureEventStarted(event, res)) return;` */
export function ensureEventStarted(
    event: { startDate?: Date | string | null } | null | undefined,
    res: { status: (code: number) => { json: (body: unknown) => unknown } },
    now: Date = new Date()
): boolean {
    if (isEventStarted(event, now)) return true;
    return eventNotStartedResponse(res);
}
