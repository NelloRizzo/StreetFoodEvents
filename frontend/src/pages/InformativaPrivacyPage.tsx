import { Link } from 'react-router-dom'
import styles from './PrintableDocument.module.scss'

export function InformativaPrivacyPage() {
  return (
    <div className="page-shell">
      <div className={styles.printActions}>
        <Link to="/admin/documents" className={styles.backLink}>&larr; Documenti</Link>
        <button className={styles.printBtn} onClick={() => window.print()}>Stampa</button>
      </div>

      <article className={styles.form}>
        <header className={styles.header}>
          <h1>Informativa Privacy</h1>
          <p className={styles.subtitle}>
            Raccolta email per comunicazioni promozionali — Reg. UE 2016/679 (GDPR)
          </p>
        </header>

        <div className={styles.section}>
          <h2>1. Titolare del trattamento</h2>
          <table className={styles.table}>
            <tbody>
              <tr><td>Denominazione</td><td>Uniamoci</td></tr>
              <tr><td>Sede legale</td><td>via delle Ginestre, 8 — 84046 Ascea (SA)</td></tr>
              <tr><td>Email</td><td>notticilentane@gmail.com</td></tr>
            </tbody>
          </table>
        </div>

        <div className={styles.section}>
          <h2>2. Finalità del trattamento</h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            I dati personali (indirizzo email) vengono raccolti per le seguenti finalità:
          </p>
          <ol style={{ fontSize: '0.9rem', paddingLeft: '1.5rem' }}>
            <li>
              <strong>Invio della foto richiesta</strong> tramite email (base giuridica: esecuzione del servizio
              richiesto dall&apos;interessato — Art. 6(1)(b) GDPR).
            </li>
            <li>
              <strong>Invio di comunicazioni promozionali e aggiornamenti</strong> su eventi, offerte e novità
              (base giuridica: consenso esplicito dell&apos;interessato — Art. 6(1)(a) GDPR).
            </li>
          </ol>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>
            Il consenso al punto 2 è <strong>facoltativo e revocabile</strong> in qualsiasi momento.
            Il mancato consenso non pregiudica l&apos;invio della foto richiesta.
          </p>
        </div>

        <div className={styles.section}>
          <h2>3. Dati trattati</h2>
          <ul style={{ fontSize: '0.9rem', paddingLeft: '1.5rem' }}>
            <li>Indirizzo email</li>
            <li>Data e ora della raccolta del consenso</li>
            <li>Evento di riferimento (se disponibile)</li>
            <li>Dati di navigazione anonimi per finalità statistiche</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2>4. Modalità del trattamento</h2>
          <p style={{ fontSize: '0.9rem' }}>
            I dati sono trattati con strumenti elettronici, nel rispetto delle misure di sicurezza adeguate
            ai sensi dell&apos;Art. 32 GDPR. I dati sono conservati su server ubicati nell&apos;Unione Europea.
          </p>
        </div>

        <div className={styles.section}>
          <h2>5. Periodo di conservazione</h2>
          <p style={{ fontSize: '0.9rem' }}>
            I dati sono conservati per tutta la durata del rapporto e, successivamente, per un periodo non
            superiore a <strong>24 mesi</strong> dalla raccolta del consenso per le finalità promozionali.
            Per la finalità di invio foto, i dati sono conservati per il tempo necessario all&apos;erogazione del servizio.
          </p>
        </div>

        <div className={styles.section}>
          <h2>6. Comunicazione e diffusione</h2>
          <p style={{ fontSize: '0.9rem' }}>
            I dati non vengono comunicati a terzi né diffusi, salvo che per adempiere a obblighi di legge
            o per l&apos;erogazione del servizio tramite piattaforme di invio email (Brevo / Sendinblue),
            che agiscono quali Responsabili del trattamento ai sensi dell&apos;Art. 28 GDPR.
          </p>
        </div>

        <div className={styles.section}>
          <h2>7. Diritti dell&apos;interessato</h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
            L&apos;interessato ha diritto di:
          </p>
          <ul style={{ fontSize: '0.9rem', paddingLeft: '1.5rem' }}>
            <li><strong>Accesso</strong> (Art. 15 GDPR) — conoscere se e quali dati sono trattati</li>
            <li><strong>Rettifica</strong> (Art. 16 GDPR) — correggere dati inesatti</li>
            <li><strong>Cancellazione</strong> (Art. 17 GDPR) — ottenere la cancellazione dei dati</li>
            <li><strong>Limitazione</strong> (Art. 18 GDPR) — limitare il trattamento</li>
            <li><strong>Portabilità</strong> (Art. 20 GDPR) — ricevere i dati in formato strutturato</li>
            <li><strong>Opposizione</strong> (Art. 21 GDPR) — opporsi al trattamento per finalità di marketing diretto</li>
            <li><strong>Revoca del consenso</strong> — in qualsiasi momento</li>
          </ul>
          <p style={{ fontSize: '0.9rem' }}>
            Per esercitare i diritti, contattare: <strong>notticilentane@gmail.com</strong>
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>
            L&apos;interessato ha altresì il diritto di proporre reclamo all&apos;autorità di controllo
            (Garante per la Protezione dei Dati Personali, www.garanteprivacy.it).
          </p>
        </div>

        <div className={styles.section}>
          <h2>8. Conferimento dei dati</h2>
          <p style={{ fontSize: '0.9rem' }}>
            Il conferimento dell&apos;indirizzo email è necessario per ricevere la foto.
            Il conferimento del consenso al trattamento per finalità promozionali è <strong>facoltativo</strong>.
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-line)', margin: '1.5rem 0' }} />

        <div className={styles.section}>
          <h2>Modulo di consenso</h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Il/La sottoscritto/a, ricevuta l&apos;informativa di cui sopra,
          </p>
          <table className={styles.table}>
            <tbody>
              <tr><td>Cognome e Nome</td><td>&nbsp;</td></tr>
              <tr><td>Email</td><td>&nbsp;</td></tr>
              <tr><td>Evento</td><td>&nbsp;</td></tr>
              <tr><td>Data</td><td>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        <div className={styles.section}>
          <h3 style={{ fontSize: '1rem', margin: '0.75rem 0 0.5rem' }}>
            Consenso al trattamento per finalità promozionali
          </h3>
          <div className={styles.fieldRow}>
            <span className={styles.checkbox} />
            <span style={{ fontSize: '0.9rem' }}>
              <strong>Acconsento</strong> al trattamento del mio indirizzo email per ricevere comunicazioni
              promozionali e aggiornamenti su eventi, offerte e novità, ai sensi dell&apos;Art. 6(1)(a) GDPR.
            </span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.checkbox} />
            <span style={{ fontSize: '0.9rem' }}><strong>NON acconsento</strong></span>
          </div>
        </div>

        <div className={styles.section}>
          <h3 style={{ fontSize: '1rem', margin: '0.75rem 0 0.5rem' }}>
            Consenso al trattamento per finalità di profilazione (se applicabile)
          </h3>
          <div className={styles.fieldRow}>
            <span className={styles.checkbox} />
            <span style={{ fontSize: '0.9rem' }}>
              <strong>Acconsento</strong> al trattamento dei miei dati per attività di profilazione finalizzate
              all&apos;invio di comunicazioni personalizzate.
            </span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.checkbox} />
            <span style={{ fontSize: '0.9rem' }}><strong>NON acconsento</strong></span>
          </div>
        </div>

        <div className={styles.section}>
          <p style={{ fontSize: '0.9rem', margin: '0.75rem 0' }}>
            Il sottoscritto dichiara di aver ricevuto e compreso l&apos;informativa privacy completa di cui sopra.
          </p>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Firma:</span>
            <span className={styles.line} />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Luogo e data:</span>
            <span className={styles.line} />
          </div>
        </div>

        <footer className={styles.footer}>
          <p>Documento aggiornato al: 29/07/2026</p>
        </footer>
      </article>
    </div>
  )
}
