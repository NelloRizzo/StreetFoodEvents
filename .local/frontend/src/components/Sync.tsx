import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { RemoteEvent, RemoteStand, RejectedOrder } from '../lib/types';
import { useMeta } from '../lib/MetaContext';

type ConfirmAction = { type: 'import'; eventId: string; standId: string; force?: boolean } | { type: 'push' } | null;

export function Sync() {
    const { meta, refresh } = useMeta();
    const [events, setEvents] = useState<RemoteEvent[]>([]);
    const [stands, setStands] = useState<RemoteStand[]>([]);
    const [eventId, setEventId] = useState('');
    const [standId, setStandId] = useState('');
    const [logs, setLogs] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmAction>(null);
    const [loadingRemote, setLoadingRemote] = useState(false);
    const [remoteError, setRemoteError] = useState('');
    const [syncPassword, setSyncPassword] = useState('');
    const [rejected, setRejected] = useState<RejectedOrder[]>([]);

    useEffect(() => {
        api.getRejectedOrders()
            .then((r) => setRejected(r.items))
            .catch(() => setRejected([]));
    }, [meta.pendingCount]);

    useEffect(() => {
        setLoadingRemote(true);
        setRemoteError('');
        api.getRemoteEvents()
            .then((r) => {
                setEvents(r.items);
                setEventId('');
                setStands([]);
                setStandId('');
            })
            .catch((e) => setRemoteError(e.message))
            .finally(() => setLoadingRemote(false));
    }, []);

    async function loadStands(id: string) {
        setEventId(id);
        setStandId('');
        setStands([]);
        if (!id) return;
        setLoadingRemote(true);
        setRemoteError('');
        try {
            const r = await api.getRemoteStands(id);
            setStands(r.items);
        } catch (e) {
            setRemoteError((e as Error).message);
        } finally {
            setLoadingRemote(false);
        }
    }

    function requestImport() {
        if (!eventId || !standId) return;
        setConfirm({ type: 'import', eventId, standId });
    }

    async function doImport(force: boolean) {
        if (!confirm || confirm.type !== 'import') return;
        setBusy(true);
        setLogs('');
        try {
            const res = await api.importFromRemote(confirm.eventId, confirm.standId, force, syncPassword || undefined);
            if (res.status === 'pending') {
                setLogs(`Ci sono ${res.pendingCount} modifiche non sincronizzate. Sincronizzale o conferma la sovrascrittura.`);
            } else if (res.status === 'password-required') {
                setLogs('Password di sincronizzazione mancante: imposta la password dello stand nel remoto (Gestione stand → Sincronizzazione) e inseriscila qui.');
            } else {
                setLogs(`Import effettuato: ${res.eventName} — stand ${res.standName} (${res.stationsCount} postazioni, ${res.productsCount} prodotti).`);
                setSyncPassword('');
                await refresh();
            }
        } catch (e) {
            setLogs(`Errore import: ${(e as Error).message}`);
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    }

    async function savePassword() {
        setBusy(true);
        setLogs('');
        try {
            await api.setSyncPassword(syncPassword || '');
            setSyncPassword('');
            setLogs('Password di sincronizzazione salvata.');
            await refresh();
        } catch (e) {
            setLogs(`Errore salvataggio password: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    }

    async function doPush() {
        setBusy(true);
        setLogs('');
        try {
            const res = await api.pushToRemote();
            const rifiutati = res.rejected ?? [];
            /* Un rifiuto non è un errore di rete: gli altri ordini sono
               comunque partiti, quindi va detto il numero esatto e non
               "errore". */
            const righe = [];
            if (res.errors.length > 0) {
                righe.push(`${res.errors.length} errori (${res.errors[0]})`);
            }
            if (rifiutati.length > 0) {
                righe.push(`${rifiutati.length} ordini rifiutati dal remoto (registrati dopo la chiusura dell'evento)`);
            }
            if (righe.length > 0) {
                setLogs(`Push: ${res.pushed} elementi sincronizzati, ${righe.join(', ')}.`);
            } else {
                setLogs(`Push completato: ${res.pushed} modifiche sincronizzate sul remoto.`);
            }
            await refresh();
        } catch (e) {
            setLogs(`Errore push: ${(e as Error).message}`);
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    }

    async function clearRejected() {
        setBusy(true);
        try {
            const res = await api.clearRejectedOrders();
            setLogs(`Rifiuti archiviati: ${res.cleared}.`);
            await refresh();
        } catch (e) {
            setLogs(`Errore: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    }

    /** `event_closed` è l'unico motivo oggi; resta aperto per i futuri. */
    function rejectReasonText(reason: string): string {
        if (reason === 'event_closed') return "registrato dopo la chiusura dell'evento";
        return reason;
    }

    const selectedStandSyncDisabled = stands.find((s) => s.id === standId)?.syncEnabled === false;

    return (
        <div style={styles.page}>
            <h2>Sincronizzazione con il remoto</h2>

            <div style={styles.card}>
                <div style={styles.cardHeader}>Stato locale</div>
                {!meta ? (
                    <div>Nessun dato locale importato.</div>
                ) : (
                    <div>
                        <div>
                            <strong>Evento:</strong> {meta.eventName ?? meta.eventId ?? '—'}
                        </div>
                        <div>
                            <strong>Moneta:</strong> {meta.currencyName ?? '—'}
                        </div>
                        <div>
                            <strong>Importato il:</strong> {meta.importedAt ? new Date(meta.importedAt).toLocaleString('it-IT') : '—'}
                        </div>
                        <div>
                            <strong>Modifiche non sincronizzate:</strong>{' '}
                            <span style={meta.hasPending ? styles.pending : styles.ok}>
                                {meta.pendingCount}
                            </span>
                        </div>
                        <div>
                            <strong>Password di sincronizzazione:</strong>{' '}
                            <span style={meta.hasSyncPassword ? styles.ok : styles.pending}>
                                {meta.hasSyncPassword ? 'Presente' : 'Nessuna'}
                            </span>
                        </div>
                        {!meta.hasSyncPassword && meta.pendingCount > 0 && (
                            <div style={{ fontSize: 13, color: '#7a5c00', marginTop: 6 }}>
                                Per inviare le modifiche serve la password di sincronizzazione: salvala sotto e riprova.
                            </div>
                        )}
                        {meta.hasSyncPassword && meta.pendingCount > 0 && (
                            <button onClick={() => setConfirm({ type: 'push' })} disabled={busy} style={styles.pushBtn}>
                                Sincronizza ora (push al remoto)
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Ordini che il remoto ha rifiutato: restano fuori dalla coda di
                sincronizzazione e vanno risolti a mano. */}
            {rejected.length > 0 && (
                <div style={styles.card}>
                    <div style={styles.cardHeader}>Ordini rifiutati dal remoto ({rejected.length})</div>
                    <div style={styles.warning}>
                        Il remoto ha <strong>rifiutato</strong> questi ordini perché sono stati registrati
                        <strong> dopo la chiusura dell&apos;evento</strong>: fanno fede la data e l&apos;ora
                        dell&apos;ordine sul questo notebook, non l&apos;ora della sincronizzazione. Non
                        verranno riproposti al prossimo push. Se sono vendite reali, valuta l&apos;inserimento
                        manuale nel DB dell&apos;app.
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Ordine</th>
                                    <th style={styles.th}>Registrato</th>
                                    <th style={styles.th}>Totale</th>
                                    <th style={styles.th}>Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rejected.map((r) => (
                                    <tr key={r.localId}>
                                        <td style={styles.td}>#{r.orderNumber ?? '—'}</td>
                                        <td style={styles.td}>
                                            {r.orderedAt ? new Date(r.orderedAt).toLocaleString('it-IT') : '—'}
                                        </td>
                                        <td style={styles.td}>{r.total ?? '—'}</td>
                                        <td style={{ ...styles.td, color: '#c0392b' }}>{rejectReasonText(r.reason)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: 10 }}>
                        <button onClick={clearRejected} disabled={busy} style={styles.pushBtn}>
                            Ho gestito il caso: archivia i rifiuti
                        </button>
                    </div>
                </div>
            )}

            <div style={styles.card}>
                <div style={styles.cardHeader}>Importa evento e stand dal remoto</div>
                <div style={styles.warning}>
                    L'importazione <strong>sostituisce completamente</strong> i dati locali con quelli del remoto.
                    Le modifiche non sincronizzate andranno perse se non sincronizzate prima.
                </div>
                <div style={styles.toolbar}>
                    <label>
                        Evento remoto:
                        <select value={eventId} onChange={(e) => loadStands(e.target.value)} style={styles.input} disabled={loadingRemote}>
                            <option value="">— Seleziona evento —</option>
                            {events.map((ev) => (
                                <option key={ev.id} value={ev.id}>
                                    {ev.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Stand:
                        <select value={standId} onChange={(e) => setStandId(e.target.value)} style={styles.input} disabled={!eventId || loadingRemote}>
                            <option value="">— Seleziona stand —</option>
                            {stands.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.number ? `#${s.number} ` : ''}
                                    {s.name}
                                    {s.syncEnabled ? '\u{1F512}' : ' (sync non configurata)'}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Password di sincronizzazione:
                        <input
                            type="password"
                            value={syncPassword}
                            onChange={(e) => setSyncPassword(e.target.value)}
                            style={styles.input}
                            placeholder="Richiesta per stand con sync abilitata"
                        />
                    </label>
                    <button onClick={savePassword} disabled={!syncPassword || busy} style={styles.btn}>
                        Salva password
                    </button>
                    <button onClick={requestImport} disabled={!eventId || !standId || selectedStandSyncDisabled || busy} style={styles.importBtn}>
                        Importa in locale (sostituisce)
                    </button>
                    {selectedStandSyncDisabled && (
                        <div style={styles.error}>
                            Lo stand selezionato non ha la sync configurata: imposta la password nel remoto (Gestione stand →
                            Sincronizzazione app locale).
                        </div>
                    )}
                </div>
                {remoteError && <div style={styles.error}>{remoteError}</div>}
            </div>

            {logs && <div style={styles.log}>{logs}</div>}

            {confirm?.type === 'push' && (
                <div style={styles.modal}>
                    <div style={styles.modalBox}>
                        <h3>Sincronizzare le modifiche col remoto?</h3>
                        <p>Le modifiche non sincronizzate (ordini, transazioni, contatori) verranno inviate al sistema remoto.</p>
                        <div style={styles.modalActions}>
                            <button onClick={() => setConfirm(null)} disabled={busy} style={styles.btn}>
                                Annulla
                            </button>
                            <button onClick={doPush} disabled={busy} style={styles.pushBtn}>
                                {busy ? 'Invio in corso...' : 'Sincronizza'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirm?.type === 'import' && (
                <div style={styles.modal}>
                    <div style={styles.modalBox}>
                        <h3>Importare evento e stand in locale?</h3>
                        {meta?.hasPending ? (
                            <>
                                <p>
                                    Ci sono <strong>{meta.pendingCount}</strong> modifiche locali non ancora sincronizzate.
                                    L'importazione le eliminerà definitivamente.
                                </p>
                                <div style={styles.modalActions}>
                                    <button onClick={() => setConfirm(null)} disabled={busy} style={styles.btn}>
                                        Annulla
                                    </button>
                                    <button onClick={doPush} disabled={busy} style={styles.pushBtn}>
                                        Sincronizza prima
                                    </button>
                                    <button onClick={() => doImport(true)} disabled={busy} style={styles.dangerBtn}>
                                        {busy ? 'Operazione...' : 'Sovrascrivi comunque'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p>Tutti i dati locali saranno sostituiti con quelli del remoto. Procedere?</p>
                                <div style={styles.modalActions}>
                                    <button onClick={() => setConfirm(null)} disabled={busy} style={styles.btn}>
                                        Annulla
                                    </button>
                                    <button onClick={() => doImport(true)} disabled={busy} style={styles.dangerBtn}>
                                        {busy ? 'Operazione...' : 'Conferma import'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 900, margin: '0 auto' },
    card: { border: '1px solid #ddd', borderRadius: 10, padding: 16, marginBottom: 16, background: '#fff' },
    cardHeader: { fontWeight: 700, fontSize: 18, marginBottom: 12 },
    warning: { background: '#fff7e0', border: '1px solid #f0c36d', color: '#7a5c00', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14 },
    toolbar: { display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
    input: { marginLeft: 8, padding: 6, minWidth: 200 },
    pending: { color: '#c0392b', fontWeight: 700 },
    ok: { color: '#27ae60', fontWeight: 700 },
    th: { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #ddd', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.03em' },
    td: { padding: '6px 8px', borderBottom: '1px solid #eee' },
    pushBtn: { background: '#264137', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 14 },
    importBtn: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 14 },
    dangerBtn: { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer' },
    btn: { background: '#eee', color: '#333', border: '1px solid #ccc', borderRadius: 8, padding: '10px 16px', cursor: 'pointer' },
    log: { marginTop: 16, padding: 12, background: '#f4f4f4', borderRadius: 8, whiteSpace: 'pre-wrap' },
    error: { marginTop: 12, padding: 10, background: '#fdecea', color: '#c0392b', borderRadius: 8 },
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
    modalBox: { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' },
    modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }
};
