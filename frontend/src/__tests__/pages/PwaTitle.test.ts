import { describe, expect, it } from 'vitest'

/* Import come stringa grezza (suffisso `?raw` di Vite): evitano i builtin
   Node, che non sono disponibili nei test perche' `tsconfig.app.json` ha
   `types: ["vite/client"]` (aggiungere "node" esporrebbe i globali Node a
   tutto il codice applicativo, indebolendo il typecheck del browser). */
import customersHtml from '../../../customers.html?raw'
import customerConfig from '../../../vite.customer.config.ts?raw'
import homePage from '../../pages/HomePage.tsx?raw'
import publicHeader from '../../components/PublicHeader.tsx?raw'

describe('titolo PWA clienti', () => {
  it('customers.html ha un solo <title> ed e\' "Street Food Events"', () => {
    const titles = [...customersHtml.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1])
    expect(titles).toEqual(['Street Food Events'])
  })

  it('il manifest dichiara lo stesso nome e short_name', () => {
    expect(customerConfig).toContain("name: 'Street Food Events',")
    expect(customerConfig).toContain("short_name: 'Street Food Events',")
    /* niente suffisso "— Clienti": era la causa del titolo diverso in tab */
    expect(customerConfig).not.toMatch(/name: 'Street Food Events [—-]/)
  })

  it('la home NON ripete il brand nell\'hero (gia\' presente nell\'header)', () => {
    expect(homePage).not.toMatch(/eyebrow[^>]*>\s*Street Food Events/)
  })

  it('l\'header espone una sola volta il testo del brand', () => {
    const occurrences = [...publicHeader.matchAll(/>\s*Street Food Events\s*</g)]
    expect(occurrences).toHaveLength(1)
  })
})
