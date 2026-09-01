import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { RemoteEvent, RemoteStand } from '../lib/types';
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
            const res = await api.importFromRemote(confirm.eventId, confirm.standId, force);
            if (res.status === 'pending') {
                setLogs(`Ci sono ${res.pendingCount} modifiche non sincronizzate. Sincronizzale o conferma la sovrascrittura.`);
            } else {
                setLogs(`Import effettuato: ${res.eventName} — stand ${res.standName} (${res.stationsCount} postazioni, ${res.productsCount} prodotti).`);
                await refresh();
            }
        } catch (e) {
            setLogs(`Errore import: ${(e as Error).message}`);
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    }

    async function doPush() {
        setBusy(true);
        setLogs('');
        try {
            const res = await api.pushToRemote();
            if (res.errors.length > 0) {
                setLogs(`Push: ${res.pushed} elementi inviati, ${res.errors.length} errori (${res.errors[0]}).`);
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
                        {meta.pendingCount > 0 && (
                            <button onClick={() => setConfirm({ type: 'push' })} disabled={busy} style={styles.pushBtn}>
                                Sincronizza ora (push al remoto)
                            </button>
                        )}
                    </div>
                )}
            </div>

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
                                </option>
                            ))}
                        </select>
                    </label>
                    <button onClick={requestImport} disabled={!eventId || !standId || busy} style={styles.importBtn}>
                        Importa in locale (sostituisce)
                    </button>
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
