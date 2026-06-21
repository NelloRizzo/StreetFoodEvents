import { Link } from 'react-router-dom'
import styles from './FlyerPage.module.scss'

const features = [
  {
    category: 'Eventi',
    icon: '📋',
    items: [
      { title: 'Creazione evento', desc: 'Copertina, galleria, luogo, date, url ufficiale e descrizioni breve/lunga.' },
      { title: 'Editor Rich Text', desc: 'Descrizioni formattate con TipTap: grassetto, corsivo, elenchi, link e blockquote.' },
      { title: 'Punti di Interesse', desc: 'POI su mappa con cover, galleria e icone personalizzate.' },
      { title: 'Mappa interattiva', desc: 'Leaflet con marker per stand e POI, zoom adattivo e link rapidi.' },
      { title: 'Tema personalizzato', desc: 'Colori brand, testo, superficie e accento per ogni evento.' },
    ],
  },
  {
    category: 'Stand & Menu',
    icon: '🏪',
    items: [
      { title: 'Gestione stand', desc: 'Nome, slogan, descrizione e posizione geografica su mappa.' },
      { title: 'Postazioni', desc: 'Ogni stand ha sezioni operative: cucina, griglia, bibite, ecc.' },
      { title: 'Catalogo prodotti', desc: 'Nome, ingredienti, immagine cover e galleria multipla.' },
      { title: 'Prezzi flessibili', desc: 'Prezzo personalizzato per evento e per tipologia utente.' },
      { title: 'Disponibilità', desc: 'Toggle on/off per escludere prodotti dagli ordini senza eliminarli.' },
    ],
  },
  {
    category: 'Ordini',
    icon: '🛒',
    items: [
      { title: 'Ciclo vita ordine', desc: 'pending → confirmed → preparing → ready → completed, con cancellazione e rimborso crediti.' },
      { title: 'Pagamento misto', desc: 'Usa crediti evento + moneta reale insieme (es. 5 crediti + 5 €).' },
      { title: 'QR Code & ricevuta', desc: 'Ricevuta pubblica con QR code per ritiro ordine.' },
      { title: 'Notifica sonora', desc: 'Beep 880Hz in postazione quando arrivano nuovi ordini.' },
      { title: 'Storico e resoconti', desc: 'Report per stand: serata, manifestazione o tutte le edizioni.' },
    ],
  },
  {
    category: 'Ruoli & Permessi',
    icon: '👥',
    items: [
      { title: 'platform-admin', desc: 'Accesso completo a tutti gli eventi, utenti e configurazioni.' },
      { title: 'event-admin', desc: 'Gestisce evento, POI, stand e operatori della manifestazione.' },
      { title: 'event-cashier', desc: 'Cassa unica per tutto l\'evento, crea ordini per qualsiasi stand.' },
      { title: 'stand-cashier', desc: 'Cassa dedicata allo stand, gestisce ordini e pagamenti.' },
      { title: 'station-attendant', desc: 'Vista coda postazione, segnala piatti pronti.' },
      { title: 'stand-pickup', desc: 'Conferma solo la consegna degli ordini allo stand.' },
    ],
  },
  {
    category: 'Portafoglio',
    icon: '💳',
    items: [
      { title: 'Crediti evento', desc: 'Moneta interna dedicata a ogni manifestazione.' },
      { title: 'Transazioni tracciate', desc: 'Ledger completo con ricariche, addebiti e storni.' },
      { title: 'QR Code personale', desc: 'Identificazione utente via webcam per pagamenti rapidi.' },
      { title: 'Preferiti', desc: 'Eventi e stand salvati per accesso rapido dal menu.' },
    ],
  },
  {
    category: 'Dashboard & Operatività',
    icon: '📊',
    items: [
      { title: 'Doppia dashboard', desc: 'Vista utente (eventi, wallet, QR) e operatore (gestione, report).' },
      { title: 'Cassa Unica POS', desc: 'Interfaccia calcolatrice con selezione cliente, griglia prodotti e pagamento misto.' },
      { title: 'Coda postazione', desc: 'Kiosk fullscreen, font grandi, auto-refresh 5s, bottone "Pronto" per item.' },
      { title: 'Guide stampabili', desc: '4 guide Q&A operative: amministratore, cassiere, addetto postazione, cassiere stand.' },
    ],
  },
  {
    category: 'Esperienza',
    icon: '🎨',
    items: [
      { title: 'Temi stagionali', desc: '6 palette (primavera, estate, autunno, inverno, natale, pasqua) applicate automaticamente.' },
      { title: 'Tema per evento', desc: '4 colori personalizzati con derivazioni automatiche via color-mix().' },
      { title: 'Mobile first', desc: 'Interfaccia responsive pensata per smartphone e tablet.' },
    ],
  },
]

export function FlyerPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="page-shell">
          <div className={styles.heroInner}>
            <span className="eyebrow">Street Food Events</span>
            <h1 className={styles.heroTitle}>
              Tutto l&apos;evento<br />
              <span className={styles.heroTitleAccent}>in una piattaforma.</span>
            </h1>
            <p className={styles.heroCopy}>
              Dal primo stand all&apos;ultimo ordine: coordina eventi enogastronomici,
              gestisci stand, menu, postazioni, pagamenti misti e personale —
              tutto in un&apos;unica soluzione mobile-first.
            </p>
            <div className={styles.heroCta}>
              <Link className={styles.ctaPrimary} to="/register">Inizia ora</Link>
              <Link className={styles.ctaSecondary} to="/platform">Scopri la piattaforma</Link>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <strong className={styles.statValue}>7</strong>
                <span className={styles.statLabel}>Aree funzionali</span>
              </div>
              <div className={styles.stat}>
                <strong className={styles.statValue}>30+</strong>
                <span className={styles.statLabel}>Funzionalità</span>
              </div>
              <div className={styles.stat}>
                <strong className={styles.statValue}>6</strong>
                <span className={styles.statLabel}>Ruoli dedicati</span>
              </div>
              <div className={styles.stat}>
                <strong className={styles.statValue}>100%</strong>
                <span className={styles.statLabel}>Mobile friendly</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {features.map((group) => (
        <section key={group.category} className={styles.featureGroup}>
          <div className="page-shell">
            <div className={styles.groupHeader}>
              <span className={styles.groupIcon}>{group.icon}</span>
              <h2 className={styles.groupTitle}>{group.category}</h2>
            </div>
            <div className={styles.featureGrid}>
              {group.items.map((item) => (
                <article key={item.title} className={styles.featureCard}>
                  <h3 className={styles.featureName}>{item.title}</h3>
                  <p className={styles.featureDesc}>{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className={styles.ctaSection}>
        <div className="page-shell">
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>
              Pronto a organizzare<br />
              il tuo prossimo evento?
            </h2>
            <p className={styles.ctaCopy}>
              Registrati gratis e scopri come Street Food Events trasforma
              la gestione di stand, ordini e pagamenti.
            </p>
            <div className={styles.ctaActions}>
              <Link className={styles.ctaPrimary} to="/register">Crea account</Link>
              <Link className={styles.ctaSecondary} to="/login">Accedi</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
