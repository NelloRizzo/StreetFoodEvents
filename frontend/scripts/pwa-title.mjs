/* Ispeziona il titolo della PWA: document.title, <title> nel DOM, occorrenze
   del brand nel testo visibile e contenuto del manifest.
   --hard  simula Ctrl+F5 (bypassa il service worker con Cache-Control: no-cache
           e Network.setCacheDisabled). */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 4177
const ORIGIN = `http://localhost:${PORT}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map() }
  static async attach(port) {
    const t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = t.find((x) => x.type === 'page')
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    const c = new Cdp(ws)
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data)
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id)
        c.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    }
    return c
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)) } }, 30000)
    })
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails))
    return r.result.value
  }
}

const PROBE = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim()
  const matches = [...document.querySelectorAll('header, footer, h1, h2, .title, [class*=brand]')]
    .map((el) => ({ tag: el.tagName, cls: el.className, text: norm(el.textContent).slice(0, 80) }))
    .filter((x) => /street\\s*food\\s*events/i.test(x.text))
  return {
    documentTitle: document.title,
    titleTags: [...document.querySelectorAll('title')].map((t) => t.textContent),
    brandOccurrences: matches,
  }
})()`

async function main() {
  const hard = process.argv.includes('--hard')
  const profile = mkdtempSync(join(tmpdir(), 'pwa-title-'))
  const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' })
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=9336', 'about:blank'], { stdio: 'ignore' })
  const cleanup = () => { try { server.kill() } catch {}; try { chrome.kill() } catch {}; try { rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.on('exit', cleanup)

  await sleep(2500)
  const cdp = await Cdp.attach(9336)
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable')
  if (hard) await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

  await cdp.send('Page.navigate', { url: `${ORIGIN}/customers/` })
  await sleep(4000)
  if (hard) {
    /* secondo passaggio "hard reload" sullo stesso URL */
    await cdp.send('Page.reload', { ignoreCache: true })
    await sleep(4000)
  }

  console.log(`\n=== ${hard ? 'HARD RELOAD (Ctrl+F5)' : 'reload normale'} ===`)
  console.log(JSON.stringify(await cdp.eval(PROBE), null, 2))
  const mf = await cdp.send('Page.getResourceContent', { frameId: (await cdp.send('Page.getFrameTree')).frameTree.frame.id, url: `${ORIGIN}/customers/manifest.webmanifest` }).catch(() => null)
  if (mf?.content) console.log('manifest:', mf.content)
  cleanup(); process.exit(0)
}
main()
