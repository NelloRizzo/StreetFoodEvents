export const permissions = [
    'users:read',
    'users:create',
    'users:update',
    'users:disable',

    'roles:read',
    'roles:create',
    'roles:update',
    'roles:disable',
    'roles:assign',

    'events:read',
    'events:create',
    'events:update',
    'events:delete',

    'stands:read',
    'stands:create',
    'stands:update',
    'stands:delete',

    'menu:read',
    'menu:create',
    'menu:update',
    'menu:delete',

    'orders:read',
    'orders:create',
    'orders:update',
    'orders:cancel',

    'payments:read',
    'payments:create',
    'payments:refund'
] as const;
