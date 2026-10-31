/* Classifica per numero di preferenze, condivisa fra il contest fotografico
 * (voti) e la galleria (mi piace): le regole degli ex aequo devono essere una
 * sola, altrimenti le due pagine mostrano medaglie diverse sugli stessi dati.
 *
 * Gli ex aequo condividono il gradino (1, 1, 2) e NON consumano il gradino
 * successivo: e' la lettura corretta di "primi tre" quando due foto hanno gli
 * stessi voti. Le foto senza preferenze non entrano in classifica, altrimenti
 * tutte le foto a zero risulterebbero prime. */
export type RankedCount = {
    photoId: string;
    count: number;
    rank: number;
};

export function rankByCount(
    counts: Map<string, number>,
    options: { maxRank?: number } = {}
): RankedCount[] {
    const rows = [...counts.entries()]
        .filter(([, count]) => count > 0)
        .map(([photoId, count]) => ({ photoId, count }))
        .sort((a, b) => b.count - a.count);

    const ranked: RankedCount[] = [];
    let currentRank = 1;
    let previousCount: number | null = null;

    for (const row of rows) {
        // il gradino avanza solo quando il numero di preferenze cambia
        if (previousCount !== null && row.count !== previousCount) currentRank++;
        if (options.maxRank !== undefined && currentRank > options.maxRank) break;
        ranked.push({ photoId: row.photoId, count: row.count, rank: currentRank });
        previousCount = row.count;
    }

    return ranked;
}
