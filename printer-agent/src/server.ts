import express from 'express'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { PrintJob, PrinterStatus } from './types.js'
import { generateEscpos, renderAsText } from './escpos.js'

const PORT = parseInt(process.env.PORT ?? '9300', 10)
const PRINTER_DEVICE = process.env.PRINTER_DEVICE ?? '/dev/usb/lp0'
const PRINTER_MODE = (process.env.PRINTER_MODE ?? 'usb') as 'usb' | 'file' | 'none'
const PRINTS_DIR = process.env.PRINTS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'prints')

const app = express()
app.use(express.json({ limit: '100kb' }))

function writeToPrinter(data: Uint8Array): void {
  if (PRINTER_MODE === 'none') return
  if (PRINTER_MODE === 'file') {
    if (!existsSync(PRINTS_DIR)) mkdirSync(PRINTS_DIR, { recursive: true })
    const filename = `print-${Date.now()}.bin`
    const filepath = join(PRINTS_DIR, filename)
    writeFileSync(filepath, data)
    console.log(`  → written to ${filepath}`)
    return
  }
  writeFileSync(PRINTER_DEVICE, data)
}

app.get('/health', (_req, res) => {
  const online = PRINTER_MODE === 'usb' ? existsSync(PRINTER_DEVICE) : true
  const status: PrinterStatus = {
    online,
    printer: PRINTER_MODE === 'usb' ? PRINTER_DEVICE : `mode:${PRINTER_MODE}`,
    label: 'thermal',
  }
  res.json(status)
})

app.post('/print', (req, res) => {
  const job = req.body as PrintJob

  if (!job?.content?.lines?.length) {
    return res.status(400).json({ error: 'Missing content.lines' })
  }

  try {
    const data = generateEscpos(job.content)
    const copies = job.copies ?? 1

    for (let i = 0; i < copies; i++) {
      writeToPrinter(data)
    }

    res.json({ ok: true, bytes: data.length, copies })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

app.post('/preview', (req, res) => {
  const job = req.body as PrintJob

  if (!job?.content?.lines?.length) {
    return res.status(400).json({ error: 'Missing content.lines' })
  }

  try {
    const data = generateEscpos(job.content)
    const hex = Buffer.from(data).toString('base64')
    res.json({ ok: true, hex, bytes: data.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

app.post('/preview/text', (req, res) => {
  const job = req.body as PrintJob

  if (!job?.content?.lines?.length) {
    return res.status(400).json({ error: 'Missing content.lines' })
  }

  try {
    const text = renderAsText(job.content)
    res.json({ ok: true, text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

app.get('/test', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Printer Agent — Test</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; background: #f5f0e8; color: #264137; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  p { color: #587065; margin-bottom: 1.5rem; }
  .row { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
  button { padding: 0.6rem 1.2rem; border: none; border-radius: 999px; background: #bf5a2a; color: #fff; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
  button:hover { opacity: 0.9; }
  button.sec { background: transparent; border: 1px solid rgba(38,65,55,0.22); color: #264137; }
  pre { background: #fffaf2; border: 1px solid rgba(38,65,55,0.12); border-radius: 8px; padding: 1rem; overflow-x: auto; font-size: 0.82rem; line-height: 1.5; min-height: 6rem; white-space: pre-wrap; font-family: "Consolas","SFMono-Regular",monospace; }
  label { font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 0.3rem; }
  textarea { width: 100%; min-height: 16rem; padding: 0.75rem; border: 1px solid rgba(38,65,55,0.22); border-radius: 8px; background: #fffaf2; font-family: monospace; font-size: 0.85rem; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
  .badge.online { background: #d4edda; color: #155724; }
  .badge.offline { background: #f8d7da; color: #721c24; }
  .badge.mode { background: #fff3cd; color: #856404; }
</style>
</head>
<body>
<h1>🖨 Printer Agent — Test</h1>
<p id="status">Caricamento...</p>

<div class="row">
  <button onclick="testPrint()">Invia stampa di test</button>
  <button class="sec" onclick="testPreview()">Solo anteprima</button>
  <button class="sec" onclick="testReceipt()">Scontrino esempio</button>
</div>

<label for="json">Job JSON:</label>
<textarea id="json">{
  "content": {
    "type": "order",
    "title": "Ordine #42",
    "lines": [
      { "align": "center", "text": "Street Food Events", "bold": true, "size": "double" },
      { "kind": "separator" },
      { "align": "left", "text": "Panino porchetta x2", "bold": false },
      { "align": "right", "text": "€12.00", "bold": true },
      { "align": "left", "text": "Hamburger x1", "bold": false },
      { "align": "right", "text": "€8.00", "bold": true },
      { "kind": "separator", "char": "=" },
      { "align": "right", "text": "TOTALE: €20.00", "bold": true, "size": "double" },
      { "kind": "blank", "lines": 1 },
      { "kind": "qrcode", "data": "https://streetfood.example.com/r/42" },
      { "kind": "blank", "lines": 2 },
      { "kind": "cut" }
    ]
  }
}</textarea>

<div class="row" style="margin-top:0.75rem">
  <button onclick="sendCustom()">Invia job personalizzato</button>
  <button class="sec" onclick="previewCustom()">Anteprima testo</button>
  <button class="sec" onclick="previewRaw()">Raw base64</button>
</div>

<pre id="output">Premi un pulsante per vedere il risultato qui.</pre>

<script>
  const BASE = ''
  const jsonEl = document.getElementById('json')
  const out = document.getElementById('output')

  fetch(BASE + '/health').then(r => r.json()).then(s => {
    const badge = s.online ? '<span class="badge online">online</span>' : '<span class="badge offline">offline</span>'
    document.getElementById('status').innerHTML = \`Stampante: \${badge} <span class="badge mode">\${s.printer}</span>\`
  }).catch(() => {
    document.getElementById('status').innerHTML = '<span class="badge offline">Agente non raggiungibile</span>'
  })

  function getJob() {
    try { return JSON.parse(jsonEl.value) }
    catch (e) { out.textContent = 'JSON invalido: ' + e.message; return null }
  }

  function show(r) { out.textContent = typeof r === 'string' ? r : JSON.stringify(r, null, 2) }

  function testPrint() {
    jsonEl.value = JSON.stringify({
      "content": {
        "type": "order",
        "title": "TEST STAMPA",
        "lines": [
          { "align": "center", "text": "Stampante funziona!", "bold": true, "size": "double" },
          { "kind": "separator" },
          { "align": "left", "text": "Data: " + new Date().toLocaleString('it-IT') },
          { "kind": "blank" },
          { "align": "right", "text": "STREET FOOD EVENTS", "bold": true },
          { "kind": "cut" }
        ]
      }
    }, null, 2)
    sendCustom()
  }

  function testReceipt() {
    jsonEl.value = JSON.stringify({
      "content": {
        "type": "order",
        "title": "Scontrino",
        "lines": [
          { "align": "center", "text": "Paninoteca da Marco", "bold": true, "size": "double" },
          { "align": "center", "text": "Stand #3", "bold": false },
          { "kind": "separator" },
          { "align": "left", "text": "Tirato da: Sara", "bold": false },
          { "kind": "separator" },
          { "align": "left", "text": "Panino porchetta", "bold": false },
          { "align": "right", "text": "x2  €12.00", "bold": false },
          { "align": "left", "text": "Hamburger", "bold": false },
          { "align": "right", "text": "x1   €8.00", "bold": false },
          { "align": "left", "text": "Patatine", "bold": false },
          { "align": "right", "text": "x3  €10.50", "bold": false },
          { "kind": "separator" },
          { "align": "right", "text": "TOTALE   €30.50", "bold": true, "size": "double" },
          { "align": "right", "text": "Contanti  €20.00", "bold": false },
          { "align": "right", "text": "Crediti    €10.50", "bold": false },
          { "kind": "blank" },
          { "align": "center", "text": "Grazie e arrivederci!", "bold": false },
          { "kind": "blank", "lines": 2 },
          { "kind": "cut" }
        ]
      }
    }, null, 2)
    sendCustom()
  }

  function sendCustom() { const j = getJob(); if (j) fetch(BASE + '/print', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(j) }).then(r => r.json()).then(show) }
  function previewCustom() { const j = getJob(); if (j) fetch(BASE + '/preview/text', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(j) }).then(r => r.json()).then(d => { show(d.text) }) }
  function previewRaw() { const j = getJob(); if (j) fetch(BASE + '/preview', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(j) }).then(r => r.json()).then(show) }
  function testPreview() { previewCustom() }
</script>
</body>
</html>`)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`printer-agent listening on 0.0.0.0:${PORT}`)
  console.log(`printer device: ${PRINTER_DEVICE}`)
  console.log(`printer mode: ${PRINTER_MODE}`)

  if (PRINTER_MODE === 'usb') {
    if (existsSync(PRINTER_DEVICE)) {
      console.log('printer detected ✓')
    } else {
      console.warn(`printer not found at ${PRINTER_DEVICE} — set PRINTER_MODE=file or PRINTER_MODE=none`)
    }
  } else if (PRINTER_MODE === 'file') {
    console.log(`prints will be saved to ${PRINTS_DIR}/`)
  } else {
    console.log('running in no-op mode (PRINTER_MODE=none) — no data written')
  }
})
