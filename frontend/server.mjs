import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, normalize, sep } from 'node:path'

const PORT = process.env.PORT ?? 3000
const DIST = join(import.meta.dirname, 'dist')
const DIST_CUSTOMERS = join(import.meta.dirname, 'dist-customers')
const CUSTOMERS_PREFIX = '/customers'

/* Serves the two static builds built by Vite in the same repo:
   - dist/          → operator app (SPA, served at /)
   - dist-customers → customers PWA (SPA + installable, served at /customers/)
   Both are client-side routed: any path not matching a real file falls back
   to that app's index.html (SPA). */

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

/* Files with a stable name that must ALWAYS be revalidated, never cached
   immutably:
   - sw.js               the service worker script: the browser must see a new
                         version immediately, otherwise clients stay pinned to
                         the old worker (and the "update available" prompt
                         never resolves);
   - *.webmanifest       the PWA manifest, same reason;
   - *.html              the SPA shell, so a deploy is picked up on reload.
   The asset files in /assets/ are content-hashed, so those can safely stay
   immutable. */
function cacheControlFor(filePath) {
  const name = filePath.slice(filePath.lastIndexOf(sep) + 1)
  if (name === 'sw.js') return 'no-cache'
  const ext = extname(filePath)
  if (ext === '.html' || ext === '.webmanifest') return 'no-cache'
  return 'public, max-age=31536000, immutable'
}

/* Resolve a path inside `dist` honoring the SPA fallback: if the requested
   file doesn't exist (or is a directory) we serve index.html instead, and we
   never allow escaping the dist root (path-traversal guard). */
function spaFile(dist, rel) {
  const indexPath = join(dist, 'index.html')
  const requested = join(dist, normalize(rel).replace(/^[\\/]+/, ''))
  if (
    requested.startsWith(dist + sep) &&
    existsSync(requested) &&
    !statSync(requested).isDirectory()
  ) {
    return requested
  }
  return indexPath
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const { pathname } = url

  const isCustomers = pathname === CUSTOMERS_PREFIX || pathname.startsWith(CUSTOMERS_PREFIX + '/')
  const dist = isCustomers ? DIST_CUSTOMERS : DIST

  let rel = isCustomers ? pathname.slice(CUSTOMERS_PREFIX.length) : pathname
  if (rel === '') rel = '/'

  const filePath = spaFile(dist, rel)

  const ext = extname(filePath)
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
  res.setHeader('Cache-Control', cacheControlFor(filePath))

  createReadStream(filePath).pipe(res)
}).listen(PORT, () => {
  console.log(`StreetFoodEvents server :${PORT} — operatori / , customers PWA /customers/`)
})
