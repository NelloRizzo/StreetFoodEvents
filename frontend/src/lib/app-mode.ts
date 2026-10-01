/**
 * La PWA clienti (/customers/) e' una build separata (main-customers.tsx +
 * customer-router) senza le rotte admin. Diversi componenti condivisi
 * (PublicHeader, PublicBottomBar, LoginPage, RegisterPage) hanno pero' dei
 * rimandi verso la dashboard operatore che in PWA porterebbero a un 404:
 * qui viene rilevato il contesto per nasconderli o sostituirli col profilo
 * utente classico.
 *
 * Il riconoscimento usa prima un flag di build e, in dev, il path: cosi'
 * funziona anche senza flag, quando la PWA e' servita su '/' con lo stesso
 * router.
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
  /* Flag di build (impostato solo da vite.customer.config.ts): e' l'unico
     segnale che non dipende da come e' scritto l'URL. */
  if (import.meta.env.VITE_CUSTOMERS_BUILD === 'true') return true

  const path = currentPathname()
  /* Anche `/customers` senza slash finale: e' la home che restituisce
     `customersHome()`, e su quell'URL un confronto con il solo prefisso
     con slash darebbe false — la PWA si credeva il sito operatore e
     rimandava a /dashboard, che risolve nella dashboard admin dell'altra
     build (stesso origine, basi diverse). */
  return path === CUSTOMERS_BASE_PATH.slice(0, -1) || path.startsWith(CUSTOMERS_BASE_PATH)
}

/**
 * Destinazione della home/mappa dell'app: nella PWA il percorso e' gia'
 * prefissato dal basename '/customers', quindi '/customers'.
 */
export function customersHome(): string {
  return '/customers'
}
