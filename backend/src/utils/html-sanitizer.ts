import sanitizeHtml from 'sanitize-html';

const allowedTags = [
    'p', 'br', 'strong', 'em', 'u', 's', 'mark',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a',
    'img'
];

const allowedAttributes: Record<string, string[]> = {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height']
};

export function sanitizeHtmlContent(input: string | undefined | null): string | null {
    if (input === undefined || input === null || input === '') {
        return null;
    }

    return sanitizeHtml(input, {
        allowedTags,
        allowedAttributes,
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedSchemesAppliedToAttributes: ['href', 'src'],
        disallowedTagsMode: 'discard'
    });
}

/* Contenuto del blog.
 *
 * Oltre a ripulire l'HTML, FORZA su ogni <a> l'apertura in una nuova scheda
 * (target=_blank) con rel="noopener noreferrer".
 *
 * Il forza e' deliberato, non un semplice default dell'editor: l'estensione
 * Link di TipTap gia' imposta target/rel quando si crea un link dalla
 * toolbar, ma il contenuto puo' arrivare anche incollato, da una bozza
 * precedente, o modificato via API. Senza questo transformTags un link
 * "sfuggito" resterebbe same-tab contro la specifica del blog. Inoltre
 * _blank senza nooperson lascia la nuova scheda con window.opener
 * raggiungibile (tabnabbing), e nofollow evita di passare juice ai link
 * esterni partendo dal dominio della piattaforma.
 */
export function sanitizeBlogHtml(input: string | undefined | null): string | null {
    if (input === undefined || input === null || input === '') {
        return null;
    }

    return sanitizeHtml(input, {
        allowedTags,
        allowedAttributes,
        allowedSchemes: ['http', 'https', 'mailto'],
        allowedSchemesAppliedToAttributes: ['href', 'src'],
        disallowedTagsMode: 'discard',
        transformTags: {
            // attributs sono gli attributi GIA' filtrati dallo schema whitelist:
            // ignorando il target in ingresso non si puo' disattivare il blank.
            a: (_tagName, attribs) => ({
                tagName: 'a',
                attribs: {
                    ...attribs,
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow'
                }
            })
        }
    });
}
