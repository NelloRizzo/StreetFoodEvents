import * as crypto from 'node:crypto';
import { Types } from 'mongoose';

import { sanitizeHtmlContent } from '../utils/html-sanitizer';
import { AdhesionFormModel, type AdhesionForm, type AdhesionFormSection } from '../models/adhesion-form.model';
import { EventModel, type Event } from '../models/event.model';

const GUIDED_SLUGS = ['event-header', 'currency', 'fees'] as const;

export interface AdhesionSectionInput {
    slug: string;
    title: string;
    content: string;
}

export interface GeneratedSection extends AdhesionSectionInput {
    generatedFrom: string | null;
}

export interface AdhesionFormResponse {
    id: string;
    eventId: string;
    sections: Array<{
        slug: string;
        title: string;
        content: string;
        generatedFrom: string | null;
    }>;
    eventFingerprint: string | null;
    generatedAt: string | null;
    stale: boolean;
    createdAt: string;
    updatedAt: string;
}

export function isBareCurrencySymbol(name: string | undefined | null): boolean {
    if (!name) return false;
    return /^[^\p{L}\p{N}]$/u.test(name.trim());
}

function esc(s: string | undefined | null): string {
    return (s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(d: Date | string | undefined | null): string {
    if (!d) return '__/__/____';
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return '__/__/____';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
}

export function computeEventFingerprint(event: Event): string {
    const location = (event.location ?? {}) as { label?: string | null; city?: string | null; addressLine1?: string | null };
    const payload = {
        name: event.name,
        locationLabel: location.label ?? null,
        locationCity: location.city ?? null,
        locationAddressLine1: location.addressLine1 ?? null,
        startDate: event.startDate instanceof Date ? event.startDate.toISOString() : String(event.startDate),
        endDate: event.endDate instanceof Date ? event.endDate.toISOString() : String(event.endDate),
        currencyName: event.currencyName ?? null,
        currencySymbolUrl: (event.currencySymbol as { url?: string } | null)?.url ?? null,
        exchangeRate: event.exchangeRate ?? null,
        feeBands: (event.feeBands ?? []).map((b) => ({
            maxAmount: b.maxAmount,
            feePercent: b.feePercent,
            feeFlat: b.feeFlat
        }))
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function headerSection(event: Event): GeneratedSection {
    const location = (event.location ?? {}) as {
        label?: string | null;
        city?: string | null;
        addressLine1?: string | null;
    };
    const place = [location.addressLine1, location.label, location.city].filter(Boolean).join(', ');

    return {
        slug: 'event-header',
        title: 'Manifestazione (evento)',
        generatedFrom: 'event-header',
        content: [
            `<p><strong>Manifestazione (evento):</strong> ${esc(event.name)}</p>`,
            `<p><strong>Luogo:</strong> ${esc(place) || '_________________________________'}</p>`,
            `<p><strong>Data evento:</strong> dal ${formatDate(event.startDate)} al ${formatDate(event.endDate)}</p>`
        ].join('')
    };
}

function circledInitial(text: string): string {
    const ch = (text ?? '').trim().charAt(0).toUpperCase();
    const code = ch.charCodeAt(0);
    if (code >= 0x41 && code <= 0x5a) {
        return String.fromCharCode(0x24b6 + (code - 0x41));
    }
    return `(${ch})`;
}

function currencySection(event: Event): GeneratedSection {
    const bare = isBareCurrencySymbol(event.currencyName);
    const customName = bare ? null : (event.currencyName?.trim() || null);
    const symbolUrl = (event.currencySymbol as { url?: string } | null)?.url ?? null;

    const badge = customName
        ? symbolUrl
            ? `<img src="${esc(symbolUrl)}" alt="moneta ${esc(customName)}" width="72" />`
            : `<strong>${circledInitial(customName)}</strong>`
        : '';

    const highlightedName = customName ? `<mark><strong>${esc(customName)}</strong></mark>` : '';
    const rateUnit = customName ? esc(customName) : 'crediti';

    const body = customName
        ? [
            `<p>L'evento utilizza una <strong>moneta custom</strong> rappresentata dal seguente <strong>logo</strong>:</p>`,
            `<p>${badge} ${highlightedName}</p>`,
            `<p>I prezzi del menu e i pagamenti dei clienti sono espressi in ${highlightedName}: cambio <strong>1 \u20AC = ${Number(event.exchangeRate ?? 1)} ${rateUnit}</strong>. Il sottoscritto ne <strong>prende atto e accetta</strong> l'utilizzo di tale moneta.</p>`
        ].join('')
        : `<p>L'evento non prevede moneta custom (pagamenti in euro).</p>`;

    return {
        slug: 'currency',
        title: 'Sezione D — Moneta dell\u2019evento',
        generatedFrom: 'currency',
        content: [
            body,
            `<p><strong>Accettazione moneta custom (firma):</strong> ______________________</p>`,
            `<p><strong>Data:</strong> ____ / ____ / ________</p>`
        ].join('')
    };
}

function feesSection(event: Event): GeneratedSection {
    const bands = Array.isArray(event.feeBands) ? event.feeBands : [];
    const content = bands.length === 0
        ? `<p>Non sono previste <strong>commissioni sugli incassi</strong>: la partecipazione non prevede trattenute percentuali o fisse sulle vendite dello stand.</p>`
        : bands
            .slice()
            .sort((a, b) => Number(a.maxAmount) - Number(b.maxAmount))
            .map((b, idx) => {
                const parts = [
                    `fino a ${Number(b.maxAmount)} \u20AC lordi`
                ];
                const extras: string[] = [];
                if (Number(b.feePercent) > 0) extras.push(`${Number(b.feePercent)}%`);
                if (Number(b.feeFlat) > 0) extras.push(`${Number(b.feeFlat)} \u20AC quota fissa`);
                const condition = extras.length > 0 ? extras.join(' e ') : 'nessuna commissione';
                return `<li><strong>Fascia ${idx + 1}:</strong> incassi ${parts[0]} \u2014 ${condition}.</li>`;
            })
            .join('');

    const body = bands.length === 0
        ? `<p>L'evento non prevede commissioni sugli incassi.</p>`
        : `<p>L'organizzatore applica una <strong>commissione sugli incassi</strong> dello stand secondo le fasce seguenti, determinate nella definizione dell'evento.</p><ul>${content}</ul>`;

    return {
        slug: 'fees',
        title: 'Sezione F — Commissioni sugli incassi',
        generatedFrom: 'fees',
        content: [
            body,
            `<p><strong>Accettazione commissioni (firma):</strong> ______________________</p>`,
            `<p><strong>Data:</strong> ____ / ____ / ________</p>`
        ].join('')
    };
}

function staticSections(): GeneratedSection[] {
    return [
        {
            slug: 'stand-data',
            title: 'Sezione A — Dati dello stand',
            generatedFrom: null,
            content: [
                `<p><strong>Nome dello stand</strong> (obbligatorio): _________________________________________</p>`,
                `<p><strong>Banner dello stand</strong> (consigliato, dimensioni <strong>1080 \u00D7 220</strong>): \u2610 allegato&nbsp;&nbsp;\u2610 non allegato</p>`,
                `<p><strong>Logo dello stand</strong> (consigliato): \u2610 allegato&nbsp;&nbsp;\u2610 non allegato</p>`,
                `<p>Descrizione / slogan: _________________________________________</p>`,
                `<p>Tipologia: \u2610 Food &amp; Beverage&nbsp;&nbsp;\u2610 Artigianato&nbsp;&nbsp;\u2610 Divertimento</p>`,
                `<p>Referente (gestore): _________________________________________</p>`,
                `<p>Email referente: _________________________________________</p>`,
                `<p>Telefono referente: _________________________________________</p>`
            ].join('')
        },
        {
            slug: 'products',
            title: 'Sezione B — Prodotti in vendita',
            generatedFrom: null,
            content: [
                `<p>Per ogni prodotto: prezzo (obbligatorio) e foto (consigliata). Barrare se si allega la foto.</p>`,
                ...Array.from({ length: 8 }, (_, i) => `<p><strong>${i + 1}.</strong> _________________ &mdash; Prezzo: _______ &mdash; Foto: \u2610 &mdash; Ingredienti: _________________ &mdash; Allergeni (14 obbligatori Reg. CE 1169/2011): _________________</p>`),
                `<p>Se lo spazio non basta, allegare elenco separato firmato nelle note.</p>`
            ].join('')
        },
        {
            slug: 'haccp',
            title: 'Sezione C — Requisiti HACCP',
            generatedFrom: null,
            content: [
                `<p>Il sottoscritto dichiara di essere in possesso dei seguenti requisiti (barrare):</p>`,
                `<ul>`,
                `<li>\u2610 Applicazione del sistema di autocontrollo HACCP conforme al Reg. CE 852/2004</li>`,
                `<li>\u2610 Personale addetto formato in materia di igiene degli alimenti (attestato)</li>`,
                `<li>\u2610 Rintracciabilità e corretta conservazione dei prodotti (catena del freddo)</li>`,
                `<li>\u2610 Attrezzature conformi e procedure di pulizia e sanificazione</li>`,
                `<li>\u2610 Menu/elenco allergeni aggiornato e disponibile al punto vendita</li>`,
                `<li>\u2610 Copertura assicurativa RC verso terzi (se richiesta dall'organizzatore)</li>`,
                `</ul>`,
                `<p><strong>Conferma requisiti HACCP (firma):</strong> ______________________</p>`,
                `<p><strong>Data:</strong> ____ / ____ / ________</p>`
            ].join('')
        },
        {
            slug: 'energy',
            title: 'Sezione E — Energia elettrica',
            generatedFrom: null,
            content: [
                `<p>L'organizzazione mette a disposizione dello stand un <strong>punto luce base</strong> dedicato all'illuminazione dell'area interna dello stand, il cui costo è indicato sotto (barrare <strong>gratuito</strong> se incluso nel prezzo di partecipazione).</p>`,
                `<p>Eventuali <strong>esigenze elettriche aggiuntive</strong> (macchinari, frigoriferi, cucine, ecc.) devono essere <strong>elencate nel modulo</strong>, con indicazione della <strong>potenza assorbita (kW/kWh)</strong>; l'attivazione è subordinata alla disponibilità tecnica e all'accordo sull'eventuale <strong>contributo economico a carico dello stand</strong>, non incluso nel prezzo di partecipazione.</p>`,
                `<p>Alimentazione richiesta: \u2610 Solo punto luce base (nessuna esigenza aggiuntiva)</p>`,
                `<p><strong>Costo punto luce base:</strong> \u20AC ____________&nbsp;&nbsp;\u2610 gratuito</p>`,
                `<p>Esigenze elettriche aggiuntive (attrezzatura): _________________________________________</p>`,
                `<p>Potenza assorbita (kW/kWh): __________________</p>`,
                `<p>Tipo allaccio richiesto: _________________________________________</p>`,
                `<p>Contributo concordato (a carico dello stand): \u20AC ____________&nbsp;&nbsp;\u2610 nessuno</p>`,
                `<p><strong>Accettazione condizioni energia (firma):</strong> ______________________</p>`,
                `<p><strong>Data:</strong> ____ / ____ / ________</p>`
            ].join('')
        },
        {
            slug: 'participation-price',
            title: 'Sezione G — Prezzo di partecipazione',
            generatedFrom: null,
            content: [
                `<p>Prezzo di partecipazione: \u20AC ____________</p>`,
                `<p>Modalità di pagamento: \u2610 Contanti&nbsp;&nbsp;\u2610 Bonifico&nbsp;&nbsp;\u2610 Carta&nbsp;&nbsp;\u2610 Altro: ____________</p>`,
                `<p>Saldo entro il: ____ / ____ / ________</p>`,
                `<p><strong>Ricevuta di pagamento (compilata dall'organizzatore):</strong></p>`,
                `<p>Importo ricevuto: \u20AC ____________</p>`,
                `<p>Data pagamento: ____ / ____ / ________</p>`,
                `<p>Operatore (gestore evento): ______________________</p>`,
                `<p>Firma operatore: ______________________</p>`,
                `<p>Firma stand: ______________________</p>`
            ].join('')
        },
        {
            slug: 'deposit',
            title: 'Sezione H — Caparra non rimborsabile',
            generatedFrom: null,
            content: [
                `<p>Caparra versata: \u20AC ____________</p>`,
                `<p><strong>Non rimborsabile:</strong> il sottoscritto <strong>prende atto</strong> che la caparra non sarà restituita in caso di recesso o di mancato/pervenuto rifiuto dell'adesione per dati non conformi, e potrà essere stornata dal prezzo di partecipazione o dalle trattenute sulle vendite.</p>`,
                `<p><strong>Ricevuta di pagamento (compilata dall'organizzatore):</strong></p>`,
                `<p>Importo ricevuto: \u20AC ____________</p>`,
                `<p>Data pagamento: ____ / ____ / ________</p>`,
                `<p>Operatore (gestore evento): ______________________</p>`,
                `<p>Firma operatore: ______________________</p>`,
                `<p>Firma stand: ______________________</p>`
            ].join('')
        },
        {
            slug: 'regulation',
            title: 'Sezione I — Regolamento e clausola di esclusione',
            generatedFrom: null,
            content: [
                `<p>Il sottoscritto dichiara di avere letto, compreso e <strong>accettato integralmente</strong> il regolamento della manifestazione (orari, montaggio/smontaggio, pulizia, gestione rifiuti, rumore, divieti, postazioni) di cui alla versione *__________* (data ____ / ____ / ________).</p>`,
                `<p><strong>Clausola di esclusione.</strong> La violazione delle regole di cui sopra autorizza l'organizzatore, a propria discrezione e senza alcun indennizzo, ad <strong>escludere lo stand dalla manifestazione</strong>, con sospensione immediata dell'attività, perdita del posto assegnato e della caparra versata, fermo restando il pagamento dei corrispettivi già maturati.</p>`,
                `<p>\u2610 <strong>Accettazione regolamento</strong> (barrare obbligatorio)</p>`,
                `<p>\u2610 <strong>Accettazione clausola di esclusione</strong> (barrare obbligatorio)</p>`,
                `<p><strong>Firma gestore stand:</strong> ______________________</p>`,
                `<p><strong>Data:</strong> ____ / ____ / ________</p>`
            ].join('')
        },
        {
            slug: 'outcome',
            title: 'Sezione J — Esito dell\u2019organizzatore (da NON compilare dal richiedente)',
            generatedFrom: null,
            content: [
                `<p>Esito: \u2610 Approvata&nbsp;&nbsp;\u2610 Da integrare&nbsp;&nbsp;\u2610 Rifiutata&nbsp;&nbsp;\u2610 Esclusa</p>`,
                `<p>Note / motivo: ______________________________________________________</p>`,
                `<p>Data decisione: ____ / ____ / ________</p>`,
                `<p>Firma organizzatore: ______________________</p>`,
                `<p>Numero stand assegnato: ____________ (solo se approvata)</p>`,
                `<p><strong>Note:</strong></p>`,
                `<p>______________________________________________________________________</p>`
            ].join('')
        }
    ];
}

export function buildSectionsFromEvent(event: Event): GeneratedSection[] {
    const ordered: GeneratedSection[] = [];
    const header = headerSection(event);
    const currency = currencySection(event);
    const fees = feesSection(event);

    ordered.push(header);

    for (const section of staticSections()) {
        ordered.push(section);
        if (section.slug === 'haccp') {
            ordered.push(currency);
        } else if (section.slug === 'energy') {
            ordered.push(fees);
        }
    }

    return ordered;
}

export function toAdhesionFormResponse(
    form: AdhesionForm & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date }
): AdhesionFormResponse {
    return {
        id: form._id.toString(),
        eventId: (form.eventId as unknown as { toString(): string }).toString(),
        sections: (form.sections ?? []).map((s) => ({
            slug: s.slug,
            title: s.title,
            content: s.content ?? '',
            generatedFrom: s.generatedFrom ?? null
        })),
        eventFingerprint: form.eventFingerprint ?? null,
        generatedAt: form.generatedAt ? new Date(form.generatedAt).toISOString() : null,
        stale: Boolean(form.stale),
        createdAt: form.createdAt ? new Date(form.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: form.updatedAt ? new Date(form.updatedAt).toISOString() : new Date().toISOString()
    };
}

export async function getAdhesionForm(eventId: string): Promise<AdhesionFormResponse | null> {
    const form = await AdhesionFormModel.findOne({ eventId });
    if (!form) return null;
    return toAdhesionFormResponse(form);
}

export async function generateAdhesionForm(eventId: string): Promise<AdhesionFormResponse> {
    const event = await EventModel.findById(eventId);
    if (!event) {
        throw new Error('Event not found');
    }

    const existing = await AdhesionFormModel.findOne({ eventId });
    const existingBySlug = new Map<string, AdhesionFormSection>((existing?.sections ?? []).map((s) => [s.slug, s]));

    const target = buildSectionsFromEvent(event);
    const sections = target.map((t) => {
        const prev = existingBySlug.get(t.slug);
        const preserveManual = prev && prev.generatedFrom == null;
        return {
            slug: t.slug,
            title: preserveManual ? prev.title : t.title,
            content: preserveManual ? prev.content : t.content,
            generatedFrom: t.generatedFrom
        };
    });

    const fingerprint = computeEventFingerprint(event);

    const saved = await AdhesionFormModel.findOneAndUpdate(
        { eventId },
        {
            $set: {
                eventId,
                sections,
                eventFingerprint: fingerprint,
                generatedAt: new Date(),
                stale: false
            }
        },
        { new: true, upsert: true }
    );

    if (!saved) {
        throw new Error('Failed to save adhesion form');
    }

    return toAdhesionFormResponse(saved);
}

export async function updateAdhesionForm(eventId: string, input: AdhesionSectionInput[]): Promise<AdhesionFormResponse> {
    const form = await AdhesionFormModel.findOne({ eventId });
    if (!form) {
        throw new Error('Adhesion form not found');
    }

    const validSlugs = new Set(staticSections().map((s) => s.slug).concat([...GUIDED_SLUGS]));
    const next: Array<{
        slug: string;
        title: string;
        content: string;
        generatedFrom: string | null;
    }> = [];

    for (const item of input) {
        if (!item || typeof item.slug !== 'string' || !validSlugs.has(item.slug)) {
            throw new Error('Invalid section slug');
        }
        const prev = form.sections.find((s) => s.slug === item.slug);
        const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 200) : prev?.title ?? item.slug;
        const content = sanitizeHtmlContent(item.content) ?? '';
        next.push({
            slug: item.slug,
            title,
            content,
            generatedFrom: prev?.generatedFrom ?? null
        });
    }

    form.set('sections', next);
    form.stale = false;
    await form.save();

    return toAdhesionFormResponse(form);
}

export async function deleteAdhesionForm(eventId: string): Promise<boolean> {
    const result = await AdhesionFormModel.deleteOne({ eventId });
    return result.deletedCount > 0;
}

export async function markAdhesionFormStaleIfChanged(
    eventId: string,
    fingerprint: string
): Promise<boolean> {
    const form = await AdhesionFormModel.findOne({ eventId });
    if (!form) return false;

    if (form.eventFingerprint !== fingerprint) {
        form.stale = true;
        await form.save();
        return true;
    }

    return false;
}