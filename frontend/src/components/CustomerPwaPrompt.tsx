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

  const showInstall = !installEvt && !isStandalone() && !dismissed

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

  if (isStandalone() && !installEvt && !needRefresh && !offlineReady) return null

  return (
    <div className={styles.root}>
      {offlineReady && <p className={styles.toast}>App pronta: funzionerà anche offline.</p>}
      {needRefresh && (
        <p className={styles.banner}>
          Nuova versione disponibile.{' '}
          <button onClick={() => updateServiceWorker(true)}>Aggiorna</button>
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
