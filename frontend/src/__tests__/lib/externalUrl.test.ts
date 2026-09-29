import { describe, expect, it } from 'vitest'

import { safeExternalUrl } from '../../lib/externalUrl'

describe('safeExternalUrl', () => {
  it('restituisce null su valori vuoti', () => {
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl('   ')).toBeNull()
  })

  it('accetta http e https già completi', () => {
    expect(safeExternalUrl('https://example.com')).toBe('https://example.com/')
    expect(safeExternalUrl('http://example.com/a/b?c=d#e')).toBe('http://example.com/a/b?c=d#e')
  })

  it('forza https quando il dominio è scritto senza schema', () => {
    expect(safeExternalUrl('example.com')).toBe('https://example.com/')
    expect(safeExternalUrl('www.example.com/menu')).toBe('https://www.example.com/menu')
    expect(safeExternalUrl('example.com:8080')).toBe('https://example.com:8080/')
    expect(safeExternalUrl('//example.com/x')).toBe('https://example.com/x')
  })

  /* Il valore arriva da un form admin e finisce in un <a href>: senza filtro
     un javascript: diventerebbe uno stored-XJS nel nostro origin. */
  it('scarta schemi non http(s) — difesa stored-XSS', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('JavaScript:alert(document.cookie)')).toBeNull()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull()
  })

  it('scarta anche i payload javascript camuffati da dominio', () => {
    /* "https://" + "javascript:alert(1)" non produce un host valido (porta
       non numerica), quindi il fallback deve scartare tutto. */
    expect(safeExternalUrl('https://javascript:alert(1)')).toBeNull()
  })

  it('scarta input non interpretabili come URL', () => {
    expect(safeExternalUrl('non un url')).toBeNull()
    expect(safeExternalUrl('http://')).toBeNull()
  })
})
