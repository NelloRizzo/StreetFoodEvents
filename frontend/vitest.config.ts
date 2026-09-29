import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    /* `virtual:pwa-register/react` esiste solo quando gira il plugin VitePWA
       (build customers). Nei test non viene risolto: si punta a uno stub, che
       i singoli test sovrascrivono con vi.mock. */
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/__tests__/helpers/pwa-register-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/helpers/setup.ts'],
    css: true,
  },
})
