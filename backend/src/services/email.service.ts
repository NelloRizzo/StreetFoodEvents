import { setDefaultResultOrder } from 'node:dns';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

setDefaultResultOrder('ipv4first');

export function isSmtpConfigured(): boolean {
    return !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
}

function getTransporter() {
    if (!isSmtpConfigured()) {
        return null;
    }
    return nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
    });
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
    const transporter = getTransporter();
    if (!transporter) {
        throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.');
    }

    const from = env.SMTP_FROM ?? env.SMTP_USER;
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

    await Promise.race([
        transporter.sendMail({
            from: `"Street Food Events" <${from}>`,
            to,
            subject,
            html,
        }),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Invio email timeout dopo 15 secondi')), 15_000)
        ),
    ]);
}
