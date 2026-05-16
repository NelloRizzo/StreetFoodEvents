import { config } from '../lib/config'
import styles from './PrivacyPage.module.scss'

export function PrivacyPage() {
  return (
    <div className={`page-shell ${styles.page}`}>
      <h1 className={styles.title}>Informativa Privacy</h1>
      <p className={styles.date}><em>Ultimo aggiornamento: maggio 2026</em></p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Titolare del trattamento</h2>
        <p className={styles.text}>
          Street Food Events — piattaforma di gestione stand enogastronomici.
          I dati sono trattati esclusivamente per erogare i servizi della piattaforma.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Dati raccolti</h2>
        <ul className={styles.list}>
          <li><strong>Registrazione</strong>: nome, cognome, email, avatar (opzionale).</li>
          <li><strong>Ordini</strong>: prodotti ordinati, importo, metodo di pagamento, credito utilizzato.</li>
          <li><strong>Preferiti</strong>: eventi e stand che l'utente aggiunge ai preferiti.</li>
          <li><strong>Cookie</strong>: cookie di sessione (<code>sid</code>) per l'autenticazione, cookie analytics e pubblicitari (con consenso).</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Finalità del trattamento</h2>
        <ul className={styles.list}>
          <li>Autenticazione e gestione dell'account.</li>
          <li>Erogazione del servizio di ordinazione e pagamento.</li>
          <li>Gestione dei preferiti e personalizzazione dell'esperienza.</li>
          <li>Analisi statistiche aggregate (con consenso).</li>
          <li>Pubblicità mirata (con consenso, futura).</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Base giuridica</h2>
        <p className={styles.text}>
          Il trattamento si basa sul consenso dell'utente (cookie analytics/pubblicitari),
          sull'esecuzione del contratto (erogazione del servizio) e sul legittimo interesse
          del titolare (miglioramento della piattaforma).
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Diritti dell'utente (GDPR)</h2>
        <p className={styles.text}>L'utente ha diritto di:</p>
        <ul className={styles.list}>
          <li>Accedere ai propri dati personali (art. 15 GDPR).</li>
          <li>Richiedere la rettifica dei dati inesatti (art. 16 GDPR).</li>
          <li>Richiedere la cancellazione dei dati (art. 17 GDPR).</li>
          <li>Richiedere la limitazione del trattamento (art. 18 GDPR).</li>
          <li>Richiedere la portabilità dei dati (art. 20 GDPR).</li>
          <li>Opporsi al trattamento (art. 21 GDPR).</li>
          <li>Revocare il consenso in qualsiasi momento senza pregiudicare la liceità del trattamento basata sul consenso prestato prima della revoca.</li>
        </ul>
        <p className={styles.text}>
          Per esercitare i tuoi diritti, contattaci all'indirizzo email:{' '}
          <a className={styles.link} href={`mailto:${config.privacyEmail}`}>{config.privacyEmail}</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Cookie</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Durata</th>
              <th>Finalità</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>sid</code></td>
              <td>Tecnico (essenziale)</td>
              <td>Sessione</td>
              <td>Autenticazione utente</td>
            </tr>
            <tr>
              <td>Cookie analytics</td>
              <td>Analytics (opzionale)</td>
              <td>Variabile</td>
              <td>Statistiche di utilizzo (futuro)</td>
            </tr>
            <tr>
              <td>Cookie pubblicitari</td>
              <td>Profilazione (opzionale)</td>
              <td>Variabile</td>
              <td>Pubblicità mirata (futuro)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Terze parti</h2>
        <ul className={styles.list}>
          <li><strong>Google AdMob</strong>: pubblicità nell'app Android (futuro).</li>
          <li><strong>Google Analytics / Google Tag Manager</strong>: statistiche di navigazione (futuro, con consenso).</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Modifiche</h2>
        <p className={styles.text}>
          La presente informativa può essere aggiornata periodicamente. Gli utenti saranno informati
          di eventuali modifiche sostanziali tramite avviso sulla piattaforma.
        </p>
      </section>
    </div>
  )
}
