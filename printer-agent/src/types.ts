export type PrintJob = {
  printer?: string
  copies?: number
  content: PrintContent
}

export type PrintContent = {
  type: 'order' | 'receipt' | 'report' | 'text'
  title?: string
  lines: PrintLine[]
}

export type PrintLine =
  | { align: 'left' | 'center' | 'right'; text: string; bold?: boolean; size?: 'normal' | 'double' | 'wide' | 'tall' }
  | { kind: 'separator'; char?: string }
  | { kind: 'blank'; lines?: number }
  | { kind: 'barcode'; data: string; type?: 'code128' | 'code39' | 'ean13' }
  | { kind: 'qrcode'; data: string }
  | { kind: 'cut' }
  | { kind: 'beep' }

export type PrinterStatus = {
  online: boolean
  printer: string
  label: 'thermal' | 'receipt'
}
