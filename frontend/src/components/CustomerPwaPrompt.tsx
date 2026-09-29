import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import styles from './CustomerPwaPrompt.module.scss'

type BeforeInstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true)

/* Customers PWA prompt (vite-plugin-pwa, registerType 'prompt'):
   - "Need refresh" → banner "Aggiorna per attivare la nuova versione" (reload).
   - "Offline ready" → toast "App pronta per funzionare offline".
   - Install prompt: cattura beforeinstallprompt (Android/desktop) e mostra
     istruzioni "Aggiungi alla Home" su iOS. */
/* Attenzione: `useRegisterSW` di vite-plugin-pwa espone `needRefresh` e
   `offlineReady` come TUPLA [valore, setter] (non come booleano). Se li si
   destruttura come booleani si ottiene un array, che in JS e' sempre truthy:
   i due banner ("App pronta" e "C'è un aggiornamento") resterebbero quindi
   visibili per sempre, anche senza alcun aggiornamento reale. */
type SwFlag = boolean | [boolean, (value: boolean) => void]

const flagValue = (value: SwFlag | undefined): boolean =>
  Array.isArray(value) ? Boolean(value[0]) : Boolean(value)

const INSTALL_DISMISSED_KEY = 'sfe_customers_install_dismissed'

export function CustomerPwaPrompt() {
  const sw = useRegisterSW() as unknown as {
    needRefresh?: SwFlag
    offlineReady?: SwFlag
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  }
  const updateServiceWorker = sw.updateServiceWorker
  const needRefresh = flagValue(sw.needRefresh)
  const offlineReady = flagValue(sw.offlineReady)

  const [installEvt, setInstallEvt] = useState<BeforeInstallPrompt | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showOfflineToast, setShowOfflineToast] = useState(false)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })

  /* Il banner di installazione resta finche' l'utente non installa o non
     chiude: `showInstall` non deve dipendere da `installEvt`, altrimenti il
     ramo col bottone "Installa l'app" (quando l'evento e' disponibile)
     diventerebbe irraggiungibile. */
  const showInstall = !isStandalone() && !installDismissed

  /* "App pronta" e' un toast: sparisce da solo dopo qualche secondo e puo'
     essere chiuso a mano, altrimenti resta appiccicato in fondo alla pagina. */
  useEffect(() => {
    if (!offlineReady) return
    setShowOfflineToast(true)
    const timer = window.setTimeout(() => setShowOfflineToast(false), 5000)
    return () => window.clearTimeout(timer)
  }, [offlineReady])

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as BeforeInstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismissInstall = () => {
    setInstallDismissed(true)
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    } catch {
      /* storage non disponibile: basta lo stato locale */
    }
  }

  const onInstall = async () => {
    if (!installEvt) return
    await installEvt.prompt()
    const { outcome } = await installEvt.userChoice
    if (outcome === 'accepted') dismissInstall()
    setInstallEvt(null)
  }

  /* updateServiceWorker(true) -> il SW riceve SKIP_WAITING e si attiva; con
     clientsClaim il nuovo SW prende il controllo della pagina, scatta
     controllerchange e workbox-window ricarica da solo. Se pero' il reload
     non arriva (per es. controllerchange non supportato, o un'altra scheda
     tiene il vecchio SW) il banner resterebbe fisso per sempre: qui si
     forza il reload dopo una breve attesa. */
  const onUpdate = async () => {
    if (isUpdating) return
    setIsUpdating(true)
    try {
      await updateServiceWorker(true)
    } catch {
      /* registro non riuscito: il reload forzato sotto chiude il ciclo */
    }
    window.setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  if (isStandalone() && !installEvt && !needRefresh && !showOfflineToast) return null

  return (
    <div className={styles.root}>
      {showOfflineToast && (
        <p className={styles.toast}>
          <span>App pronta: funzionerà anche offline.</span>{' '}
          <button
            className={styles.close}
            onClick={() => setShowOfflineToast(false)}
            aria-label="Chiudi"
          >
            ×
          </button>
        </p>
      )}
      {needRefresh && !updateDismissed && (
        <p className={styles.banner}>
          {isUpdating ? (
            'Aggiornamento in corso...'
          ) : (
            <>
              <span>È disponibile un aggiornamento.</span>{' '}
              <button onClick={onUpdate}>Aggiorna</button>
              <button
                className={styles.close}
                onClick={() => setUpdateDismissed(true)}
                aria-label="Chiudi"
              >
                ×
              </button>
            </>
          )}
        </p>
      )}
      {showInstall && (
        <p className={styles.banner}>
          {installEvt ? (
            <button onClick={onInstall}>📲 Installa l'app</button>
          ) : (
            <>
              <button onClick={() => setShowIos(true)}>📲 Aggiungi alla Home</button>
              {showIos && (
                <span className={styles.hint}>
                  Tocca il pulsante Condividi in Safari e scegli «Aggiungi a Home».
                </span>
              )}
            </>
          )}
          <button
            className={styles.close}
            onClick={dismissInstall}
            aria-label="Chiudi"
          >
            ×
          </button>
        </p>
      )}
    </div>
  )
}
