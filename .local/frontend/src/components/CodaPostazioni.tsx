import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Order, Station } from '../lib/types';
import { useMeta } from '../lib/MetaContext';

export function CodaPostazioni() {
    const { meta, loading: metaLoading } = useMeta();
    const [orders, setOrders] = useState<Order[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [stationId, setStationId] = useState<string>('');
    const [error, setError] = useState('');

    const eventId = meta?.eventId ?? '';
    const standId = meta?.standId ?? '';

    useEffect(() => {
        if (!standId) return;
        api.getCatalog(standId, eventId).then((cat) => {
            setStations(cat.stations);
            setStationId(cat.stations[0]?.id ?? '');
        });
    }, [standId, eventId, metaLoading]);

    useEffect(() => {
        if (!stationId || !standId) return;
        const load = () =>
            api
                .listOrders(standId, '&status=preparing,ready,confirmed')
                .then((r) => setOrders(r.items))
                .catch((e) => setError(e.message));
        load();
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, [stationId, standId]);

    async function ready(orderId: string) {
        try {
            await api.markStationReady(orderId, stationId);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    const stationName = (id: string) => stations.find((s) => s.id === id)?.name ?? id;
    const filtered = orders.filter((o) => o.status === 'preparing' && o.items.some((i) => i.stationId === stationId && !i.ready));

    if (metaLoading) return <div style={styles.page}>Caricamento...</div>;

    if (!standId) {
        return (
            <div style={styles.page}>
                <p>Nessun evento/stand attivo. Vai nella scheda Sync per importare l'evento e lo stand.</p>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <h2>Coda Postazioni — {stationName(stationId)}</h2>
            <div style={styles.toolbar}>
                <label>
                    Postazione:
                    <select value={stationId} onChange={(e) => setStationId(e.target.value)} style={styles.input}>
                        {stations.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {filtered.length === 0 && <div style={{ color: '#888', padding: 20 }}>Nessun ordine in lavorazione</div>}

            <div style={styles.grid}>
                {filtered.map((o) => (
                    <div key={o.id} style={styles.card}>
                        <div style={styles.cardHeader}>
                            <span style={styles.badge}>#{o.orderNumber}</span>
                            {o.isGift && <span style={styles.gift}>OMAGGIO</span>}
                            <span>{new Date(o.createdAt).toLocaleTimeString('it-IT')}</span>
                        </div>
                        <div>
                            {o.items
                                .filter((i) => i.stationId === stationId)
                                .map((i, idx) => (
                                    <div key={idx} style={styles.line}>
                                        <span>{i.quantity}×</span> {i.productName}
                                    </div>
                                ))}
                        </div>
                        <button onClick={() => ready(o.id)} style={styles.btnBig}>
                            Tutto pronto
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 1100, margin: '0 auto' },
    toolbar: { marginBottom: 16 },
    input: { marginLeft: 8, padding: 6 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 },
    card: { border: '1px solid #ddd', borderRadius: 10, padding: 16, background: '#fff' },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
    badge: { background: '#264137', color: '#fff', borderRadius: 6, padding: '2px 8px', fontWeight: 700 },
    gift: { background: '#c0392b', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 12 },
    line: { padding: '6px 0', fontSize: 16, borderBottom: '1px solid #f0f0f0' },
    btnBig: { marginTop: 14, background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', width: '100%', fontSize: 15, cursor: 'pointer' },
    error: { padding: 10, background: '#fdecea', color: '#c0392b', borderRadius: 8, marginBottom: 12 }
};
