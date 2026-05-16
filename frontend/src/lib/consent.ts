export interface Consent {
  necessary: true
  analytics: boolean
  ads: boolean
}

const STORAGE_KEY = 'sfe-consent'

const DEFAULT: Consent = { necessary: true, analytics: false, ads: false }

export function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Consent>
    if (parsed && parsed.necessary === true) {
      return { necessary: true, analytics: parsed.analytics ?? false, ads: parsed.ads ?? false }
    }
    return null
  } catch {
    return null
  }
}

export function setConsent(c: Consent): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
}

export function acceptAll(): void {
  setConsent({ necessary: true, analytics: true, ads: true })
}

export function rejectAll(): void {
  setConsent({ ...DEFAULT })
}

export function hasConsent(): boolean {
  return getConsent() !== null
}
