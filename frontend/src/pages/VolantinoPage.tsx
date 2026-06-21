import { useEffect } from 'react'
import styles from './VolantinoPage.module.scss'

export function VolantinoPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.shell}>
          <div className={styles.heroInner}>
            <span className={styles.eyebrow}>Street Food Events</span>
            <h1 className={styles.heroTitle}>
              Tutto l&rsquo;evento<br />
              <span className={styles.heroAccent}>in una piattaforma.</span>
            </h1>
            <p className={styles.heroCopy}>
              Dal primo stand all&rsquo;ultimo ordine: coordina eventi enogastronomici,
              gestisci stand, menu, postazioni, pagamenti misti e personale &mdash;
              tutto in un&rsquo;unica soluzione mobile-first.
            </p>

            <div className={styles.stats}>
              {[
                { value: '7', label: 'Aree funzionali' },
                { value: '6', label: 'Ruoli dedicati' },
                { value: '100%', label: 'Mobile' },
                { value: '4', label: 'Guide stampabili' },
              ].map((s) => (
                <div key={s.label} className={styles.stat}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.shell}><div className={styles.divider} /></div>

      <Section icon={'\u{1F4CB}'} title="Eventi" features={[
        { icon: '\u{1F3D7}\u{FE0F}', name: 'Creazione evento', desc: 'Copertina, galleria, luogo, date, url ufficiale e descrizioni breve/lunga.' },
        { icon: '\u{270F}\u{FE0F}', name: 'Editor Rich Text', desc: 'Descrizioni formattate con TipTap: grassetto, corsivo, elenchi, link e blockquote.' },
        { icon: '\u{1F4CD}', name: 'Punti di Interesse', desc: 'POI su mappa con cover, galleria e icone personalizzate.' },
        { icon: '\u{1F5FA}\u{FE0F}', name: 'Mappa interattiva', desc: 'Leaflet con marker per stand e POI, zoom adattivo e link rapidi.' },
        { icon: '\u{1F3A8}', name: 'Tema personalizzato', desc: 'Colori brand, testo, superficie e accento per ogni evento.' },
      ]} />

      <Section icon={'\u{1F3EA}'} title="Stand &amp; Menu" features={[
        { icon: '\u{1F3D7}\u{FE0F}', name: 'Gestione stand', desc: 'Nome, slogan, descrizione e posizione geografica su mappa.' },
        { icon: '\u{1F9D1}\u{200D}\u{1F373}', name: 'Postazioni', desc: 'Ogni stand ha sezioni operative: cucina, griglia, bibite, ecc.' },
        { icon: '\u{1F372}', name: 'Catalogo prodotti', desc: 'Nome, ingredienti, immagine cover e galleria multipla.' },
        { icon: '\u{1F4B0}', name: 'Prezzi flessibili', desc: 'Prezzo personalizzato per evento e per tipologia utente.' },
        { icon: '\u{2705}', name: 'Disponibilità', desc: 'Toggle on/off per escludere prodotti dagli ordini senza eliminarli.' },
      ]} />

      <Section icon={'\u{1F6D2}'} title="Ordini" features={[
        { icon: '\u{1F504}', name: 'Ciclo vita ordine', desc: 'pending → confirmed → preparing → ready → completed, con cancellazione e rimborso crediti.' },
        { icon: '\u{1F4B3}', name: 'Pagamento misto', desc: 'Usa crediti evento + moneta reale insieme (es. 5 crediti + 5 €).' },
        { icon: '\u{1F4F1}', name: 'QR Code & ricevuta', desc: 'Ricevuta pubblica con QR code per ritiro ordine.' },
        { icon: '\u{1F514}', name: 'Notifica sonora', desc: 'Beep 880Hz in postazione quando arrivano nuovi ordini.' },
        { icon: '\u{1F4CA}', name: 'Storico e resoconti', desc: 'Report per stand: serata, manifestazione o tutte le edizioni.' },
      ]} />

      <Section icon={'\u{1F465}'} title="Ruoli &amp; Permessi" features={[
        { icon: '\u{1F510}', name: 'platform-admin', desc: 'Accesso completo a tutti gli eventi, utenti e configurazioni.' },
        { icon: '\u{1F468}\u{200D}\u{1F4BB}', name: 'event-admin', desc: 'Gestisce evento, POI, stand e operatori della manifestazione.' },
        { icon: '\u{1F9FE}', name: 'event-cashier', desc: 'Cassa unica per tutto l\'evento, crea ordini per qualsiasi stand.' },
        { icon: '\u{1F4B5}', name: 'stand-cashier', desc: 'Cassa dedicata allo stand, gestisce ordini e pagamenti.' },
        { icon: '\u{1F373}', name: 'station-attendant', desc: 'Vista coda postazione, segnala piatti pronti.' },
        { icon: '\u{2705}', name: 'stand-pickup', desc: 'Conferma solo la consegna degli ordini allo stand.' },
      ]} />

      <Section icon={'\u{1F4B3}'} title="Portafoglio" features={[
        { icon: '\u{1FA99}', name: 'Crediti evento', desc: 'Moneta interna dedicata a ogni manifestazione.' },
        { icon: '\u{1F4C4}', name: 'Transazioni tracciate', desc: 'Ledger completo con ricariche, addebiti e storni.' },
        { icon: '\u{1F4F7}', name: 'QR Code personale', desc: 'Identificazione utente via webcam per pagamenti rapidi.' },
        { icon: '\u{2764}\u{FE0F}', name: 'Preferiti', desc: 'Eventi e stand salvati per accesso rapido dal menu.' },
      ]} />

      <Section icon={'\u{1F4CA}'} title="Dashboard &amp; Operatività" features={[
        { icon: '\u{1F4BB}', name: 'Doppia dashboard', desc: 'Vista utente (eventi, wallet, QR) e operatore (gestione, report).' },
        { icon: '\u{1F5C3}\u{FE0F}', name: 'Cassa Unica POS', desc: 'Interfaccia calcolatrice con selezione cliente, griglia prodotti e pagamento misto.' },
        { icon: '\u{1F4F1}', name: 'Coda postazione', desc: 'Kiosk fullscreen, font grandi, auto-refresh 5s, bottone Pronto per item.' },
        { icon: '\u{1F4D6}', name: 'Guide stampabili', desc: '4 guide Q&A: amministratore, cassiere, addetto postazione, cassiere stand.' },
      ]} />

      <Section icon={'\u{1F3A8}'} title="Esperienza" features={[
        { icon: '\u{1F31F}', name: 'Temi stagionali', desc: '6 palette applicate automaticamente in base alla data.' },
        { icon: '\u{1F3A8}', name: 'Tema per evento', desc: '4 colori personalizzati con derivazioni automatiche via color-mix.' },
        { icon: '\u{1F4F1}', name: 'Mobile first', desc: 'Interfaccia responsive pensata per smartphone e tablet.' },
      ]} />

      <div className={styles.shell}><div className={styles.divider} /></div>

      <section className={styles.ctaSection}>
        <div className={styles.shell}>
          <div className={styles.ctaInner}>
            <h2>Pronto a organizzare il tuo prossimo evento?</h2>
            <p>Registrati gratis e scopri come Street Food Events trasforma la gestione di stand, ordini e pagamenti.</p>
            <a className={styles.ctaBtn} href="/register" target="_blank" rel="noopener">
              Crea account
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

function Section({ icon, title, features }: { icon: string; title: string; features: { icon: string; name: string; desc: string }[] }) {
  return (
    <section className={styles.featureGroup}>
      <div className={styles.shell}>
        <div className={styles.groupHeader}>
          <span className={styles.groupIcon}>{icon}</span>
          <h2 className={styles.groupTitle}>{title}</h2>
        </div>
        <div className={styles.featureGrid}>
          {features.map((f) => (
            <div key={f.name} className={styles.featureCard}>
              <span className={styles.cardIcon}>{f.icon}</span>
              <h3 className={styles.cardName}>{f.name}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
