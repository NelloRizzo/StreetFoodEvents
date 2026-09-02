import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { DisplayOrder } from '../lib/types';
import { useMeta } from '../lib/MetaContext';

const STATUS_LABEL: Record<string, string> = {
    confirmed: 'Confermato',
    preparing: 'In preparazione',
    ready: 'Pronto'
};

export function CodaPubblica() {
    const { meta, loading: metaLoading } = useMeta();
    const [stand, setStand] = useState('');
    const [orders, setOrders] = useState<DisplayOrder[]>([]);

    const standId = meta?.standId ?? '';

    useEffect(() => {
        if (!standId) return;
        const load = () =>
            api
                .getDisplay(standId)
                .then((r) => {
                    setStand(r.standName);
                    setOrders(r.items);
                })
                .catch(() => {});
        load();
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, [standId, metaLoading]);

    if (metaLoading) return <div style={styles.page}>Caricamento...</div>;

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h1>{stand}</h1>
                <span style={styles.meta}>{orders.length} ordini in lavorazione</span>
            </div>
            <div style={styles.grid}>
                {orders.map((o) => (
                    <div key={o.id} style={styles.card}>
                        <div style={styles.cardHeader}>
                            <span style={styles.badge}>{o.isGift ? 'O' : '#'}{o.orderNumber}</span>
                            {o.isGift && <span style={styles.gift}>OMAGGIO</span>}
                            <span style={styles.status}>{STATUS_LABEL[o.status] ?? o.status}</span>
                        </div>
                        <div>
                            {o.items.map((i, idx) => (
                                <div key={idx} style={{ ...styles.line, ...(i.ready ? styles.lineReady : {}) }}>
                                    <span>{i.quantity}×</span> {i.productName}
                                    <span style={styles.station}>@{i.stationName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        fontFamily: 'system-ui, sans-serif',
        background: '#0f1f1a',
        color: '#fff',
        minHeight: '100vh',
        padding: 24
    },
    header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
    meta: { color: '#9bbbaf' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 },
    card: { background: '#1c332b', borderRadius: 12, padding: 16 },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
    badge: { background: '#e67e22', color: '#fff', borderRadius: 6, padding: '4px 10px', fontWeight: 700, fontSize: 20 },
    gift: { background: '#c0392b', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 12 },
    status: { marginLeft: 'auto', fontSize: 14, color: '#d5e8df' },
    line: { padding: '8px 0', fontSize: 18, borderBottom: '1px solid rgba(255,255,255,0.08)' },
    lineReady: { opacity: 0.5, textDecoration: 'line-through' },
    station: { color: '#9bbbaf', fontSize: 13, marginLeft: 8 }
};
