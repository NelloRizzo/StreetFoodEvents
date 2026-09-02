import type { DisplayOrder, ImportResult, Meta, Order, PushResult, RemoteEvent, RemoteStand, StandCatalog } from './types';

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
        ...options
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Errore' }));
        throw new Error(err.message ?? 'Errore');
    }
    return res.json() as Promise<T>;
}

export const api = {
    getCatalog: (standId: string, eventId?: string) =>
        request<StandCatalog>(`/catalog/stand/${standId}/menu${eventId ? `?eventId=${eventId}` : ''}`),
    createOrder: (body: unknown) => request<{ item: Order }>(`/orders`, { method: 'POST', body: JSON.stringify(body) }),
    listOrders: (standId: string, extra = '') =>
        request<{ items: Order[] }>(`/orders?standId=${standId}${extra}`),
    updateStatus: (orderId: string, status: string, reason?: string) =>
        request<{ item: Order }>(`/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, reason })
        }),
    markStationReady: (orderId: string, stationId: string) =>
        request<{ item: Order }>(`/orders/${orderId}/mark-station-ready`, {
            method: 'PATCH',
            body: JSON.stringify({ stationId })
        }),
    markItemReady: (orderId: string, eventProductId: string, stationId?: string) =>
        request<{ item: Order }>(`/orders/${orderId}/mark-item-ready`, {
            method: 'PATCH',
            body: JSON.stringify({ eventProductId, stationId })
        }),
    cancelOrder: (orderId: string, reason?: string) =>
        request<{ item: Order }>(`/orders/${orderId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        }),
    getDisplay: (standId: string) => request<{ standId: string; standName: string; items: DisplayOrder[] }>(`/orders/stand/${standId}/ordersqueue`),

    // Sync
    getMeta: () => request<Meta>(`/sync/meta`),
    getRemoteEvents: () => request<{ items: RemoteEvent[] }>(`/sync/remote/events`),
    getRemoteStands: (eventId: string) => request<{ event: { id: string; name: string }; items: RemoteStand[] }>(`/sync/remote/events/${eventId}/stands`),
    importFromRemote: (eventId: string, standId: string, force?: boolean) =>
        request<ImportResult>(`/sync/import`, { method: 'POST', body: JSON.stringify({ eventId, standId, force }) }),
    getPendingCount: () => request<{ count: number }>(`/sync/pending/count`),
    pushToRemote: () => request<PushResult>(`/sync/push`, { method: 'POST' })
};
