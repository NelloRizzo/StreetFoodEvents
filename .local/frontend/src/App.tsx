import { useState } from 'react';
import { MetaProvider, useMeta } from './lib/MetaContext';
import { Cassa } from './components/Cassa';
import { CodaPostazioni } from './components/CodaPostazioni';
import { CodaPubblica } from './components/CodaPubblica';
import { Sync } from './components/Sync';

type View = 'cassa' | 'coda' | 'display' | 'sync';

function Shell() {
    const [view, setView] = useState<View>('cassa');
    const { meta } = useMeta();

    const tabs: { key: View; label: string }[] = [
        { key: 'cassa', label: 'Cassa' },
        { key: 'coda', label: 'Coda Postazioni' },
        { key: 'display', label: 'Display Pubblico' },
        { key: 'sync', label: 'Sync' }
    ];

    return (
        <div style={styles.root}>
            <nav style={styles.nav}>
                <div style={styles.navBrand}>Street Food — Locale</div>
                <div style={styles.navInner}>
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setView(t.key)}
                            style={{ ...styles.tab, ...(view === t.key ? styles.tabActive : {}) }}
                        >
                            {t.label}
                            {t.key === 'sync' && meta?.pendingCount ? (
                                <span style={styles.navBadge}>{meta.pendingCount}</span>
                            ) : null}
                        </button>
                    ))}
                </div>
                {meta?.eventName && <div style={styles.navMeta}>{meta.eventName}</div>}
            </nav>
            <main style={styles.main}>
                {view === 'cassa' && <Cassa />}
                {view === 'coda' && <CodaPostazioni />}
                {view === 'display' && <CodaPubblica />}
                {view === 'sync' && <Sync />}
            </main>
        </div>
    );
}

export default function App() {
    return (
        <MetaProvider>
            <Shell />
        </MetaProvider>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        height: '100vh',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    nav: {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0 1rem',
        height: '3.25rem',
        background: '#16213e',
        color: '#f0f0f0',
        borderBottom: '1px solid #0f3460'
    },
    navBrand: {
        fontWeight: 800,
        fontSize: '0.95rem',
        color: 'var(--sf-brand)',
        whiteSpace: 'nowrap',
        flexShrink: 0
    },
    navInner: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' },
    tab: {
        padding: '6px 14px',
        border: '1px solid #0f3460',
        background: 'transparent',
        color: '#cbd5e1',
        borderRadius: 999,
        cursor: 'pointer',
        fontSize: 14,
        whiteSpace: 'nowrap'
    },
    tabActive: { background: 'var(--sf-brand)', color: '#fff', borderColor: 'var(--sf-brand)' },
    navMeta: { marginLeft: 'auto', color: '#94a3b8', fontSize: 13, whiteSpace: 'nowrap' },
    navBadge: { background: 'var(--sf-highlight)', color: '#16213e', borderRadius: 10, padding: '0 7px', marginLeft: 6, fontSize: 12, fontWeight: 700 },
    main: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
};