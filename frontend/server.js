import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const port = process.env.PORT || 5173

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

function safePath(root, segments) {
  const full = path.join(root, ...segments)
  if (!full.startsWith(root)) return null
  return full
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  let pathname = url.pathname

  // 1. Volantino — serve dalla directory dist/volantino/
  if (pathname === '/volantino' || pathname === '/volantino/') {
    const f = path.join(dist, 'volantino', 'index.html')
    if (fs.existsSync(f)) return serveFile(res, f)
  }
  if (pathname.startsWith('/volantino/') && pathname.length > 11) {
    const sub = pathname.slice(11)
    const f = safePath(path.join(dist, 'volantino'), [sub])
    if (f && fs.existsSync(f) && fs.statSync(f).isFile()) return serveFile(res, f)
  }

  // 2. File statico esatto (root della SPA)
  const staticPath = pathname === '/' ? path.join(dist, 'index.html') : path.join(dist, pathname)
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return serveFile(res, staticPath)
  }

  // 3. SPA fallback
  const spaIndex = path.join(dist, 'index.html')
  if (fs.existsSync(spaIndex)) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return fs.createReadStream(spaIndex).pipe(res)
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(port, () => {
  console.log(`Frontend static server on :${port}`)
})
