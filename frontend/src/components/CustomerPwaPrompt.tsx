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
export function CustomerPwaPrompt() {
  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW()
  const [installEvt, setInstallEvt] = useState<BeforeInstallPrompt | null>(null)
  const [showIos, setShowIos] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  /* Il banner di installazione resta finche' l'utente non installa o non
     chiude: `showInstall` non deve dipendere da `installEvt`, altrimenti il
     ramo col bottone "Installa l'app" (quando l'evento e' disponibile)
     diventerebbe irraggiungibile. */
  const showInstall = !isStandalone() && !dismissed

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as BeforeInstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const onInstall = async () => {
    if (!installEvt) return
    await installEvt.prompt()
    const { outcome } = await installEvt.userChoice
    if (outcome === 'accepted') setDismissed(true)
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

  if (isStandalone() && !installEvt && !needRefresh && !offlineReady) return null

  return (
    <div className={styles.root}>
      {offlineReady && <p className={styles.toast}>App pronta: funzionerà anche offline.</p>}
      {needRefresh && (
        <p className={styles.banner}>
          {isUpdating ? (
            'Aggiornamento in corso...'
          ) : (
            <>
              <span>È disponibile un aggiornamento.</span>{' '}
              <button onClick={onUpdate}>Aggiorna</button>
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
        </p>
      )}
    </div>
  )
}
