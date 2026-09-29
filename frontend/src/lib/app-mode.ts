/**
 * La PWA clienti (/customers/) e' una build separata (main-customers.tsx +
 * customer-router) senza le rotte admin. Diversi componenti condivisi
 * (PublicHeader, PublicBottomBar, LoginPage, RegisterPage) hanno pero' dei
 * rimandi verso la dashboard operatore che in PWA porterebbero a un 404:
 * qui viene rilevato il contesto per nasconderli o sostituirli col profilo
 * utente classico.
 *
 * Si basa sul path invece che su un flag di build: cosi' funziona anche in
 * dev, dove la PWA e' servita su '/' con lo stesso router.
 */
export const CUSTOMERS_BASE_PATH = '/customers/'

/** Pathname corrente, normalizzata con slash iniziale. */
function currentPathname(): string {
  if (typeof window === 'undefined') return '/'
  const { pathname } = window.location
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

/** true quando l'app sta girando come PWA clienti (/customers/...). */
export function isCustomersPwa(): boolean {
  return currentPathname().startsWith(CUSTOMERS_BASE_PATH)
}

/**
 * Destinazione della home/mappa dell'app: nella PWA il percorso e' gia'
 * prefissato dal basename '/customers', quindi '/customers'.
 */
export function customersHome(): string {
  return '/customers'
}
