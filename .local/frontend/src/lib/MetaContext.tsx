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

export function MetaProvider({ children }: { children: ReactNode }) {
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);

    async function refresh() {
        try {
            const m = await api.getMeta();
            setMeta(m);
        } catch {
            setMeta(null);
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
