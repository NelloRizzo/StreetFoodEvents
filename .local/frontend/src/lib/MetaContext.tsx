import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Meta } from '../lib/types';

interface MetaContextValue {
    meta: Meta | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

const MetaContext = createContext<MetaContextValue>({
    meta: null,
    loading: true,
    refresh: async () => {}
});

function applyThemeVars(meta: Meta | null) {
    const root = document.documentElement;
    root.style.setProperty('--sf-brand', meta?.theme?.brand || '#e94560');
    root.style.setProperty('--sf-highlight', meta?.theme?.highlight || '#ffc107');
}

export function MetaProvider({ children }: { children: ReactNode }) {
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);

    async function refresh() {
        try {
            const m = await api.getMeta();
            setMeta(m);
            applyThemeVars(m);
        } catch {
            setMeta(null);
            applyThemeVars(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, []);

    return <MetaContext.Provider value={{ meta, loading, refresh }}>{children}</MetaContext.Provider>;
}

export function useMeta() {
    return useContext(MetaContext);
}
