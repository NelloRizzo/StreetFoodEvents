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

export type TrackingClearEvent = {
  type: 'tracking-clear'
  eventId: string
  standId: string
  at: number
}

type OrderCreatedListener = (event: OrderCreatedEvent) => void
type TrackingClearListener = (event: TrackingClearEvent) => void

const trackingClearListeners = new Set<TrackingClearListener>()
const localListeners = new Set<OrderCreatedListener>()
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
    return sessionStorage.getItem(trackingStorageKey(page, eventId)) === '1'
  } catch {
    return false
  }
}

export function setTrackingEnabled(page: TrackingPage, eventId: string, enabled: boolean) {
  try {
    if (enabled) {
      sessionStorage.setItem(trackingStorageKey(page, eventId), '1')
    } else {
      sessionStorage.removeItem(trackingStorageKey(page, eventId))
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
  const event: OrderCreatedEvent = { type: 'order-created', at: Date.now(), ...input }
  localListeners.forEach((cb) => {
    try {
      cb(event)
    } catch {
      /* listener non disponibile */
    }
  })
  const ch = getChannel()
  if (!ch) return
  try {
    ch.postMessage(event)
  } catch {
    /* canale non disponibile */
  }
}

export function broadcastTrackingClear(input: { eventId: string; standId: string }) {
  const event: TrackingClearEvent = { type: 'tracking-clear', at: Date.now(), ...input }
  trackingClearListeners.forEach((cb) => {
    try {
      cb(event)
    } catch {
      /* listener non disponibile */
    }
  })
  const ch = getChannel()
  if (!ch) return
  try {
    ch.postMessage(event)
  } catch {
    /* canale non disponibile */
  }
}

export function onOrderCreated(cb: (event: OrderCreatedEvent) => void): () => void {
  localListeners.add(cb)
  const ch = getChannel()
  const handler = (e: MessageEvent) => {
    const data = e.data as OrderCreatedEvent | TrackingClearEvent | null
    if (data?.type === 'order-created') cb(data)
  }
  if (ch) ch.addEventListener('message', handler)
  return () => {
    localListeners.delete(cb)
    if (ch) ch.removeEventListener('message', handler)
  }
}

export function onTrackingClear(cb: (event: TrackingClearEvent) => void): () => void {
  trackingClearListeners.add(cb)
  const ch = getChannel()
  const handler = (e: MessageEvent) => {
    const data = e.data as OrderCreatedEvent | TrackingClearEvent | null
    if (data?.type === 'tracking-clear') cb(data)
  }
  if (ch) ch.addEventListener('message', handler)
  return () => {
    trackingClearListeners.delete(cb)
    if (ch) ch.removeEventListener('message', handler)
  }
}

export function useTrackingEnabled(page: TrackingPage, eventId: string | null | undefined) {
  const [enabled, setEnabled] = useState(() => (eventId ? isTrackingEnabled(page, eventId) : false))

  useEffect(() => {
    setEnabled(eventId ? isTrackingEnabled(page, eventId) : false)
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