import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('titolo PWA clienti', () => {
  it('customers.html ha un solo <title> ed e\' "Street Food Events"', () => {
    const html = read('../../../customers.html')
    const titles = [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1])
    expect(titles).toEqual(['Street Food Events'])
  })

  it('il manifest dichiara lo stesso nome e short_name', () => {
    const config = read('../../../vite.customer.config.ts')
    expect(config).toContain("name: 'Street Food Events',")
    expect(config).toContain("short_name: 'Street Food Events',")
    /* niente suffisso "— Clienti": era la causa del titolo diverso in tab */
    expect(config).not.toMatch(/name: 'Street Food Events [—-]/)
  })

  it('la home NON ripete il brand nell\'hero (gia\' presente nell\'header)', () => {
    const home = read('../../pages/HomePage.tsx')
    expect(home).not.toMatch(/eyebrow[^>]*>\s*Street Food Events/)
  })

  it('l\'header espone una sola volta il testo del brand', () => {
    const header = read('../../components/PublicHeader.tsx')
    const occurrences = [...header.matchAll(/>\s*Street Food Events\s*</g)]
    expect(occurrences).toHaveLength(1)
  })
})
