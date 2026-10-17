/**
 * Segmento di uno stand nei link brevi: il nome ripulito di tutto cio' che in
 * un URL non serve e non si puo' scrivere.
 *
 *  **Gemella di `standAliasFromName` in `frontend/src/lib/socialMenu.ts`.**
 *  Lo shortlink dello stand non viene creato a mano: si compone con l'alias
 *  dell'evento piu' il nome dello stand. La composizione avviene in due posti
 *  (il frontend che scrive il link nel post e nel QR, e il server che lo
 *  risolve quando qualcuno lo apre), e le due implementazioni devono produrre
 *  la stessa stringa: se divergono, uno shortlink condiviso non si risolve.
 *  I due package non hanno un modulo comune, quindi la regola e' duplicata e
 *  va tenuta allineata a mano.
 *
 *  La regola e' quella di `fileSlug` del frontend, che ripulisce i nomi dei
 *  file con la stessa logica: via gli accenti, ogni carattere non
 *  `[a-zA-Z0-9_-]` diventa un trattino, niente trattini alle estremita'. Il
 *  segnaposto vuoto ('senza-nome') qui vale stringa vuota: un alias con quel
 *  nome sarebbe un alias falso, meglio restare sul link lungo.
 */
export function standAliasFromName(name: string | null | undefined): string {
    const ascii = (name ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const slug = (ascii || 'senza-nome').toLowerCase();
    return slug === 'senza-nome' ? '' : slug;
}
