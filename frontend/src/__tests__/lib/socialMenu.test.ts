import { describe, expect, it } from 'vitest'

import {
  buildSocialMenuCaption,
  standAliasFromName,
  standPublicUrl,
  standQrQuery,
  circledInitialText,
  fileSlug,
  formatCurrencyInline,
  formatEventDateRange,
  formatCredits,
  formatMonetaLine,
  isBareCurrencySymbol,
  isEuroCurrency,
  stripHtml,
} from '../../lib/socialMenu'

describe('formatEventDateRange', () => {
  it('formats a single-day event', () => {
    expect(formatEventDateRange('2026-09-05', '2026-09-05')).toBe('5 settembre 2026')
  })

  it('formats a same-month multi-day event', () => {
    expect(formatEventDateRange('2026-09-05', '2026-09-07')).toBe('5 — 7 settembre 2026')
  })

  it('formats a cross-month event', () => {
    expect(formatEventDateRange('2026-08-31', '2026-09-02')).toBe(
      '31 agosto 2026 — 2 settembre 2026',
    )
  })

  it('formats a cross-year event', () => {
    expect(formatEventDateRange('2026-12-31', '2027-01-02')).toBe(
      '31 dicembre 2026 — 2 gennaio 2027',
    )
  })

  it('returns empty string for invalid dates', () => {
    expect(formatEventDateRange('not-a-date', '2026-09-05')).toBe('')
  })
})

describe('formatCredits', () => {
  it('formats integers without decimals', () => {
    expect(formatCredits(12)).toBe('12')
    expect(formatCredits(12.0)).toBe('12')
  })

  it('formats decimals with the comma', () => {
    expect(formatCredits(12.5)).toBe('12,50')
    expect(formatCredits(12.3)).toBe('12,30')
  })
})

describe('formatMonetaLine / isEuroCurrency', () => {
  it('returns null for the euro currency', () => {
    expect(formatMonetaLine('€', 5)).toBeNull()
    expect(formatMonetaLine('euro', 5)).toBeNull()
    expect(formatMonetaLine(null, 5)).toBeNull()
  })

  it('renders the change for a named currency', () => {
    expect(formatMonetaLine('Token', 5)).toBe('Moneta evento: Token (1 Token = 0,20 €)')
  })

  it('renders 1 NOME = 1 € when the rate is 1', () => {
    expect(formatMonetaLine('Lira', 1)).toBe('Moneta evento: Lira (1 Lira = 1 €)')
  })

  it('detects euro by bare symbol', () => {
    expect(isEuroCurrency('€')).toBe(true)
    expect(isEuroCurrency('Token')).toBe(false)
    expect(isEuroCurrency('')).toBe(true)
  })
})

describe('formatCurrencyInline / circledInitialText', () => {
  it('keeps the bare symbol as-is', () => {
    expect(formatCurrencyInline('€')).toBe('€')
    expect(formatCurrencyInline('$')).toBe('$')
    expect(isBareCurrencySymbol('€')).toBe(true)
    expect(isBareCurrencySymbol('Token')).toBe(false)
  })

  it('shows the euro symbol for the literal "euro" name', () => {
    expect(formatCurrencyInline('euro')).toBe('€')
  })

  it('renders the initial in a circled glyph for named currencies', () => {
    expect(formatCurrencyInline('Token')).toBe('Ⓣ')
    expect(circledInitialText('Token')).toBe('Ⓣ')
    expect(circledInitialText('Zloty')).toBe('Ⓩ')
  })
})

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Ciao <strong>mondo</strong></p>')).toBe('Ciao mondo')
  })

  it('decodes common entities', () => {
    expect(stripHtml('Pane &amp; salumi')).toBe('Pane & salumi')
  })

  it('handles null and empty input', () => {
    expect(stripHtml(null)).toBe('')
    expect(stripHtml('')).toBe('')
  })
})

describe('fileSlug', () => {
  it('toglie spazi e caratteri che non stanno in un nome file', () => {
    expect(fileSlug('Stand Uno')).toBe('Stand-Uno')
    expect(fileSlug('Panino "della casa" / 2')).toBe('Panino-della-casa-2')
  })

  it('leggibile sulle vocali accentate, non "Caff-"', () => {
    /* Il nome arriva da un form admin e finisce in download: con il solo
       replace delle lettere non-ASCII "Caffè" diventerebbe "Caff-". */
    expect(fileSlug('Caffè Perù')).toBe('Caffe-Peru')
  })

  it('non lascia trattini alle estremità e non diventa mai vuoto', () => {
    expect(fileSlug('  Stand Uno  ')).toBe('Stand-Uno')
    expect(fileSlug('...')).toBe('senza-nome')
  })
})

describe('standPublicUrl', () => {
  const base = { origin: 'https://app.example.com', eventId: 'e1', standId: 's1' }

  /* Il link breve del menu sta dentro quello dell'evento:
     `/show/stand/<alias evento>/<alias stand>`. */
  it('con i due alias compone il link annidato', () => {
    expect(
      standPublicUrl({
        ...base,
        shortLinks: { standAlias: 'panino-doro', eventAlias: 'evento-2027' },
      }),
    ).toBe('https://app.example.com/show/stand/evento-2027/panino-doro')
  })

  /* Composto al volo e non scritto da nessuna parte: senza alias dell'evento
     si usa quello dello stand, che da solo porta comunque alla sua pagina. */
  it('senza alias dell\'evento usa quello dello stand', () => {
    expect(standPublicUrl({ ...base, shortLinks: { standAlias: 'panino-doro', eventAlias: null } })).toBe(
      'https://app.example.com/show/stand/panino-doro',
    )
  })

  it('senza nessun alias resta il link lungo, che funziona', () => {
    expect(standPublicUrl({ ...base })).toBe('https://app.example.com/events/e1/stands/s1')
    expect(standPublicUrl({ ...base, shortLinks: { standAlias: null, eventAlias: null } })).toBe(
      'https://app.example.com/events/e1/stands/s1',
    )
  })
})

describe('standQrQuery', () => {
  const base = { eventId: 'e1', standId: 's1' }

  it('manda al server i due alias, che il server verifica', () => {
    const q = standQrQuery({
      ...base,
      shortLinks: { standAlias: 'panino-doro', eventAlias: 'evento-2027' },
    })
    expect(q).toContain('/stands/s1/qrcode')
    expect(q).toContain('eventId=e1')
    expect(q).toContain('alias=panino-doro')
    expect(q).toContain('eventAlias=evento-2027')
  })

  it('senza alias manda solo l\'evento', () => {
    const q = standQrQuery({ ...base })
    expect(q).toBe('/stands/s1/qrcode?eventId=e1')
  })
})

describe('standAliasFromName', () => {
  it('ripulisce il nome in qualcosa che si puo\' scrivere in un URL', () => {
    expect(standAliasFromName("Panino d'Oro")).toBe('panino-d-oro')
    expect(standAliasFromName('Caffè & Piadè')).toBe('caffe-piade')
    expect(standAliasFromName('  Porchetta  e  Brasato  ')).toBe('porchetta-e-brasato')
  })

  /* Un alias col nome di segnaposto sarebbe un alias falso: meglio il campo
     vuoto, cosi' l'operatore deve scegliere. */
  it('un nome senza nulla di scrivibile non produce un alias', () => {
    expect(standAliasFromName('…')).toBe('')
    expect(standAliasFromName('')).toBe('')
  })

  it('il risultato e\' sempre ammesso dal validatore degli alias', () => {
    for (const name of ["Panino d'Oro", 'Caffè & Piadè', '数字 123', 'A-B_C']) {
      expect(standAliasFromName(name)).toMatch(/^[a-z0-9_-]*$/)
    }
  })
})

describe('buildSocialMenuCaption', () => {
  const base = {
    standName: 'Panino d\'Oro',
    eventName: 'Street Food Fest',
    startDate: '2026-09-05',
    endDate: '2026-09-07',
    products: [
      { name: 'Panino con porchetta', price: 12 },
      { name: 'Tris di arrosticini', price: 10 },
    ],
    menuUrl: 'https://app.example.com/events/e1/stands/s1',
  }

  it('includes stand name, event name, date and products without prices', () => {
    const caption = buildSocialMenuCaption(base)
    expect(caption).toContain('Panino d\'Oro')
    expect(caption).toContain('Street Food Fest')
    expect(caption).toContain('5 — 7 settembre 2026')
    expect(caption).toContain('• Panino con porchetta')
    expect(caption).toContain('• Tris di arrosticini')
    expect(caption).toContain('Vieni a trovarci!')
    expect(caption).toContain(base.menuUrl)
    expect(caption).not.toContain('€')
    expect(caption).not.toMatch(/\d+,\d{2}/)
  })

  it('appends slogan and location when present', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      standSlogan: 'Dal 1985 a Roma',
      location: 'Roma',
    })
    expect(caption).toContain('Dal 1985 a Roma')
    expect(caption).toContain('Street Food Fest — Roma')
  })

  /* Le descrizioni vanno nel TESTO del post, non nel poster: nell'immagine 4:5
     una riga con la descrizione e' alta 136-170px e ne contiene una, mentre
     la griglia storica alta 74px ne contiene due. */
  it('senza includeDescriptions la descrizione non compare', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      products: [{ name: 'Panino con porchetta', description: 'Maiale e rosmarino', price: 12 }],
    })
    expect(caption).toContain('• Panino con porchetta')
    expect(caption).not.toContain('Maiale e rosmarino')
  })

  it('con includeDescriptions la descrizione va nella riga sotto il nome', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includeDescriptions: true,
      products: [{ name: 'Panino con porchetta', description: 'Maiale e rosmarino', price: 12 }],
    })
    expect(caption).toContain('• Panino con porchetta\n  Maiale e rosmarino')
  })

  /* La descrizione e' HTML come quella dell'evento: nel testo deve comparire
     il testo, non i tag. */
  it('la descrizione viene ripulita dagli eventuali tag HTML', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includeDescriptions: true,
      products: [
        { name: 'Panino', description: '<p>Maiale e <b>rosmarino</b></p>', price: 12 },
      ],
    })
    expect(caption).toContain('Maiale e rosmarino')
    expect(caption).not.toContain('<')
  })

  /* La scelta e' dell'operatore perche' la piattaforma di destinazione puo'
     accettare o rifiutare l'HTML: la stessa descrizione va bene come `<strong>`
     su un sito e come testo su un social che lo mostra alla lettera. */
  it('con includeHtml il markup resta nel testo del post', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includeDescriptions: true,
      includeHtml: true,
      products: [
        { name: 'Panino', description: '<p>Maiale e <strong>rosmarino</strong></p>', price: 12 },
      ],
    })
    expect(caption).toContain('<strong>rosmarino</strong>')
    expect(caption).toContain('• Panino\n  <p>')
  })

  /* Un editor vuoto produce `<p></p>`: e' una descrizione assente, non una
     riga vuota nel post. */
  it('con includeHtml una descrizione solo markup non aggiunge una riga', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includeDescriptions: true,
      includeHtml: true,
      products: [
        { name: 'Panino', description: '<p></p>', price: 12 },
        { name: 'Arrosticini', description: '<p>   </p>', price: 10 },
      ],
    })
    expect(caption).toContain('• Panino')
    expect(caption).toContain('• Arrosticini')
    expect(caption).not.toContain('<p></p>')
    expect(caption).not.toMatch(/\n\s{2}\n/)
  })

  it('includeHtml senza includeDescriptions non mostra comunque nulla', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includeHtml: true,
      products: [
        { name: 'Panino', description: '<p>Maiale e <strong>rosmarino</strong></p>', price: 12 },
      ],
    })
    expect(caption).not.toContain('<strong>')
    expect(caption).not.toContain('rosmarino')
  })

  it('un piatto senza descrizione non aggiunge una riga vuota', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includeDescriptions: true,
      products: [
        { name: 'Panino', description: null, price: 12 },
        { name: 'Arrosticini', description: '', price: 10 },
      ],
    })
    expect(caption).toContain('• Panino')
    expect(caption).toContain('• Arrosticini')
    expect(caption).not.toMatch(/\n\s{2}\n/)
  })

  /* Prezzi e descrizioni si sommano sulla stessa riga di prodotto. */
  it('descrizione e prezzo possono stare insieme', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includePrices: true,
      includeDescriptions: true,
      products: [{ name: 'Panino con porchetta', description: 'Maiale e rosmarino', price: 12 }],
    })
    expect(caption).toContain('• Panino con porchetta 12')
    expect(caption).toContain('  Maiale e rosmarino')
  })

  it('skips empty product names', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      products: [
        { name: 'Panino', price: 5 },
        { name: '', price: 5 },
      ],
    })
    expect(caption).toContain('• Panino')
    expect(caption).not.toMatch(/•\s*\n/)
  })

  it('omits menu section when no products', () => {
    const caption = buildSocialMenuCaption({ ...base, products: [] })
    expect(caption).not.toContain('Il nostro menu:')
    expect(caption).toContain('Vieni a trovarci!')
  })

  it('includes prices with the currency glyph when includePrices is on', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includePrices: true,
      currencyName: 'Token',
      exchangeRate: 5,
    })
    expect(caption).toContain('• Panino con porchetta 12 Ⓣ')
    expect(caption).toContain('• Tris di arrosticini 10 Ⓣ')
    expect(caption).toContain('Moneta evento: Token (1 Token = 0,20 €)')
    expect(caption).not.toContain('12 Token')
  })

  it('uses the euro symbol for prices without a named currency', () => {
    const caption = buildSocialMenuCaption({ ...base, includePrices: true })
    expect(caption).toContain('• Panino con porchetta 12 €')
    expect(caption).not.toContain('Moneta evento:')
  })

  it('keeps products without price when price is null or 0', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      includePrices: true,
      currencyName: 'Token',
      products: [
        { name: 'Omaggio', price: 0 },
        { name: 'Coffe break', price: null },
      ],
    })
    expect(caption).toContain('• Omaggio')
    expect(caption).toContain('• Coffe break')
    expect(caption).not.toContain('0 Ⓣ')
  })

  it('strips html from the event tagline', () => {
    const caption = buildSocialMenuCaption({
      ...base,
      eventTagline: '<p>Un <strong>fine settimana</strong> di gusto&nbsp;fino a tardi</p>',
    })
    expect(caption).toContain('Un fine settimana di gusto fino a tardi')
    expect(caption).not.toContain('<')
    expect(caption).not.toContain('>')
  })
})