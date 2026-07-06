import express from 'express'
import { writeFileSync, existsSync } from 'node:fs'

import type { PrintJob, PrinterStatus } from './types.js'
import { generateEscpos } from './escpos.js'

const PORT = parseInt(process.env.PORT ?? '9300', 10)
const PRINTER_DEVICE = process.env.PRINTER_DEVICE ?? '/dev/usb/lp0'

const app = express()
app.use(express.json({ limit: '100kb' }))

function writeToPrinter(data: Uint8Array): void {
  writeFileSync(PRINTER_DEVICE, data)
}

app.get('/health', (_req, res) => {
  const online = existsSync(PRINTER_DEVICE)
  const status: PrinterStatus = {
    online,
    printer: PRINTER_DEVICE,
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`printer-agent listening on 0.0.0.0:${PORT}`)
  console.log(`printer device: ${PRINTER_DEVICE}`)

  if (existsSync(PRINTER_DEVICE)) {
    console.log('printer detected ✓')
  } else {
    console.warn(`printer not found at ${PRINTER_DEVICE} — start in preview mode`)
  }
})
