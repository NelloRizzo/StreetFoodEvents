import heroImg from '../assets/hero.png'
import styles from '../App.module.scss'

export function PlatformPage() {
  return (
    <main>
      <section className={styles.heroSection} id="intro">
        <div className={`page-shell ${styles.heroLayout}`}>
          <div className={styles.heroContent}>
            <span className="eyebrow">Street food operations, finally aligned</span>
            <h1 className={styles.heroTitle}>
              Una cabina di regia per eventi, stand, casse e cucina.
            </h1>
            <p className={styles.heroCopy}>
              Street Food Events nasce per coordinare manifestazioni enogastronomiche
              con un&apos;interfaccia chiara, una moneta dedicata per ogni evento e flussi
              rapidi per menu, responsabili di stand e wallet dei clienti.
            </p>

            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href="#features">
                Scopri le funzioni
              </a>
              <a className={styles.secondaryAction} href="#workflow">
                Vedi il flusso operativo
              </a>
            </div>

            <ul className={styles.heroHighlights}>
              <li>
                <strong>1 app</strong>
                <span>Per gestire evento, stand, utenti e moneta interna.</span>
              </li>
              <li>
                <strong>3 ruoli chiave</strong>
                <span>Cassa, cucina e admin con permessi separati.</span>
              </li>
              <li>
                <strong>Menu chiari</strong>
                <span>Ingredienti, allergeni e immagini sempre leggibili.</span>
              </li>
              <li>
                <strong>Wallet evento</strong>
                <span>Saldo utente e transazioni tracciate in tempo reale.</span>
              </li>
            </ul>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.dashboardCard}>
              <img
                src={heroImg}
                alt="Piatto street food in primo piano"
                className={styles.dashboardImage}
              />

              <div className={styles.dashboardOverlay}>
                <div className={styles.dashboardMeta}>
                  <span>Evento attivo</span>
                  <span className={styles.liveBadge}>Live service</span>
                </div>

                <div className={styles.dashboardPanels}>
                  <div className={styles.panel}>
                    <span className={styles.panelLabel}>Moneta evento</span>
                    <strong className={styles.panelValue}>Scrip • 8.420</strong>
                    <span className={styles.panelHint}>Ricariche e consumi sincronizzati</span>
                  </div>

                  <div className={styles.panel}>
                    <span className={styles.panelLabel}>Stand coordinati</span>
                    <strong className={styles.panelValue}>24 attivi</strong>
                    <span className={styles.panelHint}>Menu, operatori e turni sotto controllo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.storySection} id="platform">
        <div className="page-shell">
          <div className={styles.storyGrid}>
            <article className={styles.storyCard}>
              <strong>Eventi leggibili a colpo d&apos;occhio</strong>
              <p>
                Dati chiave, immagini di copertina, localita e date restano ordinati e
                pronti per la pubblicazione.
              </p>
            </article>

            <article className={styles.storyCard}>
              <strong>Stand autonomi, regia centrale</strong>
              <p>
                Ogni responsabile vede il proprio perimetro operativo, mentre l&apos;admin
                dell&apos;evento mantiene il controllo generale.
              </p>
            </article>

            <article className={styles.storyCard}>
              <strong>Moneta interna senza attriti</strong>
              <p>
                Wallet, ricariche e storico delle transazioni costruiscono un flusso
                chiaro anche nelle fasce di massimo afflusso.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.featureSection} id="features">
        <div className="page-shell">
          <div className={styles.featureHeader}>
            <div>
              <span className="eyebrow">Funzioni core</span>
              <h2 className="section-title">Uno strato operativo unico per tutto l&apos;evento.</h2>
            </div>

            <p className="section-copy">
              La base e pensata per chi lavora davvero sul campo: meno schermate dispersive,
              piu controllo sulle attivita quotidiane e un modello dati che regge anche
              quando il numero di stand cresce.
            </p>
          </div>

          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <span className={styles.featureBadge}>01</span>
              <h3>Catalogo eventi</h3>
              <p>
                Localita con coordinate, date, logo, cover e galleria per una scheda evento
                completa e pronta da usare.
              </p>
            </article>

            <article className={styles.featureCard}>
              <span className={styles.featureBadge}>02</span>
              <h3>Ruoli per operatore</h3>
              <p>
                Permessi distinti per cucina, cassa e amministrazione, senza mischiare
                responsabilita che sul campo devono restare nette.
              </p>
            </article>

            <article className={styles.featureCard}>
              <span className={styles.featureBadge}>03</span>
              <h3>Menu tracciabili</h3>
              <p>
                Piatti, ingredienti e allergeni organizzati con una struttura che aiuta sia
                il team operativo sia la comunicazione al pubblico.
              </p>
            </article>

            <article className={styles.featureCard}>
              <span className={styles.featureBadge}>04</span>
              <h3>Wallet evento</h3>
              <p>
                Ogni utente puo avere un saldo dedicato alla moneta dell&apos;evento, con ledger
                delle transazioni e margine per ricariche, addebiti e storni.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.workflowSection} id="workflow">
        <div className="page-shell">
          <div className={styles.workflowHeader}>
            <div>
              <span className="eyebrow">Workflow</span>
              <h2 className="section-title">Pensata per il ritmo reale del servizio.</h2>
            </div>

            <p className="section-copy">
              L&apos;obiettivo non e solo archiviare dati: e aiutare chi gestisce l&apos;evento a
              passare da configurazione a operativita senza cambiare strumento ogni dieci minuti.
            </p>
          </div>

          <div className={styles.workflowGrid}>
            <article className={styles.workflowCard}>
              <span className={styles.step}>1</span>
              <strong>Configuri l&apos;evento</strong>
              <p>
                Inserisci dati anagrafici, moneta interna, immagini e identita visiva della
                manifestazione.
              </p>
            </article>

            <article className={styles.workflowCard}>
              <span className={styles.step}>2</span>
              <strong>Assegni operatori e stand</strong>
              <p>
                Colleghi utenti, ruoli e responsabilita, mantenendo separati i livelli di accesso.
              </p>
            </article>

            <article className={styles.workflowCard}>
              <span className={styles.step}>3</span>
              <strong>Gestisci vendite e wallet</strong>
              <p>
                Durante l&apos;evento controlli moneta, transazioni e attivita degli stand senza perdere il quadro generale.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  )
}
