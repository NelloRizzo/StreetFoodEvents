const MONTHS_IT = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]

export function formatEventDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

  const fmtLong = (d: Date) => `${d.getDate()} ${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`

  if (start.toDateString() === end.toDateString()) return fmtLong(start)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} — ${fmtLong(end)}`
  }
  return `${fmtLong(start)} — ${fmtLong(end)}`
}

export function isEuroCurrency(currencyName: string | null | undefined): boolean {
  const t = (currencyName ?? '').trim().toLowerCase()
  if (!t) return true
  if (t === 'euro' || t === 'euros') return true
  return /^[^\p{L}\p{N}]$/u.test(t)
}

export function isBareCurrencySymbol(currencyName: string | null | undefined): boolean {
  return /^[^\p{L}\p{N}]$/u.test((currencyName ?? '').trim())
}

export function currencyInitial(currencyName: string | null | undefined): string {
  return (currencyName ?? '').trim().charAt(0).toUpperCase()
}

const CIRCLED_A_CODE = 0x24b6 // Ⓐ

export function circledInitialText(currencyName: string | null | undefined): string {
  const ch = currencyInitial(currencyName)
  const code = ch.charCodeAt(0)
  if (code >= 0x41 && code <= 0x5a) {
    return String.fromCharCode(CIRCLED_A_CODE + (code - 0x41))
  }
  return `(${ch})`
}

export function formatCurrencyInline(currencyName: string | null | undefined): string {
  const trimmed = (currencyName ?? '').trim()
  if (!trimmed) return '€'
  if (isBareCurrencySymbol(currencyName)) {
    return trimmed
  }
  const t = trimmed.toLowerCase()
  if (t === 'euro' || t === 'euros') return '€'
  return circledInitialText(currencyName)
}

/** Nome file per i download degli export social.
 *
 *  Il nome dello stand o del prodotto arriva da un form admin e finisce
 *  nell'attributo `download`: le vocali accentate diventerebbero trattini
 *  ("Caff-" invece di "Caffe"), quindi si normalizza prima di ripulire.
 *  Il fallback evita il nome vuoto, che alcuni browser ignorano. */
export function fileSlug(value: string): string {
  const ascii = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii || 'senza-nome'
}

export function stripHtml(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatCredits(price: number): string {
  const rounded = Math.round(price * 100) / 100
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace('.', ',')
}

export function formatMonetaLine(
  currencyName: string | null | undefined,
  exchangeRate: number | null | undefined,
): string | null {
  const name = (currencyName ?? '').trim() || '€'
  if (isEuroCurrency(name)) return null
  const rate = Number.isFinite(exchangeRate) && exchangeRate! > 0 ? exchangeRate! : 1
  const euroPerUnit = 1 / rate
  const euroLabel =
    Math.round(euroPerUnit) === euroPerUnit
      ? String(Math.round(euroPerUnit))
      : euroPerUnit.toFixed(2).replace('.', ',')
  return `Moneta evento: ${name} (1 ${name} = ${euroLabel} €)`
}

/** I pezzi del link breve che servono a chiudere il menu di uno stand.
 *
 *  Quello del **menu** porta lo stand dentro l'evento, quindi si compone con
 *  l'alias dell'evento e un segmento per lo stand:
 *  `/show/stand/<alias evento>/<segmento stand>`. Il segmento e' l'alias
 *  esplicito dello stand se ne esiste uno, altrimenti il **nome dello stand
 *  ripulito**: lo shortlink dello stand non si crea piu' a mano, si ricava da
 *  quello dell'evento. I pezzi restano segmenti singoli e vengono composti al
 *  momento della richiesta, per cui rinominare l'alias dell'evento non lascia
 *  sporgenti i link gia' stampati. */
export type StandShortLinks = {
  /** Alias **esplicito** dello stand (documento Alias), senza slash.
   *
   *  Da quando lo shortlink dello stand si ricava dal nome, questo campo
   *  resta per gli alias creati in passato: e' l'unico che, da solo, sa stare
   *  in piedi (`/show/stand/<alias>`). */
  standAlias: string | null
  /** Alias dell'evento, senza slash: e' quello che va davanti. */
  eventAlias: string | null
  /** Segmento dello stand ricavato dal suo **nome**, per il link annidato
   *  nell'evento.
   *
   *  Non esiste nessun documento Alias per questo: il link si compone al
   *  volo, come per gli altri segmenti. Vale **solo** dentro il link
   *  dell'evento, quindi senza `eventAlias` resta inutilizzato — da solo
   *  porterebbe a un 404. */
  derivedStandAlias?: string | null
}

/** Come si chiama uno stand in un link breve: il nome ripulito di tutto cio'
 *  che in un URL non serve e non si puo' scrivere.
 *
 *  Riusa `fileSlug`, che fa gia' questa pulizia per i nomi dei file: due
 *  versioni della stessa regola andrebbero tenute allineate a mano. Il
 *  segnaposto di `fileSlug` ('senza-nome') qui diventa stringa vuota: un alias
 *  con quel nome sarebbe un alias falso, meglio restare sul link lungo.
 *
 *  **Gemella di `standAliasFromName` in `backend/src/utils/alias-slug.ts`**:
 *  il link breve viene composto anche dal server (visita diretta, QR) e le due
 *  implementazioni devono produrre la stessa stringa, altrimenti uno
 *  shortlink condiviso non si risolve. Tenere allineate a mano. */
export function standAliasFromName(name: string): string {
  /* Il minuscolo non e' facoltativo: il validatore degli alias accetta solo
     `[a-z0-9_-]` e il campo ha anche il `pattern` HTML, quindi proporre un
     nome con le maiuscole lo mostrerebbe gia' come non valido. */
  const slug = fileSlug(name).toLowerCase()
  return slug === 'senza-nome' ? '' : slug
}

/** Link pubblico della pagina di uno stand.
 *
 *  Con l'alias dell'evento si usa il link breve, che e' quello che si mette in
 *  un post e quello che va nel QR del poster: con gli ObjectId nel link il
 *  visitatore ne vede uno solo e il QR diventa illeggibile da lontano. Il
 *  segmento dello stand e' l'alias esplicito se c'e', altrimenti il suo nome
 *  ripulito. Senza l'alias dell'evento si resta sul link lungo, che funziona,
 *  e l'export avvisa che conviene crearlo. */
export function standPublicUrl(input: {
  origin: string
  eventId: string
  standId: string
  shortLinks?: StandShortLinks
}): string {
  const { origin, eventId, standId, shortLinks } = input
  const standAlias = shortLinks?.standAlias ?? null
  const eventAlias = shortLinks?.eventAlias ?? null
  /* Il nome dello stand vale solo dentro il link dell'evento: da solo
     porterebbe a una pagina che non esiste. */
  const derived = eventAlias ? (shortLinks?.derivedStandAlias ?? null) : null
  const segment = standAlias || derived
  if (segment && eventAlias) return `${origin}/show/stand/${eventAlias}/${segment}`
  if (standAlias) return `${origin}/show/stand/${standAlias}`
  return `${origin}/events/${eventId}/stands/${standId}`
}

/** C'e' un link breve componibile per lo stand?
 *
 *  Serve l'alias dell'evento (e' quello che va davanti) e un segmento per lo
 *  stand — alias esplicito o nome ripulito. Senza, l'export resta sul link
 *  lungo e lo dichiara con `ShortLinkNotice`. */
export function hasStandShortLink(shortLinks?: StandShortLinks | null): boolean {
  if (!shortLinks) return false
  if (shortLinks.eventAlias) {
    return Boolean(shortLinks.standAlias || shortLinks.derivedStandAlias)
  }
  /* Senza l'evento resta il solo alias esplicito, che vale da solo. */
  return Boolean(shortLinks.standAlias)
}

/** Query per il QR del menu: con l'alias dell'evento il server costruisce il
 *  link breve annidato, altrimenti il link lungo. Il server verifica che
 *  l'alias esista, che lo stand sia di quell'evento e che il segmento
 *  corrisponda, quindi non e' una fiducia cieca. */
export function standQrQuery(input: {
  eventId: string
  standId: string
  shortLinks?: StandShortLinks
}): string {
  const { eventId, standId, shortLinks } = input
  const params = new URLSearchParams({ eventId })
  const eventAlias = shortLinks?.eventAlias ?? null
  const derived = eventAlias ? (shortLinks?.derivedStandAlias ?? null) : null
  const segment = shortLinks?.standAlias || derived
  if (segment) params.set('alias', segment)
  if (eventAlias) params.set('eventAlias', eventAlias)
  return `/stands/${standId}/qrcode?${params.toString()}`
}

export type SocialMenuCaptionProduct = {
  name: string
  description?: string | null
  price: number | null
}

export type SocialMenuCaptionInput = {
  standName: string
  standSlogan?: string | null
  eventName: string
  startDate: string
  endDate: string
  location?: string | null
  eventTagline?: string | null
  products: SocialMenuCaptionProduct[]
  menuUrl: string
  includePrices?: boolean
  /** Descrizioni dei piatti nel testo del post, non nel poster.
   *
   *  La descrizione va qui e non nell'immagine perche' nel formato 4:5 il
   *  poster ha 302px liberi fra intestazione e footer: una riga con la
   *  descrizione e' alta 136-170px e ne contiene una sola, mentre la griglia
   *  storica alta 74px ne contiene due. Metterla nell'immagine farebbe
   *  passare da 8 prodotti a 1-3. Il testo non ha questo limite. */
  includeDescriptions?: boolean
  /** Se `true` le descrizioni nel testo del post restano HTML, altrimenti
   *  diventano testo piano.
   *
   *  Vale **solo** per il testo del post: il poster disegna sempre testo
   *  piano (il canvas non ha markup) e nell'immagine le descrizioni non
   *  entrano affatto. La scelta e' dell'operatore perche' la piattaforma di
   *  destinazione puo' accettare o rifiutare l'HTML: la stessa descrizione
   *  va bene come `<strong>` su un sito e come testo su un social che lo
   *  mostra alla lettera. */
  includeHtml?: boolean
  currencyName?: string | null
  exchangeRate?: number | null
}

export function buildSocialMenuCaption(input: SocialMenuCaptionInput): string {
  const lines: string[] = []
  lines.push(input.standName.trim())
  if (input.standSlogan?.trim()) lines.push(input.standSlogan.trim())

  const place = [input.eventName.trim(), input.location?.trim()].filter(Boolean).join(' — ')
  if (place) lines.push(place)

  const dateRange = formatEventDateRange(input.startDate, input.endDate)
  if (dateRange) lines.push(dateRange)

  const tagline = stripHtml(input.eventTagline)
  if (tagline) lines.push(tagline)

  const currency = formatCurrencyInline(input.currencyName)
  const products = input.products
    .map((p) => ({
      name: p.name.trim(),
      /* In modalita' HTML il testo serve lo stesso, ma solo come controllo
         "c'e' qualcosa da mostrare": un `<p></p>` vuoto è una descrizione
         assente, non una riga vuota nel post. */
      description: input.includeHtml
        ? stripHtml(p.description)
          ? (p.description ?? '').trim()
          : ''
        : stripHtml(p.description),
      price: p.price,
    }))
    .filter((p) => p.name.length > 0)
  if (products.length > 0) {
    lines.push('')
    lines.push('Il nostro menu:')
    products.forEach((p) => {
      let line = `• ${p.name}`
      if (input.includePrices && p.price != null && p.price > 0) {
        line += ` ${formatCredits(p.price)} ${currency}`
      }
      lines.push(line)
      /* La descrizione sta nella riga sotto, indentata: attaccata al nome
         con i trattini diventerebbe illeggibile, e il prezzo sta gia' sul
         nome. */
      if (input.includeDescriptions && p.description) {
        lines.push(`  ${p.description}`)
      }
    })
    const moneta = formatMonetaLine(input.currencyName, input.exchangeRate)
    if (input.includePrices && moneta) lines.push(moneta)
  }

  lines.push('')
  lines.push('Vieni a trovarci!')
  if (input.menuUrl) lines.push(input.menuUrl)

  return lines.join('\n')
}