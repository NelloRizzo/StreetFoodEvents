declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

let initialized = false

export function getGtmId(): string {
  const id = import.meta.env.VITE_GTM_ID as string | undefined
  return id ?? ''
}

function ensureDataLayer(): void {
  if (!window.dataLayer) {
    window.dataLayer = []
  }
}

export function initGTM(): void {
  if (initialized) return

  const gtmId = getGtmId()
  if (!gtmId) return

  ensureDataLayer()

  window.dataLayer!.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`
  document.head.appendChild(script)

  initialized = true
}

export function pushToDataLayer(args: Record<string, unknown>): void {
  ensureDataLayer()
  window.dataLayer!.push(args)
}

export function trackPageView(path: string, title?: string): void {
  pushToDataLayer({
    event: 'page_view',
    page_path: path,
    page_title: title ?? document.title,
  })
}
