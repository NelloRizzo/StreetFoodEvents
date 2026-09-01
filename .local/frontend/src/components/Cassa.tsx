import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Client, MenuItem, Station, StandCatalog } from '../lib/types';
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
    const [clients, setClients] = useState<Client[]>([]);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [clientId, setClientId] = useState<string>('');
    const [payMethod, setPayMethod] = useState<'crediti' | 'contanti'>('contanti');
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
        Promise.all([api.getCatalog(standId, eventId), api.getClients(eventId)])
            .then(([cat, cls]) => {
                setCatalog(cat);
                setItems(cat.items);
                setStations(cat.stations);
                const generic = cls.items.find((c) => c.userId === null);
                setClients(cls.items);
                setClientId(generic?.id ?? cls.items[0]?.id ?? '');
                setLoading(false);
            })
            .catch((e) => setLog(`Errore caricamento: ${e.message}`))
            .finally(() => setLoading(false));
    }, [eventId, standId, metaLoading]);

    const stationName = (id: string) => stations.find((s) => s.id === id)?.name ?? id;
    const selectedClient = clients.find((c) => c.id === clientId);

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
        const paymentOnCreate = payMethod === 'crediti' ? { creditAmount: total } : undefined;
        try {
            const res = await api.createOrder({
                eventId,
                standId,
                customerId: clientId || undefined,
                customerName: selectedClient?.displayName,
                items: cart.map((l) => ({
                    eventProductId: l.eventProductId,
                    stationId: l.stationId,
                    quantity: l.quantity
                })),
                paymentOnCreate
            });
            setLog(`Ordine #${res.item.orderNumber} creato (${res.item.paymentStatus === 'paid' ? 'pagato' : 'da pagare'}) — totale €${res.item.total.toFixed(2)}`);
            setCart([]);
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
                <label>
                    Cliente:
                    <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={styles.input}>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.displayName} (saldo {c.balance})
                            </option>
                        ))}
                    </select>
                </label>
                <div>
                    Pagamento:{' '}
                    {(['contanti', 'crediti'] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setPayMethod(m)}
                            style={{
                                ...styles.btn,
                                ...(payMethod === m ? styles.btnActive : {}),
                                fontSize: 13
                            }}
                        >
                            {m}
                        </button>
                    ))}
                </div>
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
                                        disabled={!cart.some((l) => l.eventProductId === item.eventProductId && l.stationId === sid)}
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
                    <div style={styles.total}>
                        Totale: {total.toFixed(2)} {catalog?.currencyName ?? '€'}
                    </div>
                    <button onClick={submitOrder} disabled={cart.length === 0} style={{ ...styles.btnBig }}>
                        Crea ordine
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
    input: { marginLeft: 8, padding: 6 },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
    col: { border: '1px solid #ddd', borderRadius: 8, padding: 12 },
    product: { borderBottom: '1px solid #eee', padding: '8px 0' },
    cartLine: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid #eee' },
    total: { fontWeight: 700, margin: '12px 0', fontSize: 18 },
    btn: { padding: '4px 10px', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', marginRight: 6 },
    btnActive: { background: '#264137', color: '#fff', borderColor: '#264137' },
    btnBig: { background: '#264137', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 16, cursor: 'pointer', width: '100%' },
    log: { marginTop: 16, padding: 10, background: '#f4f4f4', borderRadius: 8 }
};
