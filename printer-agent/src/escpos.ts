import type { PrintContent, PrintLine } from './types.js'

const LF = 0x0A
const ESC = 0x1B
const GS = 0x1D

function byte(n: number): number {
  return n & 0xFF
}

function writeBytes(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes)
}

function writeString(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

function alignCmd(align: 'left' | 'center' | 'right'): Uint8Array {
  const map: Record<string, number> = { left: 0, center: 1, right: 2 }
  return writeBytes(ESC, 0x61, map[align] ?? 0)
}

function boldCmd(on: boolean): Uint8Array {
  return writeBytes(ESC, 0x45, on ? 1 : 0)
}

function sizeCmd(size: 'normal' | 'double' | 'wide' | 'tall'): Uint8Array {
  const map: Record<string, number> = { normal: 0, double: 0x11, wide: 0x21, tall: 0x12 }
  return writeBytes(GS, 0x21, map[size] ?? 0)
}

function barcodeCmd(data: string, type: 'code128' | 'code39' | 'ean13'): Uint8Array {
  const typeMap: Record<string, number> = { code128: 73, code39: 69, ean13: 67 }
  const t = typeMap[type] ?? 73
  const raw = writeString(data)
  return concat(
    writeBytes(GS, 0x6B, t, raw.length),
    raw
  )
}

function qrcodeCmd(data: string): Uint8Array {
  const raw = writeString(data)
  const len = raw.length + 3
  const pL = byte(len)
  const pH = byte(len >> 8)
  return concat(
    writeBytes(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00),
    writeBytes(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x08),
    writeBytes(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30),
    raw,
    writeBytes(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)
  )
}

function separatorCmd(char = '─', count = 42): Uint8Array {
  return writeString(char.repeat(count) + '\n')
}

function cutCmd(): Uint8Array {
  return writeBytes(GS, 0x56, 0x00)
}

function beepCmd(): Uint8Array {
  return writeBytes(ESC, 0x28, 0x41, 0x04, 0x00, 0x31, 0x50, 0x02, 0x05)
}

export function renderAsText(content: PrintContent): string {
  const lines: string[] = []
  const width = 42

  if (content.title) {
    lines.push('')
    lines.push('╔' + '═'.repeat(width - 2) + '╗')
    const titlePad = Math.max(0, width - 2 - content.title.length)
    const leftPad = Math.floor(titlePad / 2)
    lines.push('║' + ' '.repeat(leftPad) + content.title + ' '.repeat(titlePad - leftPad) + '║')
    lines.push('╚' + '═'.repeat(width - 2) + '╝')
  }

  for (const line of content.lines) {
    if ('kind' in line) {
      switch (line.kind) {
        case 'separator':
          lines.push('─'.repeat(width))
          break
        case 'blank':
          for (let i = 0; i < (line.lines ?? 1); i++) lines.push('')
          break
        case 'barcode':
          lines.push(`[BARCODE ${line.type ?? 'code128'}] ${line.data}`)
          break
        case 'qrcode':
          lines.push(`[QRCODE] ${line.data}`)
          break
        case 'cut':
          lines.push('─'.repeat(width))
          lines.push('✂  TAGLIO CARTA')
          break
        case 'beep':
          lines.push('[BEEP]')
          break
      }
    } else {
      const text = line.text
      const bold = line.bold ? '**' : ''
      const formatted = text.length > width - 4 ? text.slice(0, width - 7) + '…' : text

      switch (line.align ?? 'left') {
        case 'center': {
          const pad = Math.max(0, width - formatted.length)
          const l = Math.floor(pad / 2)
          lines.push(' '.repeat(l) + bold + formatted + bold + ' '.repeat(pad - l))
          break
        }
        case 'right': {
          const pad = Math.max(0, width - formatted.length - 4)
          lines.push(' '.repeat(pad) + bold + formatted + bold)
          break
        }
        default: {
          lines.push(bold + formatted + bold)
          break
        }
      }
    }
  }

  return lines.join('\n')
}

export function generateEscpos(content: PrintContent): Uint8Array {
  const chunks: Uint8Array[] = []

  chunks.push(writeBytes(ESC, 0x40))

  if (content.title) {
    chunks.push(alignCmd('center'))
    chunks.push(sizeCmd('double'))
    chunks.push(boldCmd(true))
    chunks.push(writeString(content.title + '\n'))
    chunks.push(boldCmd(false))
    chunks.push(sizeCmd('normal'))
    chunks.push(separatorCmd())
  }

  for (const line of content.lines) {
    if ('kind' in line) {
      switch (line.kind) {
        case 'separator':
          chunks.push(separatorCmd(line.char))
          break
        case 'blank':
          chunks.push(writeString('\n'.repeat(line.lines ?? 1)))
          break
        case 'barcode':
          chunks.push(barcodeCmd(line.data, line.type ?? 'code128'))
          chunks.push(writeBytes(LF))
          break
        case 'qrcode':
          chunks.push(qrcodeCmd(line.data))
          chunks.push(writeBytes(LF))
          break
        case 'cut':
          chunks.push(cutCmd())
          break
        case 'beep':
          chunks.push(beepCmd())
          break
      }
    } else {
      chunks.push(alignCmd(line.align ?? 'left'))
      if (line.bold) chunks.push(boldCmd(true))
      if (line.size && line.size !== 'normal') chunks.push(sizeCmd(line.size))
      chunks.push(writeString(line.text + '\n'))
      if (line.bold) chunks.push(boldCmd(false))
      if (line.size && line.size !== 'normal') chunks.push(sizeCmd('normal'))
    }
  }

  chunks.push(cutCmd())
  return concat(...chunks)
}
