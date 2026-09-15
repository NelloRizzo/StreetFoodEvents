import { useCallback, useEffect, useState } from 'react'

const TRACKING_PREFIX = 'sfe_tracking_enabled_'

export function trackingStorageKey(eventId: string) {
  return `${TRACKING_PREFIX}${eventId}`
}

export function isTrackingEnabled(eventId: string) {
  try {
    return localStorage.getItem(trackingStorageKey(eventId)) === '1'
  } catch {
    return false
  }
}

export function setTrackingEnabled(eventId: string, enabled: boolean) {
  try {
    if (enabled) {
      localStorage.setItem(trackingStorageKey(eventId), '1')
    } else {
      localStorage.removeItem(trackingStorageKey(eventId))
    }
  } catch {
    /* storage non disponibile */
  }
}

export function useTrackingEnabled(eventId: string | null | undefined) {
  const [enabled, setEnabled] = useState(() => (eventId ? isTrackingEnabled(eventId) : false))

  useEffect(() => {
    if (!eventId) {
      setEnabled(false)
      return
    }
    setEnabled(isTrackingEnabled(eventId))
    const onStorage = (e: StorageEvent) => {
      if (e.key === trackingStorageKey(eventId) || e.key === null) {
        setEnabled(isTrackingEnabled(eventId))
      }
    }
    globalThis.addEventListener('storage', onStorage)
    return () => globalThis.removeEventListener('storage', onStorage)
  }, [eventId])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      if (eventId) setTrackingEnabled(eventId, next)
      return next
    })
  }, [eventId])

  return { enabled, toggle }
}