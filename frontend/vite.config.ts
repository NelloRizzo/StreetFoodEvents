import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'

export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? (process.env.VITE_BASE_URL ?? '/streetfoodevents/') : '/',
    plugins: [
      react(),
      {
        name: 'spa-fallback',
        apply: 'build',
        closeBundle() {
          const distIndex = new URL('./dist/index.html', import.meta.url)
          const dist404 = new URL('./dist/404.html', import.meta.url)
          if (existsSync(distIndex)) {
            copyFileSync(distIndex, dist404)
            console.log('✓ Copiato index.html → 404.html per SPA routing')
          }
        },
      },
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
        },
      },
    },
  }
})
