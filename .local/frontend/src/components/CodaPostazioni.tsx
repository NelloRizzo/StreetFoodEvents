import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from '../lib/api';
import type { Order, Station } from '../lib/types';
import { useMeta } from '../lib/MetaContext';

const STORAGE_KEY = 'local.codaPostazioni.selected';

function loadSelection(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
        }
    } catch { /* ignore */ }
    return [];
}

function saveSelection(ids: string[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch { /* ignore */ }
}

export function CodaPostazioni() {
    const { meta, loading: metaLoading } = useMeta();
    const [orders, setOrders] = useState<Order[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [error, setError] = useState('');
    const busyRef = useRef<Set<string>>(new Set());
    const [busy, setBusy] = useState<Record<string, boolean>>({});

    const eventId = meta?.eventId ?? '';
    const standId = meta?.standId ?? '';

    useEffect(() => {
        if (!standId) return;
        api.getCatalog(standId, eventId)
            .then((cat) => {
                setStations(cat.stations);
                const saved = loadSelection().filter((id) => cat.stations.some((s) => s.id === id));
                setSelected(saved.length > 0 ? saved : cat.stations.slice(0, 1).map((s) => s.id));
            })
            .catch((e) => setError(e.message));
    }, [standId, eventId, metaLoading]);

    useEffect(() => {
        if (selected.length === 0 || !standId) return;
        const load = () =>
            api
                .listOrders(standId, '&status=preparing,ready,confirmed')
                .then((r) => setOrders(r.items))
                .catch((e) => setError(e.message));
        load();
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, [selected, standId]);

    const lock = (key: string) => {
        if (busyRef.current.has(key)) return false;
        busyRef.current.add(key);
        flushSync(() => setBusy((prev) => ({ ...prev, [key]: true })));
        return true;
    };

    const unlock = (key: string) => {
        busyRef.current.delete(key);
        setBusy((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    async function itemReady(orderId: string, status: string, eventProductId: string, stationId: string) {
        const key = `item:${orderId}:${stationId}:${eventProductId}`;
        if (!lock(key)) return;
        try {
            if (status === 'confirmed') {
                await api.updateStatus(orderId, 'preparing');
            }
            await api.markItemReady(orderId, eventProductId, stationId);
            setOrders((prev) =>
                prev.map((o) =>
                    o.id === orderId
                        ? {
                              ...o,
                              items: o.items.map((i) =>
                                  i.eventProductId === eventProductId && i.stationId === stationId ? { ...i, ready: true } : i
                              )
                          }
                        : o
                )
            );
        } catch (e) {
            setError((e as Error).message);
        } finally {
            unlock(key);
        }
    }

    async function stationReady(orderId: string, status: string, stationId: string) {
        const key = `station:${orderId}:${stationId}`;
        if (!lock(key)) return;
        try {
            if (status === 'confirmed') {
                await api.updateStatus(orderId, 'preparing');
            }
            await api.markStationReady(orderId, stationId);
            setOrders((prev) =>
                prev.map((o) =>
                    o.id === orderId
                        ? {
                              ...o,
                              items: o.items.map((i) => (i.stationId === stationId ? { ...i, ready: true } : i))
                          }
                        : o
                )
            );
        } catch (e) {
            setError((e as Error).message);
        } finally {
            unlock(key);
        }
    }

    const stationName = (id: string) => stations.find((s) => s.id === id)?.name ?? id;
    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            saveSelection(next);
            return next;
        });
    };

    const visibleFor = (stationId: string) =>
        orders.filter((o) => o.items.some((i) => i.stationId === stationId && !i.ready));

    if (metaLoading) return <div style={styles.page}>Caricamento...</div>;

    if (!standId) {
        return (
            <div style={styles.page}>
                <p>Nessun evento/stand attivo. Vai nella scheda Sync per importare l'evento e lo stand.</p>
            </div>
        );
    }

    const allReady = selected.every((sid) => visibleFor(sid).length === 0);

    return (
        <div style={styles.page}>
            <h2>Coda Postazioni</h2>
            <div style={styles.toolbar}>
                <span style={{ color: '#555' }}>Postazioni selezionate (aggregate):</span>
                {stations.map((s) => (
                    <label key={s.id} style={styles.stationToggle}>
                        <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                        {s.name}
                    </label>
                ))}
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {selected.length === 0 && <div style={{ color: '#888', padding: 20 }}>Seleziona almeno una postazione</div>}

            {selected.length > 0 && allReady && (
                <div style={{ color: '#888', padding: 20 }}>
                    Tutti i prodotti delle postazioni selezionate sono pronti
                </div>
            )}

            <div style={styles.aggregate}>
                {selected.map((sid) => {
                    const visible = visibleFor(sid);
                    return (
                        <section key={sid} style={styles.stationSection}>
                            <div style={styles.stationHeader}>
                                <span style={styles.stationName}>{stationName(sid)}</span>
                                <span style={styles.count}>{visible.length} in lavorazione</span>
                            </div>

                            {visible.length === 0 && (
                                <div style={{ color: '#888', padding: 12 }}>Tutti i prodotti sono pronti</div>
                            )}

                            {visible.map((o) => {
                                const stationItems = o.items.filter((i) => i.stationId === sid);
                                const allStationReady = stationItems.every((i) => i.ready);
                                const busying = busy[`station:${o.id}:${sid}`];
                                return (
                                    <div key={`${o.id}-${sid}`} style={styles.card}>
                                        <div style={styles.cardHeader}>
                                            <span style={styles.badge}>{o.isGift ? 'O' : '#'}{o.orderNumber}</span>
                                            {o.isGift && <span style={styles.gift}>OMAGGIO</span>}
                                            <span>{new Date(o.createdAt).toLocaleTimeString('it-IT')}</span>
                                        </div>
                                        <div>
                                            {stationItems.map((i, idx) => {
                                                const itemKey = `item:${o.id}:${sid}:${i.eventProductId}`;
                                                const itemBusy = busy[itemKey];
                                                return (
                                                    <div key={idx} style={styles.itemRow}>
                                                        <div style={{ ...styles.line, ...(i.ready ? styles.lineDone : {}) }}>
                                                            <span style={{ flexShrink: 0 }}>{i.quantity}×</span>{' '}
                                                            <span style={{ flex: 1 }}>{i.productName}</span>
                                                            {i.ready && <span style={styles.done}>✓</span>}
                                                        </div>
                                                        {!i.ready && (
                                                            <button
                                                                onClick={() => itemReady(o.id, o.status, i.eventProductId, sid)}
                                                                style={styles.btnSmall}
                                                                disabled={itemBusy}
                                                            >
                                                                {itemBusy ? '...' : 'Pronto'}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={() => stationReady(o.id, o.status, sid)}
                                            style={allStationReady ? styles.btnBigDone : styles.btnBig}
                                            disabled={allStationReady || busying}
                                        >
                                            {busying ? '...' : allStationReady ? '✓ Tutto pronto' : 'Tutto pronto'}
                                        </button>
                                    </div>
                                );
                            })}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 1100, margin: '0 auto' },
    toolbar: { marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
    stationToggle: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 20, cursor: 'pointer' },
    aggregate: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
    stationSection: { border: '1px solid #ddd', borderRadius: 10, padding: 12, background: '#fafafa' },
    stationHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    stationName: { fontWeight: 700, fontSize: 16 },
    count: { fontSize: 12, color: '#666' },
    card: { border: '1px solid #ddd', borderRadius: 10, padding: 16, background: '#fff', marginBottom: 10 },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
    badge: { background: '#264137', color: '#fff', borderRadius: 6, padding: '2px 8px', fontWeight: 700 },
    gift: { background: '#c0392b', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 12 },
    itemRow: { display: 'flex', alignItems: 'center', gap: 8 },
    line: { padding: '6px 0', fontSize: 16, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 6, flex: 1 },
    lineDone: { opacity: 0.5 },
    done: { color: '#27ae60', fontWeight: 700 },
    btnSmall: { background: '#2e86de', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 13, cursor: 'pointer', flexShrink: 0 },
    btnBig: { marginTop: 14, background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', width: '100%', fontSize: 15, cursor: 'pointer' },
    btnBigDone: { marginTop: 14, background: '#8fbfa0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', width: '100%', fontSize: 15, cursor: 'default' },
    error: { padding: 10, background: '#fdecea', color: '#c0392b', borderRadius: 8, marginBottom: 12 }
};