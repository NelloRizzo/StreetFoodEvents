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
                    setOrders([...r.items].sort((a, b) => a.orderNumber - b.orderNumber));
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
                <div>
                    <div style={styles.eventLine}>{orders.length} ordini in lavorazione</div>
                    <h1 style={styles.standName}>{stand}</h1>
                </div>
                <span style={styles.meta}>Stato ordini</span>
            </div>
            <div style={styles.body}>
                {orders.length === 0 ? (
                    <div style={styles.empty}>
                        <div style={styles.emptyIcon}>&#128203;</div>
                        <p style={styles.emptyText}>Nessun ordine in lavorazione</p>
                        <p style={styles.emptyHint}>I prossimi ordini appariranno qui.</p>
                    </div>
                ) : (
                    <div style={styles.grid}>
                        {orders.map((o) => {
                            const allReady = o.items.length > 0 && o.items.every((i) => i.ready);
                            const isReady = o.status === 'ready' || allReady;
                            const isPreparing = o.status === 'preparing' && !allReady;
                            return (
                                <div
                                    key={o.id}
                                    style={{
                                        ...styles.card,
                                        ...(isPreparing ? styles.cardPreparing : {}),
                                        ...(isReady ? styles.cardReady : {})
                                    }}
                                >
                                    <div style={styles.cardHeader}>
                                        <span style={styles.badge}>{o.isGift ? 'O' : '#'}{o.orderNumber}</span>
                                        {o.isGift && <span style={styles.gift}>OMAGGIO</span>}
                                        <span style={styles.status}>{isReady ? 'Pronto' : STATUS_LABEL[o.status] ?? o.status}</span>
                                    </div>
                                    <div>
                                        {o.items.map((i, idx) => (
                                            <div key={idx} style={{ ...styles.line, ...(i.ready ? styles.lineReady : {}) }}>
                                                <span style={{ color: 'var(--sf-brand)', fontWeight: 800 }}>{i.quantity}×</span>
                                                <span style={{ flex: 1 }}>{i.productName}</span>
                                                <span style={styles.station}>@{i.stationName}</span>
                                                {i.ready && <span style={styles.done}>✓</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div style={styles.footer}>
                <span style={styles.footerText}>
                    Ritira il tuo ordine al banco quando il numero mostra &ldquo;Pronto&rdquo;
                </span>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        color: '#f1f5f9',
        overflow: 'hidden'
    },
    header: {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        background: '#1e293b',
        borderBottom: '2px solid #334155'
    },
    eventLine: { color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 },
    standName: { margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.1 },
    meta: { color: 'var(--sf-brand)', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' },
    body: { flex: 1, minHeight: 0, overflowY: 'auto' },
    empty: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' },
    emptyIcon: { fontSize: 64, opacity: 0.5 },
    emptyText: { fontSize: 32, fontWeight: 700, color: '#94a3b8', margin: 0 },
    emptyHint: { fontSize: 18, color: '#64748b', margin: 0 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, padding: '1.25rem 1.5rem', alignContent: 'start' },
    card: { background: '#1e293b', borderRadius: 14, padding: 16, border: '2px solid #334155' },
    cardPreparing: { borderColor: 'var(--sf-brand)' },
    cardReady: { borderColor: '#22c55e', background: '#14532d' },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
    badge: { background: '#f0f0f0', color: '#16213e', borderRadius: 8, padding: '2px 12px', fontWeight: 800, fontSize: 32, lineHeight: 1.2 },
    gift: { background: 'var(--sf-highlight)', color: '#451a03', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 800 },
    status: { marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: '#cbd5e1' },
    line: { padding: '8px 0', fontSize: 18, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 },
    lineReady: { opacity: 0.5, textDecoration: 'line-through' },
    station: { color: '#94a3b8', fontSize: 13, flexShrink: 0 },
    done: { color: '#22c55e', fontWeight: 800, fontSize: 20 },
    footer: { flexShrink: 0, padding: '0.75rem 1.5rem', background: '#1e293b', borderTop: '2px solid #334155', textAlign: 'center' },
    footerText: { fontSize: 14, color: '#94a3b8' }
};