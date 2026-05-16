import { getConsent } from './consent'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function pageView(path: string, title?: string): void {
  if (!getConsent()?.analytics) return
  if (typeof window.gtag === 'function') {
    window.gtag('config', 'G-XXXXXXXXXX', { page_path: path, page_title: title })
  }
}

export function event(name: string, params?: Record<string, string | number | boolean>): void {
  if (!getConsent()?.analytics) return
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params)
  }
}
