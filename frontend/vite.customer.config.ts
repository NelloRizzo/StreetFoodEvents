import { resolve } from 'node:path'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/* Customers PWA — public+standalone routes only, installable + offline app-shell.
   Build output → dist-customers/, served by server.mjs at /customers/.
   Shared codebase with the operator app (same source), just a different
   entry (customers.html + main-customers.tsx) and basename '/customers'. */
export default defineConfig(({ command }) => {
  const isBuild = command === 'build'
  return {
    base: isBuild ? '/customers/' : '/',
    /* La PWA si riconosce anche da un flag di build, non solo dal path: con il
       solo path, `/customers` (senza slash finale) non era riconosciuto e la
       PWA si credeva il sito operatore — comparivano i link "Operatore",
       il tab profilo apriva il menu della web app e dopo il login si
       atterrava su /dashboard, che a stessa origine risolve nella dashboard
       admin dell'altra build. `define` sostituisce il token nel bundle, quindi
       nel sito operatore il codice morto viene eliminato dal tree-shaking. */
    define: {
      'import.meta.env.VITE_CUSTOMERS_BUILD': JSON.stringify('true'),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['pwa-icon.svg', 'pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Street Food Events',
          short_name: 'Street Food Events',
          description: 'Menu, mappa, ordini, recensioni e foto degli stand di street food.',
          lang: 'it',
          theme_color: '#bf5a2a',
          background_color: '#fff8f2',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/customers/?source=pwa',
          scope: '/customers/',
          icons: [
            { src: '/customers/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: '/customers/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/customers/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/customers/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/customers/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
          cleanupOutdatedCaches: true,
          navigateFallback: '/customers/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          /* registerType 'prompt': skipWaiting resta false (l'aggiornamento
             parte solo quando l'utente preme "Aggiorna"), ma clientsClaim
             deve essere true. Senza, il nuovo SW si attiva senza prendere il
             controllo della pagina, l'evento controllerchange non scatta e
             quindi il reload automatico non avviene mai: il banner
             "aggiornamento disponibile" resterebbe fisso e il pulsante
             sembrerebbe non fare nulla. */
          clientsClaim: true,
        },
        devOptions: {
          enabled: true,
          navigateFallback: '/customers/customers.html',
        },
      }),
      /* SPA fallback: customers.html → index.html (+404.html) in dist-customers
         so navigateFallback && /customers/* routes resolve client-side. */
      {
        name: 'customers-spa-fallback',
        apply: 'build',
        closeBundle() {
          const out = resolve(__dirname, 'dist-customers')
          const src = resolve(out, 'customers.html')
          if (existsSync(src)) {
            copyFileSync(src, resolve(out, 'index.html'))
            copyFileSync(src, resolve(out, '404.html'))
            console.log('✓ dist-customers: customers.html → index.html + 404.html (SPA fallback)')
          }
        },
      },
    ],
    build: {
      outDir: 'dist-customers',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          customers: resolve(__dirname, 'customers.html'),
        },
      },
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
        },
      },
    },
  }
})
