export interface ImageLite {
    url: string;
    width: number;
    height: number;
}

export interface MenuItem {
    eventProductId: string;
    productId: string;
    name: string;
    description: string | null;
    price: number;
    stationIds: string[];
    categoryIds: string[];
    coverImage: ImageLite | null;
}

export interface Station {
    id: string;
    name: string;
}

export interface StandCatalog {
    standId: string;
    standName: string;
    coverImage: ImageLite | null;
    eventId: string | null;
    eventName: string | null;
    currencyName: string | null;
    currencySymbol: ImageLite | null;
    stations: Station[];
    items: MenuItem[];
}

export interface OrderItem {
    eventProductId: string;
    productId: string;
    productName: string;
    stationId: string;
    stationName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    ready: boolean;
    notes: string | null;
}

export interface Order {
    id: string;
    eventId: string;
    standId: string;
    orderNumber: number;
    customerId: string | null;
    customerName: string | null;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    isGift: boolean;
    items: OrderItem[];
    total: number;
    creditAmountUsed: number;
    paymentStatus: 'unpaid' | 'paid' | 'refunded';
    createdAt: string;
    updatedAt: string;
}

export interface DisplayOrder {
    id: string;
    orderNumber: number;
    status: string;
    isGift: boolean;
    items: {
        productName: string;
        quantity: number;
        stationId: string;
        stationName: string;
        ready: boolean;
    }[];
}

export interface Meta {
    eventId: string | null;
    standId: string | null;
    eventName: string | null;
    currencyName: string | null;
    importedAt: string | null;
    hasPending: boolean;
    pendingCount: number;
}

export interface RemoteEvent {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    currencyName: string;
    exchangeRate: number;
}

export interface RemoteStand {
    id: string;
    name: string;
    type: string;
    number: number | null;
}

export interface ImportResult {
    status: 'ok' | 'pending';
    eventName?: string;
    standName?: string;
    productsCount?: number;
    stationsCount?: number;
    pendingCount?: number;
}

export interface PushResult {
    pushed: number;
    errors: string[];
}
