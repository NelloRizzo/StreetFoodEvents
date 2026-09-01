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
        <div>
            <nav style={styles.nav}>
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
                {meta?.eventName && <div style={styles.meta}>{meta.eventName}</div>}
            </nav>
            {view === 'cassa' && <Cassa />}
            {view === 'coda' && <CodaPostazioni />}
            {view === 'display' && <CodaPubblica />}
            {view === 'sync' && <Sync />}
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
    nav: { display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: '#f5f5f5', borderBottom: '1px solid #ddd', flexWrap: 'wrap' },
    navInner: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    tab: { padding: '10px 18px', border: '1px solid #ccc', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 15 },
    tabActive: { background: '#264137', color: '#fff', borderColor: '#264137' },
    meta: { marginLeft: 'auto', color: '#555', fontSize: 14 },
    navBadge: { background: '#c0392b', color: '#fff', borderRadius: 10, padding: '0 7px', marginLeft: 6, fontSize: 12 }
};
