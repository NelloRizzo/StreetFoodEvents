import styles from './SocialExport.module.scss'

/* Avviso sul link breve, mostrato nei due export quando lo stand non ha un
 * alias.
 *
 *  Il testo dice la cosa vera: il link che verra' usato funziona lo stesso,
 *  e' solo lungo. Non e' un errore, quindi niente colore d'errore: e un
 *  consiglio, e il link porta gia' alla pagina dove si crea. */
export function ShortLinkNotice({ standId }: { standId: string }) {
  return (
    <p className={styles.linkNotice}>
      Questo stand non ha un link breve: nel post e nel QR finira&apos; l&apos;indirizzo
      lungo con i codici. Funziona, ma per condividere conviene creare lo shortlink
      dalla{' '}
      <a href={`/admin/stands/${standId}`} target="_blank" rel="noopener noreferrer">
        pagina dello stand
      </a>
      .
    </p>
  )
}