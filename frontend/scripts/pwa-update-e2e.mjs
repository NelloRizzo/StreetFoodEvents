/* E2E reale del ciclo di aggiornamento della PWA clienti.
   Pilota Chrome headless via CDP (WebSocket nativo di Node 22+, nessuna dipendenza).
   Simula: 1) prima visita (installa SW), 2) deploy con sw.js nuovo,
   3) click su "Aggiorna", 4) verifica che la pagina si ricarichi davvero.

   Uso: node scripts/pwa-update-e2e.mjs [--keep]                                     */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 4173
const ORIGIN = `http://localhost:${PORT}`
const SW = join(ROOT, 'dist-customers', 'sw.js')
const SW_BACKUP = join(tmpdir(), 'pwa-e2e-sw-backup.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)

/* ── minimal CDP client ─────────────────────────────────────────────── */
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [] }
  static async attach(port) {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`)
    const targets = await res.json()
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
      } else if (msg.method) c.events.push(msg)
    }
    return c
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)) }
      }, 30000)
    })
  }
  /* evaluate nel main world, con awaitPromise */
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails))
    return r.result.value
  }
  async navigate(url) {
    await this.send('Page.navigate', { url })
    await sleep(1200)
  }
}

/* Legge lo stato dei banner direttamente dal DOM, come farebbe l'utente. */
const READ_BANNERS = `(() => {
  const texts = [...document.querySelectorAll('p')].map((p) => p.textContent.trim())
  return {
    offline: texts.find((t) => /App pronta/i.test(t)) ?? null,
    update: texts.find((t) => /aggiornamento|aggiorna/i.test(t)) ?? null,
    hasUpdateBtn: [...document.querySelectorAll('button')].some((b) => /^\\s*Aggiorna\\s*$/i.test(b.textContent)),
  }
})()`

async function main() {
  if (!existsSync(SW)) throw new Error('dist-customers/sw.js mancante: lancia prima npm run build:customers')
  writeFileSync(SW_BACKUP, readFileSync(SW))

  const profile = mkdtempSync(join(tmpdir(), 'pwa-e2e-'))
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
  })
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--remote-debugging-port=9333', 'about:blank',
  ], { stdio: 'ignore' })

  const cleanup = () => {
    try { server.kill() } catch {}
    try { chrome.kill() } catch {}
    try { writeFileSync(SW, readFileSync(SW_BACKUP)) } catch {}
    if (!process.argv.includes('--keep')) { try { rmSync(profile, { recursive: true, force: true }) } catch {} }
  }
  process.on('exit', cleanup); process.on('SIGINT', () => { cleanup(); process.exit(1) })

  await sleep(2500)
  const cdp = await Cdp.attach(9333)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  const consoleErrors = []
  setInterval(() => {
    for (const e of cdp.events.splice(0)) {
      if (e.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(e.params.exceptionDetails?.exception?.description ?? 'unknown')
      }
    }
  }, 200).unref()

  let failures = 0
  const check = (name, cond, extra = '') => {
    log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
    if (!cond) failures++
  }

  try {
    /* ── 1) prima visita: il SW si installa, nessun aggiornamento pendente ── */
    log('\n[1] Prima visita (installazione SW)')
    await cdp.navigate(`${ORIGIN}/customers/`)
    await sleep(3500)

    const reg1 = await cdp.eval(`navigator.serviceWorker.getRegistrations().then(rs => rs.map(r => ({
      scope: r.scope, active: !!r.active, waiting: !!r.waiting, installing: !!r.installing,
    })))`)
    log('  registrazioni:', JSON.stringify(reg1))
    check('SW attivo', reg1.some((r) => r.active))
    check('nessun SW in attesa dopo la prima installazione', !reg1.some((r) => r.waiting), 'waiting =', reg1.some((r) => r.waiting))

    const b1 = await cdp.eval(READ_BANNERS)
    log('  banner:', JSON.stringify(b1))
    check('nessun banner "aggiornamento" alla prima visita', !b1.update, `update=${JSON.stringify(b1.update)}`)

    const controlled1 = await cdp.eval(`!!navigator.serviceWorker.controller`)
    check('pagina controllata dal SW (clientsClaim ha preso il controllo)', controlled1)

    /* ── 2) deploy: nuovo sw.js, il browser lo rileva come aggiornamento ── */
    log('\n[2] Deploy (sw.js modificato, come dopo un nuovo deploy)')
    const original = readFileSync(SW, 'utf8')
    writeFileSync(SW, original + '\n// e2e build marker ' + Date.now() + '\n')
    await cdp.navigate(`${ORIGIN}/customers/`)
    await sleep(4000)

    const b2 = await cdp.eval(READ_BANNERS)
    log('  banner:', JSON.stringify(b2))
    check('compare il banner "È disponibile un aggiornamento"', !!b2.update, `update=${JSON.stringify(b2.update)}`)
    check('compare il pulsante "Aggiorna"', b2.hasUpdateBtn)

    const reg2 = await cdp.eval(`navigator.serviceWorker.getRegistrations().then(rs => rs.map(r => ({
      active: !!r.active, waiting: !!r.waiting,
    })))`)
    check('esiste un SW in attesa (waiting)', reg2.some((r) => r.waiting), JSON.stringify(reg2))

    /* ── 3) click su "Aggiorna": deve scattare il reload ── */
    log('\n[3] Click su "Aggiorna"')
    /* Il reload va rilevato con un contatore in sessionStorage, che sopravvive
       alla navigazione: un marker su window verrebbe perso dal reload stesso
       (e tornerebbe -1). Lo script gira a ogni nuovo documento. */
    const loadsScript = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { sessionStorage.setItem('e2e-loads', String((+sessionStorage.getItem('e2e-loads') || 0) + 1)) } catch (e) {}`,
    })
    const loadsBefore = await cdp.eval(`(() => { try { sessionStorage.setItem('e2e-loads', '0') } catch (e) {}; return 0 })()`)
    void loadsBefore

    const clicked = await cdp.eval(`(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /^\\s*Aggiorna\\s*$/i.test(b.textContent))
      if (!btn) return false
      btn.click()
      return true
    })()`)
    check('click eseguito sul pulsante "Aggiorna"', clicked)

    await sleep(4000)
    const after = await cdp.eval(`(() => ({
      loads: +sessionStorage.getItem('e2e-loads') || 0,
      controlled: !!navigator.serviceWorker.controller,
      url: location.pathname,
    }))()`)
    log('  dopo il click:', JSON.stringify(after))
    check('la pagina si è ricaricata (reload automatico scattato)', after.loads >= 1, `loads=${after.loads}`)
    check('la pagina resta sotto controllo del SW dopo l\'update', after.controlled)
    check('l\'URL non è alterato', after.url === '/customers/', after.url)
    try { await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: loadsScript.identifier }) } catch {}

    await sleep(1500)
    const b3 = await cdp.eval(READ_BANNERS)
    log('  banner finali:', JSON.stringify(b3))
    check('il banner "aggiornamento" è sparito dopo l\'update', !b3.update, `update=${JSON.stringify(b3.update)}`)

    const reg3 = await cdp.eval(`navigator.serviceWorker.getRegistrations().then(rs => rs.map(r => ({
      active: !!r.active, waiting: !!r.waiting,
    })))`)
    check('nessun SW residuo in attesa', !reg3.some((r) => r.waiting), JSON.stringify(reg3))

    if (consoleErrors.length) {
      log('\n  eccezioni JS in console:', consoleErrors.slice(0, 5))
    }
  } catch (e) {
    log('\n  ERRORE:', e.message)
    failures++
  } finally {
    cleanup()
  }

  log(`\n${failures === 0 ? 'TUTTI I CHECK PASSATI' : failures + ' CHECK FALLITI'}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
