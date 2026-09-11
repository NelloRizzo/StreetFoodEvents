import { useEffect } from 'react'

const KEEP_ALIVE_MS = 9 * 60_000

export function useKeepAlive(intervalMs = KEEP_ALIVE_MS) {
  useEffect(() => {
    const ping = () => {
      fetch('/', { cache: 'no-store', credentials: 'omit' }).catch(() => {})
    }
    ping()
    const id = setInterval(ping, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}