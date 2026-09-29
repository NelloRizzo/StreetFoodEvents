/* Stub del modulo virtuale `virtual:pwa-register/react`.
   Vite lo risolve solo tramite il plugin VitePWA (build customers): nei test
   non esiste, quindi va sostituito con questo mock. */
export const useRegisterSW = () =>
  ({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }) as never
