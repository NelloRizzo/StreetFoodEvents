const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnly(raw: string | undefined): boolean {
    return raw !== undefined && DATE_ONLY_RE.test(raw);
}

export type DateWindow = { from: Date; to: Date };

/**
 * Finestra temporale di default = periodo dell'evento, con `from`/`to` come
 * override. Un `to` "date-only" (o assente) viene portato a fine giornata:
 * altrimenti un report senza `to` escluderebbe gli ordini del giorno stesso.
 *
 * Estratto da `getVisitorEstimate` perché ora serve anche alle analisi: due
 * copie di questa logica divergono (una con un fix, l'altra no) e i due report
 * devono concordare sullo stesso periodo.
 */
export function resolveDateWindow(
    event: { startDate: Date; endDate: Date },
    fromRaw: string | undefined,
    toRaw: string | undefined
): DateWindow {
    const parsedFrom = fromRaw && !Number.isNaN(new Date(fromRaw).getTime()) ? new Date(fromRaw) : null;
    const parsedTo = toRaw && !Number.isNaN(new Date(toRaw).getTime()) ? new Date(toRaw) : null;

    const from: Date = parsedFrom ?? (event.startDate ? new Date(event.startDate) : new Date(0));
    const to: Date = parsedTo ?? new Date(event.endDate.getTime());

    if (!parsedTo || isDateOnly(toRaw)) {
        to.setHours(23, 59, 59, 999);
    }

    return { from, to };
}

export { isDateOnly };