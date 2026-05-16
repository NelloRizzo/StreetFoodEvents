import sanitizeHtml from 'sanitize-html';

const allowedTags = [
    'p', 'br', 'strong', 'em', 'u', 's',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a'
];

const allowedAttributes: Record<string, string[]> = {
    a: ['href', 'target', 'rel']
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
