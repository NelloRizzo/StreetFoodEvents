import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/streetfoodevents/',
  plugins: [
    react(),
    {
      name: 'spa-fallback',
      apply: 'build',
      closeBundle() {
        const fs = require('node:fs')
        const path = require('node:path')
        const distIndex = path.resolve(__dirname, 'dist', 'index.html')
        const dist404 = path.resolve(__dirname, 'dist', '404.html')
        if (fs.existsSync(distIndex)) {
          fs.copyFileSync(distIndex, dist404)
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
})
