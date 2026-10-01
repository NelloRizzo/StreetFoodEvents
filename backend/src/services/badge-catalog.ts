/**
 * Tipi di badge e come si guadagnano.
 *
 * Unico posto dove vivono le condizioni: il backend le valuta, e le stesse
 * etichette/icone vengono spedite al frontend nella risposta, così non esiste
 * una seconda copia da tenere allineata.
 *
 * `target` è la soglia per il progresso mostrato in profilo (null = badge
 * "una tantum", non ha un conteggio da avvicinare).
 *
 * "Top Spender" del TODO iniziale è stato VOLUTO escluso: in un evento dove si
 * consumano token premiare chi spende di più è il messaggio sbagliato, e
 * invidia i visitatori. Al suo posto due badge che premiano la partecipazione
 * (Esploratore) e il gusto dell'evento (Nottefondista).
 */
export const BADGE_TYPES = [
    'first-order',
    'explorer',
    'night-owl',
    'photographer',
    'follower'
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];

export type BadgeDefinition = {
    type: BadgeType;
    label: string;
    icon: string;
    /** Frase mostrata in profilo quando il badge è stato ottenuto. */
    description: string;
    /** Frase mostrata quando non è ancora stato ottenuto. */
    lockedHint: string;
    /** Soglia per il progresso; null = senza conteggio. */
    target: number | null;
};

export const BADGE_CATALOG: Record<BadgeType, BadgeDefinition> = {
    'first-order': {
        type: 'first-order',
        label: 'Primo ordine',
        icon: '🧾',
        description: 'Hai ordinato per la prima volta',
        lockedHint: 'Ordina qualcosa',
        target: null
    },
    explorer: {
        type: 'explorer',
        label: 'Esploratore',
        icon: '🧭',
        description: 'Hai ordinato da stand di 3 eventi diversi',
        lockedHint: 'Ordina da stand diversi',
        target: 3
    },
    'night-owl': {
        type: 'night-owl',
        label: 'Nottefondista',
        icon: '🌙',
        description: 'Hai ordinato dopo le 22',
        lockedHint: 'Ordina dopo le 22',
        target: null
    },
    photographer: {
        type: 'photographer',
        label: 'Fotografo',
        icon: '📷',
        description: 'Hai caricato 3 foto',
        lockedHint: 'Carica delle foto',
        target: 3
    },
    follower: {
        type: 'follower',
        label: 'Seguace',
        icon: '💛',
        description: 'Hai un evento tra i preferiti e ne hai aggiunto un secondo',
        lockedHint: 'Aggiungi altri eventi ai preferiti',
        target: 2
    }
};

export const BADGE_LIST: BadgeDefinition[] = BADGE_TYPES.map((type) => BADGE_CATALOG[type]);
