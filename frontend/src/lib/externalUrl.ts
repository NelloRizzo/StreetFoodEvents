/**
 * Normalizza un URL esterno inserito da un utente (es. il "Sito ufficiale" di
 * un evento) prima di usarlo come `href` di un link.
 *
 * Motivo di sicurezza: il valore arriva da un form admin e finisce in un
 * `<a href>`. Senza filtro, un `javascript:...` diventerebbe uno stored-XSS
 * eseguito nel nostro origin al click del visitatore. Per questo si accettano
 * **solo `http:` e `https:`** e tutto il resto viene scartato.
 *
 * Motivo di usability: chi compila il modulo scrive spesso `example.com`
 * senza schema. In quel caso si assume `https://` invece di lasciare un link
 * rotto.
 *
 * Nota sull'ambiguità di `example.com:8080`: se non lo trattiamo come
 * "dominio + porta", `new URL()` lo legge come schema `example.com:` e
 * invalida un indirizzo legittimo. Per questo l'unico schema accettato
 * dall'input è `http(s)://` esplicito; tutto il resto viene riscritto con
 * `https://` davanti.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null

  const isUsable = (candidate: string, scheme: 'http:' | 'https:') => {
    try {
      const parsed = new URL(candidate)
      // hostname obbligatorio: scarta "http://" e authority vuoti
      if (parsed.protocol !== scheme || !parsed.hostname) return null
      return parsed.toString()
    } catch {
      return null
    }
  }

  // 1) URL assoluto con schema esplicito: lo rispettiamo solo se è http(s).
  if (/^https?:\/\//i.test(value)) return isUsable(value, value.toLowerCase().startsWith('https://') ? 'https:' : 'http:')

  // 2) Schema esplicito di altro tipo ("file://…", "ftp://…"): scartato.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null

  // 3) Dominio senza schema ("example.com", "www.example.com/x",
  //    "example.com:8080") o protocol-relative ("//example.com"): si forza https.
  return isUsable(value.startsWith('//') ? `https:${value}` : `https://${value}`, 'https:')
}
