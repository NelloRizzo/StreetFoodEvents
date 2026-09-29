/* Verifica in Chrome che il toggle tracking (pulsante "Abilita tracking")
   compaia nel sito operatore e NON nella PWA clienti.

   Uso (la build di produzione usa base /streetfoodevents/, ma server.mjs
   serve l'operatore alla root: serve ricostruire con base "/" per poter
   raggiungere il bundle operatori):
     $env:VITE_BASE_URL='/'; npm run build
     node scripts/pwa-tracking.mjs
     npm run build            # ripristina la build di produzione

   L'utente e' simulato admin via stub di /auth/me e /auth/me/roles: senza
   un utente autenticato il gate dei ruoli salta e il toggle resterebbe
   nascorso in entrambi i contesti, rendendo il confronto privo di senso. */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 4178
const DEBUG_PORT = 9337
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
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error')
    return r.result?.value
  }
}

const PROBE = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find((b) => /tracking/i.test(b.getAttribute('aria-label') || ''))
  return { found: !!btn, label: btn ? btn.getAttribute('aria-label') : null }
})()`

const DEBUG = `(() => ({
  path: location.pathname,
  text: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 160),
  labels: [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || '').filter(Boolean),
  errors: window.__errs || [],
  rootChildren: (() => { const r = document.getElementById('root'); return r ? r.children.length : -1 })(),
  scripts: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
  title: document.title,
}))()`

/* isCustomersPwa() legge window.location.pathname, quindi lo stub e' installato
   una volta sola e non dipende dal path. Stubbiamo /auth/me e /auth/me/roles
   cosi' la pagina si comporta come un ADMIN collegato: senza utente
   autenticato il gate dei ruoli salta e il toggle resterebbe nascosto in
   entrambi i contesti, rendendo il confronto privo di significato. */
const STUB = `(() => {
  window.__errs = []
  window.addEventListener('error', (e) => window.__errs.push('error: ' + (e.message || e.type)))
  window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection: ' + (e.reason && e.reason.message || e.reason)))
  const orig = window.fetch
  const json = (body) => Promise.resolve(new Response(
    JSON.stringify(body),
    { status: 200, headers: { 'content-type': 'application/json' } },
  ))
  window.fetch = function (input) {
    const url = typeof input === 'string' ? input : (input && input.url) || ''
    if (url.includes('/auth/me/roles')) {
      return json({ isPlatformAdmin: true, roles: [{ slug: 'event-admin', scope: 'event' }] })
    }
    if (url.includes('/auth/me/stands')) return json({ stands: [] })
    if (url.includes('/auth/me')) {
      return json({ user: { id: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'B' } })
    }
    return orig.apply(this, arguments)
  }
})()`

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'pwa-track-'))
  const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' })
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'], { stdio: 'ignore' })
  const cleanup = () => { try { server.kill() } catch {}; try { chrome.kill() } catch {}; try { rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.on('exit', cleanup)

  await sleep(2500)
  const cdp = await Cdp.attach(DEBUG_PORT)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: STUB })

  let failures = 0
  const check = (name, cond, extra = '') => {
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
    if (!cond) failures++
  }

  for (const [label, url, shouldShow] of [
    ['[1] PWA clienti', `/customers/events/1`, false],
    ['[2] sito operatore', `/events/1`, true],
    ['[3] slideshow in PWA', `/customers/events/1/slideshow`, false],
    ['[4] slideshow operatore', `/events/1/slideshow`, true],
  ]) {
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}${url}` })
    await sleep(5000)
    const res = await cdp.eval(PROBE)
    const dbg = await cdp.eval(DEBUG)
    console.log(`\n${label} ${url} (admin simulato)`)
    console.log(`  debug: ${JSON.stringify(dbg)}`)
    check(shouldShow ? 'toggle tracking presente' : 'nessun toggle tracking', res.found === shouldShow, JSON.stringify(res))
    if (shouldShow) check('etichetta "Abilita tracking"', res.label === 'Abilita tracking', String(res.label))
  }

  console.log(`\n${failures === 0 ? 'OK' : failures + ' CHECK FALLITI'}`)
  cleanup()
  process.exit(failures === 0 ? 0 : 1)
}
main()
