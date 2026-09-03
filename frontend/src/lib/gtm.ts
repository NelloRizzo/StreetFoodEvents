declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

type PageContext = {
  role?: string
  eventId?: string
  standId?: string
}

let initialized = false

export function getGtmId(): string {
  const id = import.meta.env.VITE_GTM_ID as string | undefined
  return id?.trim() ?? ''
}

function ensureDataLayer(): void {
  if (!window.dataLayer) {
    window.dataLayer = []
  }
}

/**
 * Google Consent Mode v2.
 * Il consenso parte DENIED per analytics/ads (privacy by default) e viene
 * aggiornato in `updateConsent` quando l'utente decide nel banner.
 */
export function initGTM(consent: { analytics: boolean; ads: boolean }): void {
  if (initialized) return

  const gtmId = getGtmId()
  if (!gtmId) return

  ensureDataLayer()

  // Consent Mode: impostiamo i default PRIMA di caricare GTM.
  window.dataLayer!.push({
    consent: 'default',
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })

  window.dataLayer!.push({
    consent: 'default',
    wait_for_update: 500,
  })

  window.dataLayer!.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`
  script.onload = () => {
    // Applica il consenso SOLO dopo che gtm.js è caricato, così il runtime GTM
    // legge sempre lo stato `granted`/`denied` corretto quando elabora i tag.
    updateConsent(consent)
  }
  document.head.appendChild(script)

  initialized = true
}

/** Aggiorna lo stato di consenso su GTM (Google Consent Mode v2). */
export function updateConsent(consent: { analytics: boolean; ads: boolean }): void {
  if (typeof window === 'undefined') return
  pushToDataLayer({
    consent: 'update',
    ad_storage: consent.ads ? 'granted' : 'denied',
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_user_data: consent.ads ? 'granted' : 'denied',
    ad_personalization: consent.ads ? 'granted' : 'denied',
  })
}

export function pushToDataLayer(args: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  ensureDataLayer()
  window.dataLayer!.push(args)
}

/** Propagazione contesto utente/evento/stand nel dataLayer per la segmentazione in GTM. */
export function setAnalyticsContext(context: PageContext | null): void {
  if (typeof window === 'undefined') return
  pushToDataLayer({
    event: 'context_set',
    user_role: context?.role ?? 'guest',
    user_logged_in: Boolean(context && context.role && context.role !== 'guest'),
    analytics_event_id: context?.eventId ?? '',
    analytics_stand_id: context?.standId ?? '',
  })
}

export function trackPageView(path: string, title?: string): void {
  pushToDataLayer({
    event: 'page_view',
    page_path: path,
    page_title: title ?? document.title,
  })
}
