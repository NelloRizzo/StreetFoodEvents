import { describe, expect, it } from 'vitest';

import { standAliasFromName } from '../../utils/alias-slug';

/* Gemella di `standAliasFromName` in `frontend/src/lib/socialMenu.ts`: i due
 * package devono produrre la stessa stringa, altrimenti uno shortlink composto
 * dal frontend non si risolve sul server. I casi qui sono gli stessi del test
 * del frontend, cosi' una divergenza fa fallire da tutte e due le parti. */
describe('standAliasFromName', () => {
    it('ripulisce il nome in qualcosa che si puo\' scrivere in un URL', () => {
        expect(standAliasFromName("Panino d'Oro")).toBe('panino-d-oro');
        expect(standAliasFromName('Caffè & Piadè')).toBe('caffe-piade');
        expect(standAliasFromName('  Porchetta  e  Brasato  ')).toBe('porchetta-e-brasato');
    });

    /* Un alias col nome di segnaposto sarebbe un alias falso: meglio il link
       lungo, cosi' il campo non propone niente di sbagliato. */
    it('un nome senza nulla di scrivibile non produce un alias', () => {
        expect(standAliasFromName('…')).toBe('');
        expect(standAliasFromName('')).toBe('');
        expect(standAliasFromName(null)).toBe('');
        expect(standAliasFromName(undefined)).toBe('');
    });

    it('il risultato e\' sempre ammesso dal validatore degli alias', () => {
        for (const name of ["Panino d'Oro", 'Caffè & Piadè', '数字 123', 'A-B_C']) {
            expect(standAliasFromName(name)).toMatch(/^[a-z0-9_-]*$/);
        }
    });
});
