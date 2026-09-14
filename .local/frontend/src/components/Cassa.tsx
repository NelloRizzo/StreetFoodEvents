import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { MenuItem, Station, StandCatalog } from '../lib/types';
import { useMeta } from '../lib/MetaContext';

interface CartLine {
    eventProductId: string;
    productId: string;
    name: string;
    stationId: string;
    stationName: string;
    unitPrice: number;
    quantity: number;
}

export function Cassa() {
    const { meta, loading: metaLoading } = useMeta();
    const [items, setItems] = useState<MenuItem[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [isGift, setIsGift] = useState(false);
    const [log, setLog] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState<StandCatalog | null>(null);

    const eventId = meta?.eventId ?? '';
    const standId = meta?.standId ?? '';

    useEffect(() => {
        if (!eventId || !standId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        api.getCatalog(standId, eventId)
            .then((cat) => {
                setCatalog(cat);
                setItems(cat.items);
                setStations(cat.stations);
                setLoading(false);
            })
            .catch((e) => setLog(`Errore caricamento: ${e.message}`))
            .finally(() => setLoading(false));
    }, [eventId, standId, metaLoading]);

    const stationName = (id: string) => stations.find((s) => s.id === id)?.name ?? id;

    function addToCart(item: MenuItem, stationId: string) {
        setCart((prev) => {
            const existing = prev.find((l) => l.eventProductId === item.eventProductId && l.stationId === stationId);
            if (existing) {
                return prev.map((l) =>
                    l.eventProductId === item.eventProductId && l.stationId === stationId
                        ? { ...l, quantity: l.quantity + 1 }
                        : l
                );
            }
            return [
                ...prev,
                {
                    eventProductId: item.eventProductId,
                    productId: item.productId,
                    name: item.name,
                    stationId,
                    stationName: stationName(stationId),
                    unitPrice: item.price,
                    quantity: 1
                }
            ];
        });
    }

    function changeQty(eventProductId: string, stationId: string, delta: number) {
        setCart((prev) =>
            prev
                .map((l) =>
                    l.eventProductId === eventProductId && l.stationId === stationId
                        ? { ...l, quantity: Math.max(0, l.quantity + delta) }
                        : l
                )
                .filter((l) => l.quantity > 0)
        );
    }

    const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

    async function submitOrder() {
        if (cart.length === 0) return;
        try {
            const res = await api.createOrder({
                eventId,
                standId,
                items: cart.map((l) => ({
                    eventProductId: l.eventProductId,
                    stationId: l.stationId,
                    quantity: l.quantity
                })),
                paymentOnCreate: isGift ? undefined : {},
                isGift: isGift || undefined
            });
            const prefix = res.item.isGift ? 'O' : '#';
            const amount = res.item.isGift ? '0.00' : res.item.total.toFixed(2);
            setLog(`Ordine ${prefix}${res.item.orderNumber} creato — ${amount} ${catalog?.currencyName ?? '€'} (${res.item.isGift ? 'omaggio' : 'incassato'})`);
            setCart([]);
            setIsGift(false);
        } catch (e) {
            setLog(`Errore: ${(e as Error).message}`);
        }
    }

    if (loading || metaLoading) return <div style={styles.center}>Caricamento...</div>;

    if (!eventId || !standId) {
        return (
            <div style={styles.center}>
                <h3>Nessun evento/stand attivo</h3>
                <p>Vai nella scheda Sync per importare un evento e uno stand dal sistema remoto.</p>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.topBar}>
                {catalog?.coverImage ? (
                    <img src={catalog.coverImage.url} alt={catalog.standName} style={styles.coverThumb} />
                ) : null}
                <div style={styles.topText}>
                    <div style={styles.topTitle}>Cassa — {catalog?.standName || 'Stand'}</div>
                    {catalog?.eventName ? (
                        <div style={styles.topSub}>{catalog.eventName}</div>
                    ) : null}
                </div>
                <div style={styles.topMeta}>
                    <span>Moneta: {catalog?.currencyName ?? '€'}</span>
                    <span>Pagamento contanti</span>
                </div>
            </div>

            <div style={styles.body}>
                <div style={styles.col}>
                    <h3 style={styles.colTitle}>Prodotti</h3>
                    <div style={styles.list}>
                        {items.map((item) => (
                            <div key={item.eventProductId} style={styles.product}>
                                <div style={styles.productRow}>
                                    {item.coverImage ? (
                                        <img src={item.coverImage.url} alt={item.name} style={styles.productThumb} />
                                    ) : null}
                                    <div>
                                        <div style={styles.productName}>{item.name}</div>
                                        <div style={styles.productMeta}>
                                            {item.price.toFixed(2)} {catalog?.currencyName ?? '€'} — {item.stationIds.map(stationName).join(', ')}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {item.stationIds.map((sid) => (
                                        <button
                                            key={sid}
                                            onClick={() => addToCart(item, sid)}
                                            style={styles.btn}
                                        >
                                            + {stationName(sid)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={styles.col}>
                    <h3 style={styles.colTitle}>Carrello</h3>
                    {cart.length === 0 && <div style={styles.muted}>Nessun prodotto</div>}
                    {cart.map((l) => (
                        <div key={`${l.eventProductId}-${l.stationId}`} style={styles.cartLine}>
                            <div style={{ flex: 1 }}>
                                <div>{l.name} (@{l.stationName})</div>
                                <div style={styles.muted}>{(l.unitPrice * l.quantity).toFixed(2)}</div>
                            </div>
                            <button onClick={() => changeQty(l.eventProductId, l.stationId, -1)} style={styles.qtyBtn}>−</button>
                            <span style={{ padding: '0 6px' }}>{l.quantity}</span>
                            <button onClick={() => changeQty(l.eventProductId, l.stationId, 1)} style={styles.qtyBtn}>+</button>
                        </div>
                    ))}
                    <label style={styles.giftToggle}>
                        <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
                        Ordine omaggio
                    </label>
                    <div style={styles.total}>
                        Totale: {isGift ? '0.00' : total.toFixed(2)} {catalog?.currencyName ?? '€'}
                    </div>
                    <button onClick={submitOrder} disabled={cart.length === 0} style={{ ...styles.btnBig, ...(isGift ? styles.btnBigGift : {}) }}>
                        {isGift ? 'Crea ordine omaggio' : 'Crea ordine'}
                    </button>
                </div>
            </div>

            {log && <div style={styles.log}>{log}</div>}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#1a1a2e',
        color: '#f0f0f0',
        overflow: 'hidden'
    },
    center: { fontFamily: 'system-ui, sans-serif', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#1a1a2e', color: '#f0f0f0' },
    topBar: {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0.6rem 1.25rem',
        background: '#16213e',
        borderBottom: '1px solid #0f3460'
    },
    coverThumb: { width: 44, height: 44, objectFit: 'cover', borderRadius: 8, background: '#0f3460', flexShrink: 0 },
    topText: { display: 'flex', flexDirection: 'column', gap: 2, marginRight: 'auto' },
    topTitle: { fontWeight: 800, fontSize: 18 },
    topSub: { fontSize: 13, color: '#94a3b8' },
    topMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 12, color: '#94a3b8', flexShrink: 0 },
    body: { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, overflow: 'hidden' },
    col: { border: '1px solid #0f3460', borderRadius: 10, padding: 12, background: '#16213e', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' },
    colTitle: { margin: 0, marginBottom: 10, fontSize: 15, color: 'var(--sf-brand)', textTransform: 'uppercase', letterSpacing: '0.05em' },
    list: { flex: 1, minHeight: 0, overflowY: 'auto' },
    muted: { fontSize: 12, color: '#94a3b8' },
    product: { borderBottom: '1px solid rgba(15, 52, 96, 0.6)', padding: '8px 0' },
    productRow: { display: 'flex', alignItems: 'center', gap: 10 },
    productThumb: { width: 44, height: 44, objectFit: 'cover', borderRadius: 6, background: '#0f3460', flexShrink: 0 },
    productName: { fontWeight: 600, fontSize: 15 },
    productMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    cartLine: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid rgba(15, 52, 96, 0.6)', fontSize: 14 },
    total: { fontWeight: 800, margin: '12px 0', fontSize: 20, color: '#fff' },
    giftToggle: { display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0', cursor: 'pointer' },
    btn: { padding: '6px 12px', border: '1px solid #0f3460', background: '#1a1a2e', color: 'var(--sf-brand)', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    qtyBtn: { padding: '2px 10px', border: '1px solid #0f3460', background: '#1a1a2e', color: 'var(--sf-brand)', borderRadius: 6, cursor: 'pointer', fontSize: 15 },
    btnBig: { background: '#28a745', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%' },
    btnBigGift: { background: '#c0392b' },
    log: { flexShrink: 0, padding: 10, background: '#0f3460', color: '#fff', fontSize: 13, borderTop: '1px solid rgba(255,255,255,0.2)' }
};