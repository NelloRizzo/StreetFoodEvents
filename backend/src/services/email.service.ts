import { setDefaultResultOrder } from 'node:dns';
import { env } from '../config/env';

setDefaultResultOrder('ipv4first');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export function isEmailConfigured(): boolean {
    return !!env.BREVO_API_KEY;
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function buildMessage(eventName?: string, eventLocation?: string): string {
    const template = env.EMAIL_MESSAGE_TEMPLATE
        ?? 'Questa è la foto che hai scelto durante la manifestazione {EVENT_NAME} svoltasi a {EVENT_LOCATION} il {CURRENT_DATE}.';

    return template
        .replace(/\{EVENT_NAME\}/g, eventName ?? '')
        .replace(/\{EVENT_LOCATION\}/g, eventLocation ?? '')
        .replace(/\{CURRENT_DATE\}/g, formatDate(new Date()));
}

function buildPhotosHtml(photoUrls: string[]): string {
    if (photoUrls.length === 1) {
        const url = photoUrls[0];
        return `
            <a href="${url}" style="
                display: inline-block;
                padding: 0.75rem 1.5rem;
                margin: 1rem 0;
                background: #e67e22;
                color: #fff;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
            ">Visualizza foto</a>
            <br />
            <img src="${url}" alt="Foto" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;" />
        `;
    }

    return photoUrls
        .map(
            (url) => `
            <a href="${url}" target="_blank" style="display: block; margin-top: 1rem;">
                <img src="${url}" alt="Foto" style="max-width: 100%; border-radius: 8px; display: block;" />
            </a>`
        )
        .join('');
}

export async function sendPhotosEmail(
    to: string,
    photoUrls: string[],
    eventName?: string,
    eventLocation?: string
): Promise<void> {
    if (!isEmailConfigured()) {
        throw new Error('Brevo non configurato. Imposta BREVO_API_KEY.');
    }

    if (photoUrls.length === 0) {
        throw new Error('Nessuna foto da inviare');
    }

    const from = env.EMAIL_FROM ?? 'noreply@streetfoodevents.com';
    const isPlural = photoUrls.length > 1;
    const subject = eventName
        ? (isPlural ? `Le tue foto — ${eventName}` : `La tua foto — ${eventName}`)
        : (isPlural ? 'Le tue foto dall\'evento' : 'La tua foto dall\'evento');

    const message = buildMessage(eventName, eventLocation);
    const title = isPlural
        ? (eventName ? `Le tue foto da ${eventName}` : 'Le tue foto')
        : (eventName ? `La tua foto da ${eventName}` : 'La tua foto');

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
            <h1 style="color: #333;">${title}</h1>
            <p style="color: #444; font-size: 1.05rem; line-height: 1.6;">
                ${message}
            </p>
            ${buildPhotosHtml(photoUrls)}
        </div>
    `;

    const res = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
            'api-key': env.BREVO_API_KEY!,
            'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
            sender: { email: from, name: 'Street Food Events' },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Brevo error ${res.status}: ${body}`);
    }
}

export async function sendPhotoEmail(to: string, photoUrl: string, eventName?: string, eventLocation?: string): Promise<void> {
    return sendPhotosEmail(to, [photoUrl], eventName, eventLocation);
}

function buildEmailHtml(title: string, bodyHtml: string): string {
    return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
            <h1 style="color: #333;">${title}</h1>
            ${bodyHtml}
        </div>
    `;
}

async function sendBrevoEmail(to: string, subject: string, html: string): Promise<void> {
    if (!isEmailConfigured()) {
        throw new Error('Brevo non configurato. Imposta BREVO_API_KEY.');
    }

    const from = env.EMAIL_FROM ?? 'noreply@streetfoodevents.com';

    const res = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
            'api-key': env.BREVO_API_KEY!,
            'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
            sender: { email: from, name: 'Street Food Events' },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Brevo error ${res.status}: ${body}`);
    }
}

export async function sendActivationEmail(
    to: string,
    firstName: string,
    activationUrl: string
): Promise<void> {
    const html = buildEmailHtml(
        `Benvenuto${firstName ? `, ${firstName}` : ''}!`,
        `
        <p style="color: #444; font-size: 1.05rem; line-height: 1.6;">
            È stato creato un account per te su Street Food Events.
            Per attivarlo e scegliere la tua password personale, clicca sul pulsante qui sotto:
        </p>
        <a href="${activationUrl}" style="
            display: inline-block;
            padding: 0.75rem 1.5rem;
            margin: 1rem 0;
            background: #e67e22;
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
        ">Attiva il tuo account</a>
        <p style="color: #888; font-size: 0.9rem;">
            Se il pulsante non funziona, copia e incolla questo link nel browser:<br />
            <a href="${activationUrl}">${activationUrl}</a>
        </p>
        <p style="color: #888; font-size: 0.85rem;">
            Il link è valido per 7 giorni. Se non hai richiesto questo account, ignora questa email.
        </p>
        `
    );

    return sendBrevoEmail(to, 'Attiva il tuo account — Street Food Events', html);
}
