import styles from './SocialExport.module.scss'

/* Avviso sul link breve, mostrato nei due export quando il link breve dello
 * stand non si puo' comporre.
 *
 *  Il link breve dello stand si ricava da quello dell'**evento** (piu' il
 *  nome dello stand), quindi e' sulla pagina dell'evento che va creato: e' li'
 *  che punta il link, e il testo dice la cosa vera — il link lungo funziona lo
 *  stesso, e' solo un consiglio, non un errore. */
export function ShortLinkNotice() {
  return (
    <p className={styles.linkNotice}>
      Nessun link breve: si consiglia la creazione nella{' '}
      <a href="/admin/events" target="_blank" rel="noopener noreferrer">
        pagina dell&apos;evento
      </a>
      .
    </p>
  )
}
