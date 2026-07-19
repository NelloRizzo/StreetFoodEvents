import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

const PORT = process.env.PORT ?? 3000
const DIST = join(import.meta.dirname, 'dist')

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
}

createServer((req, res) => {
  let path = req.url === '/' ? '/index.html' : req.url
  let filePath = join(DIST, path)

  if (!existsSync(filePath)) {
    filePath = join(DIST, 'index.html')
  }

  const ext = extname(filePath)
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

  createReadStream(filePath).pipe(res)
}).listen(PORT, () => {
  console.log(`Static server on :${PORT}`)
})
