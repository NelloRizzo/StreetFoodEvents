import { useCallback, useEffect, useState } from 'react'

export type TrackingPage = 'admin' | 'slideshow' | 'cashier' | 'public'

const TRACKING_PREFIX: Record<TrackingPage, string> = {
  admin: 'sfe_tracking_admin_',
  slideshow: 'sfe_tracking_slideshow_',
  cashier: 'sfe_tracking_cashier_',
  public: 'sfe_tracking_public_',
}

const TRACKING_CHANNEL_NAME = 'sfe_tracking_orders'

export type OrderCreatedEvent = {
  type: 'order-created'
  eventId: string
  standId: string
  orderId: string
  orderNumber: string
  at: number
}

let channel: BroadcastChannel | null | undefined

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    try {
      channel =
        typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(TRACKING_CHANNEL_NAME) : null
    } catch {
      channel = null
    }
  }
  return channel
}

export function trackingStorageKey(page: TrackingPage, eventId: string) {
  return `${TRACKING_PREFIX[page]}${eventId}`
}

export function isTrackingEnabled(page: TrackingPage, eventId: string) {
  try {
    return localStorage.getItem(trackingStorageKey(page, eventId)) === '1'
  } catch {
    return false
  }
}

export function setTrackingEnabled(page: TrackingPage, eventId: string, enabled: boolean) {
  try {
    if (enabled) {
      localStorage.setItem(trackingStorageKey(page, eventId), '1')
    } else {
      localStorage.removeItem(trackingStorageKey(page, eventId))
    }
  } catch {
    /* storage non disponibile */
  }
}

export function broadcastOrderCreated(input: {
  eventId: string
  standId: string
  orderId: string
  orderNumber: string
}) {
  const ch = getChannel()
  if (!ch) return
  try {
    ch.postMessage({ type: 'order-created', at: Date.now(), ...input } satisfies OrderCreatedEvent)
  } catch {
    /* canale non disponibile */
  }
}

export function onOrderCreated(cb: (event: OrderCreatedEvent) => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  const handler = (e: MessageEvent) => {
    const data = e.data as OrderCreatedEvent | null
    if (data?.type === 'order-created') cb(data)
  }
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}

export function useTrackingEnabled(page: TrackingPage, eventId: string | null | undefined) {
  const [enabled, setEnabled] = useState(() => (eventId ? isTrackingEnabled(page, eventId) : false))

  useEffect(() => {
    if (!eventId) {
      setEnabled(false)
      return
    }
    setEnabled(isTrackingEnabled(page, eventId))
    const onStorage = (e: StorageEvent) => {
      if (e.key === trackingStorageKey(page, eventId) || e.key === null) {
        setEnabled(isTrackingEnabled(page, eventId))
      }
    }
    globalThis.addEventListener('storage', onStorage)
    return () => globalThis.removeEventListener('storage', onStorage)
  }, [page, eventId])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      if (eventId) setTrackingEnabled(page, eventId, next)
      return next
    })
  }, [page, eventId])

  return { enabled, toggle }
}