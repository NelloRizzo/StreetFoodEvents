/** Etichette di evento usate nelle liste dove compaiono piu' edizioni.
 *
 *  Il caso: la stessa manifestazione si tiene su piu' edizioni ("Street Food
 *  Roma 2026" e "Street Food Roma 2027"). Mostrare il solo nome in una select
 *  o in una riga di prodotto produce due voci identiche fra le quali non si
 *  puo' scegliere, quindi accanto al nome va la data di svolgimento.
 *
 *  Il formato (`Nome — gg/mm/aaaa`) e' quello gia' usato dalla sidebar
 *  "Evento attivo": un operatore che legge l'etichetta nella lista deve
 *  riconoscere la stessa voce che ha scelto li'. */

type EventWithDate = { name: string; startDate?: string | null }

/** `Nome — gg/mm/aaaa`, o il solo nome se la data manca o non e' parsabile.
 *
 *  Non lancia mai: una data assente o malformata non deve far cadere una
 *  pagina perche' un evento ha il campo vuoto. La data e' interpretata in
 *  ora locale, come in tutta l'app: `toLocaleDateString` senza `timeZone`
 *  usa il fuso del browser, e il fuso dell'evento (`Event.timezone`) non
 *  serve qui perche' si mostra il giorno di inizio cosi' come e' stato
 *  digitato dall'amministratore. */
export function eventWithDate(ev: EventWithDate | null | undefined): string {
  if (!ev) return ''

  const date = parseDate(ev.startDate)
  if (!date) return ev.name

  return `${ev.name} — ${date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}