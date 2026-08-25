import { Link } from 'react-router-dom'
import styles from './PrintableDocument.module.scss'

export function RicevutaLiquidazionePage() {
  return (
    <div className="page-shell">
      <div className={styles.printActions}>
        <Link to="/admin/documents" className={styles.backLink}>&larr; Documenti</Link>
        <button className={styles.printBtn} onClick={() => window.print()}>Stampa</button>
      </div>

      <article className={styles.form}>
        <header className={styles.header}>
          <h1>Ricevuta di Liquidazione / Carico Crediti</h1>
          <p className={styles.subtitle}>
            Modello da compilare e firmare per ogni operazione di carico crediti (DARE) o liquidazione (AVERE).
          </p>
        </header>

        <table className={styles.table}>
          <tbody>
            <tr><td>Evento</td><td>&nbsp;</td></tr>
            <tr><td>Luogo</td><td>&nbsp;</td></tr>
            <tr><td>Data evento</td><td>&nbsp;</td></tr>
          </tbody>
        </table>

        <div className={styles.section}>
          <h2>Operazione</h2>
          <div className={styles.fieldRow}>
            <span className={styles.label}>N. operazione:</span>
            <span className={styles.lineShort} />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Tipo:</span>
            <span className={styles.checkbox} />
            <span className={styles.label}>DARE (carico crediti)</span>
            <span className={styles.checkbox} />
            <span className={styles.label}>AVERE (liquidazione)</span>
          </div>
        </div>

        <table className={styles.table}>
          <tbody>
            <tr><td>Stand</td><td>&nbsp;</td></tr>
            <tr><td>Data / ora operazione</td><td>&nbsp;</td></tr>
            <tr><td>Operatore (gestore)</td><td>&nbsp;</td></tr>
          </tbody>
        </table>

        <div className={styles.section}>
          <h2>Crediti</h2>
          <table className={styles.table}>
            <tbody>
              <tr><td>Moneta evento</td><td>&nbsp;</td></tr>
              <tr><td>Importo in crediti</td><td>&nbsp;</td></tr>
              <tr><td>Corso cambio (1 &euro; = N crediti)</td><td>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        <div className={styles.section}>
          <h2>Saldo crediti (storno 1:1)</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)', margin: '0 0 0.5rem' }}>
            Lo storno avviene a parit&agrave; di crediti, indipendentemente dal corso cambio.
          </p>
          <table className={styles.table}>
            <tbody>
              <tr><td>Crediti caricati allo stand (DARE)</td><td>&nbsp;</td></tr>
              <tr><td>Crediti liquidati in precedenza (AVERE)</td><td>&nbsp;</td></tr>
              <tr><td>Importo della presente operazione (crediti)</td><td>&nbsp;</td></tr>
              <tr><td><strong>Da restituire (totale DARE &minus; totale AVERE)</strong></td><td>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        <div className={styles.section}>
          <h2>Euro (solo AVERE — liquidazione)</h2>
          <table className={styles.table}>
            <tbody>
              <tr><td>Lordo &euro; (crediti &divide; corso cambio)</td><td>&nbsp;</td></tr>
              <tr><td>Percentuale trattenuta gestore %</td><td>&nbsp;</td></tr>
              <tr><td>Trattenuta &euro;</td><td>&nbsp;</td></tr>
              <tr><td><strong>Da corrispondere allo stand &euro;</strong></td><td>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>
          <strong>DARE (carico crediti):</strong> nessun corrispettivo in euro. I crediti caricati allo stand sono
          da restituire in fase di liquidazione (AVERE) con storno 1:1.
        </p>

        <div className={styles.section}>
          <h2>Registrazione transazione</h2>
          <table className={styles.table}>
            <tbody>
              <tr><td>N. riferimento transazione</td><td>&nbsp;</td></tr>
              <tr><td>Data registrazione a sistema</td><td>&nbsp;</td></tr>
              <tr><td>Operatore che ha registrato</td><td>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        <div className={styles.section}>
          <h2>Note</h2>
          <div className={styles.textArea}>
            <span className={styles.line} />
            <span className={styles.line} />
          </div>
        </div>

        <div className={styles.section}>
          <h2>Firme</h2>
          <table className={styles.table}>
            <tbody>
              <tr><td>Firma operatore (gestore)</td><td>&nbsp;</td></tr>
              <tr><td>Firma stand</td><td>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        <footer className={styles.footer}>
          <p>
            <strong>Importante:</strong> questa ricevuta è solo un documento di cortesia/informativo.
            I valori economici ufficiali sono quelli registrati nel sistema (storico liquidazioni e resoconto per evento).
          </p>
          <p>
            Lo storno crediti avviene sempre a rapporto <strong>1:1</strong> (1 credito = 1 credito),
            indipendentemente dal corso cambio utilizzato per la conversione in euro.
          </p>
        </footer>
      </article>
    </div>
  )
}
