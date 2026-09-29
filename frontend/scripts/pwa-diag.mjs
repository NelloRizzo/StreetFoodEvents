/* Diagnostica: perché il banner "È disponibile un aggiornamento" compare
   anche alla PRIMA visita, quando non c'è nessun aggiornamento reale.
   Inietta un probe PRIMA che l'app carichi (addScriptToEvaluateOnNewDocument)
   e registra tutti gli eventi del ciclo di vita del service worker. */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 4174
const ORIGIN = `http://localhost:${PORT}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map() }
  static async attach(port) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = targets.find((t) => t.type === 'page')
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
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
}

const PROBE = `
window.__swLog = []
const push = (m) => { try { window.__swLog.push(m) } catch (e) {} }
push('probe installato, controller iniziale=' + !!navigator.serviceWorker.controller)

const origRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker)
navigator.serviceWorker.register = function (...args) {
  push('register() chiamato con ' + args[0])
  return origRegister(...args).then((reg) => {
    push('register() risolto, scope=' + reg.scope)
    const track = (sw, tag) => {
      if (!sw) return
      push(tag + ' sw=' + sw.scriptURL.split('/').pop() + ' stato=' + sw.state)
      sw.addEventListener('statechange', () => {
        push('  statechange -> ' + sw.state + ' (' + sw.scriptURL.split('/').pop() + ')')
      })
    }
    if (reg.installing) track(reg.installing, 'installing')
    reg.addEventListener('updatefound', () => {
      push('updatefound! nuovo SW installing')
      track(reg.installing, '  installing')
    })
    return reg
  })
}

navigator.serviceWorker.addEventListener('controllerchange', () => {
  push('controllerchange! controller=' + (navigator.serviceWorker.controller?.scriptURL.split('/').pop() ?? 'null'))
})
navigator.serviceWorker.addEventListener('message', (e) => {
  push('message dal SW: ' + JSON.stringify(e.data))
})
`

async function main() {
  if (!existsSync(join(ROOT, 'dist-customers', 'sw.js'))) throw new Error('lancia prima npm run build:customers')
  const profile = mkdtempSync(join(tmpdir(), 'pwa-diag-'))
  const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' })
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=9334', 'about:blank'], { stdio: 'ignore' })
  const cleanup = () => { try { server.kill() } catch {} ; try { chrome.kill() } catch {} ; try { rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.on('exit', cleanup)

  await sleep(2500)
  const cdp = await Cdp.attach(9334)
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE })

  console.log('\n=== PRIMA VISITA ===')
  await cdp.send('Page.navigate', { url: `${ORIGIN}/customers/` })
  await sleep(5000)
  console.log((await cdp.eval('window.__swLog.join("\\n")')) || '(nessun evento)')
  const b1 = await cdp.eval(`[...document.querySelectorAll('p')].map(p=>p.textContent.trim())`)
  console.log('banner:', JSON.stringify(b1))

  console.log('\n=== SECONDA VISITA (stesso SW, nessun deploy) ===')
  await cdp.send('Page.navigate', { url: `${ORIGIN}/customers/` })
  await sleep(4000)
  console.log((await cdp.eval('window.__swLog.join("\\n")')) || '(nessun evento)')
  const b2 = await cdp.eval(`[...document.querySelectorAll('p')].map(p=>p.textContent.trim())`)
  console.log('banner:', JSON.stringify(b2))

  cleanup()
  process.exit(0)
}
main()
