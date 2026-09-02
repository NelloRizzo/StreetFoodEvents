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
            <div style={styles.header}>
                {catalog?.coverImage ? (
                    <img src={catalog.coverImage.url} alt={catalog.standName} style={styles.coverThumb} />
                ) : null}
                <div>
                    <h2 style={{ margin: 0 }}>Cassa — {catalog?.standName || 'Stand'}</h2>
                    {catalog?.eventName ? (
                        <div style={{ fontSize: 13, color: '#555' }}>{catalog.eventName}</div>
                    ) : null}
                </div>
            </div>
            <div style={styles.toolbar}>
                <span style={{ color: '#555' }}>Pagamento contanti — moneta: {catalog?.currencyName ?? '€'}</span>
            </div>

            <div style={styles.grid}>
                <div style={styles.col}>
                    <h3>Prodotti</h3>
                    {items.map((item) => (
                        <div key={item.eventProductId} style={styles.product}>
                            <div style={styles.productRow}>
                                {item.coverImage ? (
                                    <img src={item.coverImage.url} alt={item.name} style={styles.productThumb} />
                                ) : null}
                                <div>
                                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                                    <div style={{ fontSize: 12, color: '#555' }}>
                                        {item.price.toFixed(2)} {catalog?.currencyName ?? '€'} — {item.stationIds.map(stationName).join(', ')}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 4 }}>
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

                <div style={styles.col}>
                    <h3>Carrello</h3>
                    {cart.length === 0 && <div style={{ color: '#888' }}>Nessun prodotto</div>}
                    {cart.map((l) => (
                        <div key={`${l.eventProductId}-${l.stationId}`} style={styles.cartLine}>
                            <div style={{ flex: 1 }}>
                                <div>{l.name} (@{l.stationName})</div>
                                <div style={{ fontSize: 12, color: '#555' }}>{(l.unitPrice * l.quantity).toFixed(2)}</div>
                            </div>
                            <button onClick={() => changeQty(l.eventProductId, l.stationId, -1)} style={styles.btn}>−</button>
                            <span style={{ padding: '0 6px' }}>{l.quantity}</span>
                            <button onClick={() => changeQty(l.eventProductId, l.stationId, 1)} style={styles.btn}>+</button>
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
    page: { fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 1100, margin: '0 auto' },
    center: { fontFamily: 'system-ui, sans-serif', padding: 40, textAlign: 'center' },
    header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
    coverThumb: { width: 56, height: 56, objectFit: 'cover', borderRadius: 8, background: '#eee' },
    productRow: { display: 'flex', alignItems: 'center', gap: 10 },
    productThumb: { width: 44, height: 44, objectFit: 'cover', borderRadius: 6, background: '#eee', flexShrink: 0 },
    toolbar: { display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
    col: { border: '1px solid #ddd', borderRadius: 8, padding: 12 },
    product: { borderBottom: '1px solid #eee', padding: '8px 0' },
    cartLine: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid #eee' },
    total: { fontWeight: 700, margin: '12px 0', fontSize: 18 },
    giftToggle: { display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0', cursor: 'pointer' },
    btn: { padding: '4px 10px', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', marginRight: 6 },
    btnBig: { background: '#264137', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 16, cursor: 'pointer', width: '100%' },
    btnBigGift: { background: '#c0392b' },
    log: { marginTop: 16, padding: 10, background: '#f4f4f4', borderRadius: 8 }
};
