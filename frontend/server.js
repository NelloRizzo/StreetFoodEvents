import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const port = process.env.PORT || 5173

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

function serve(res, filePath) {
  const ext = path.extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  let pathname = url.pathname

  // Flyer — serve sempre flyer/index.html per qualsiasi /flyer*
  if (pathname === '/flyer' || pathname === '/flyer/') {
    const f = path.join(dist, 'flyer', 'index.html')
    if (fs.existsSync(f)) return serve(res, f)
  }
  if (pathname.startsWith('/flyer/')) {
    const sub = pathname.replace('/flyer/', '')
    const f = path.join(dist, 'flyer', sub || 'index.html')
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return serve(res, f)
  }

  // File statico dalla root di dist
  if (pathname === '/') pathname = 'index.html'
  const staticPath = path.join(dist, pathname)
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    return serve(res, staticPath)
  }

  // SPA fallback
  const spa = path.join(dist, 'index.html')
  if (fs.existsSync(spa)) return serve(res, spa)

  res.writeHead(404)
  res.end('Not found')
}).listen(port, () => console.log(`Server on :${port}`))
