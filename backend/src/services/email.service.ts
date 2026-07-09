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

export async function sendPhotoEmail(to: string, photoUrl: string, eventName?: string, eventLocation?: string): Promise<void> {
    if (!isEmailConfigured()) {
        throw new Error('Brevo non configurato. Imposta BREVO_API_KEY.');
    }

    const from = env.EMAIL_FROM ?? 'noreply@streetfoodevents.com';
    const subject = eventName
        ? `La tua foto — ${eventName}`
        : 'La tua foto dall\'evento';

    const message = buildMessage(eventName, eventLocation);

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
            <h1 style="color: #333;">${eventName ? `La tua foto da ${eventName}` : 'La tua foto'}</h1>
            <p style="color: #444; font-size: 1.05rem; line-height: 1.6;">
                ${message}
            </p>
            <a href="${photoUrl}" style="
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
            <img src="${photoUrl}" alt="Foto" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;" />
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
