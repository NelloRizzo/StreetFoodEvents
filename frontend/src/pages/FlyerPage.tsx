import { useEffect } from 'react'
import styles from './FlyerPage.module.scss'

const theme = { brand: '#bf5a2a', ink: '#264137', inkStrong: '#14261f', inkSoft: '#587065', surface: '#fffaf2' }

const sections = [
  { icon: '\u{1F4CB}', title: 'Eventi', features: [
    { icon: '\u{1F3D7}\u{FE0F}', name: 'Creazione evento', desc: 'Copertina, galleria, luogo, date, url ufficiale e descrizioni breve/lunga.' },
    { icon: '\u{270F}\u{FE0F}', name: 'Editor Rich Text', desc: 'Descrizioni formattate con TipTap: grassetto, corsivo, elenchi, link e blockquote.' },
    { icon: '\u{1F4CD}', name: 'Punti di Interesse', desc: 'POI su mappa con cover, galleria e icone personalizzate.' },
    { icon: '\u{1F5FA}\u{FE0F}', name: 'Mappa interattiva', desc: 'Leaflet con marker per stand e POI, zoom adattivo e link rapidi.' },
    { icon: '\u{1F3A8}', name: 'Tema personalizzato', desc: 'Colori brand, testo, superficie e accento per ogni evento.' },
  ] },
  { icon: '\u{1F3EA}', title: 'Stand &amp; Menu', features: [
    { icon: '\u{1F3D7}\u{FE0F}', name: 'Gestione stand', desc: 'Nome, slogan, descrizione e posizione geografica su mappa.' },
    { icon: '\u{1F9D1}\u{200D}\u{1F373}', name: 'Postazioni', desc: 'Ogni stand ha sezioni operative: cucina, griglia, bibite, ecc.' },
    { icon: '\u{1F372}', name: 'Catalogo prodotti', desc: 'Nome, ingredienti, immagine cover e galleria multipla.' },
    { icon: '\u{1F4B0}', name: 'Prezzi flessibili', desc: 'Prezzo personalizzato per evento e per tipologia utente.' },
    { icon: '\u{2705}', name: 'Disponibilità', desc: 'Toggle on/off per escludere prodotti dagli ordini senza eliminarli.' },
  ] },
  { icon: '\u{1F6D2}', title: 'Ordini', features: [
    { icon: '\u{1F504}', name: 'Ciclo vita ordine', desc: 'Pending → confirmed → preparing → ready → completed, con cancellazione e rimborso crediti.' },
    { icon: '\u{1F4B3}', name: 'Pagamento misto', desc: 'Usa crediti evento + moneta reale insieme (es. 5 crediti + 5 €).' },
    { icon: '\u{1F4F1}', name: 'QR Code & ricevuta', desc: 'Ricevuta pubblica con QR code per ritiro ordine.' },
    { icon: '\u{1F514}', name: 'Notifica sonora', desc: 'Beep 880Hz in postazione quando arrivano nuovi ordini.' },
    { icon: '\u{1F4CA}', name: 'Storico e resoconti', desc: 'Report per stand: serata, manifestazione o tutte le edizioni.' },
  ] },
  { icon: '\u{1F465}', title: 'Ruoli &amp; Permessi', features: [
    { icon: '\u{1F510}', name: 'Platform-admin', desc: 'Accesso completo a tutti gli eventi, utenti e configurazioni.' },
    { icon: '\u{1F468}\u{200D}\u{1F4BB}', name: 'Event-admin', desc: 'Gestisce evento, POI, stand e operatori della manifestazione.' },
    { icon: '\u{1F9FE}', name: 'Event-cashier', desc: 'Cassa unica per tutto l\'evento, crea ordini per qualsiasi stand.' },
    { icon: '\u{1F4B5}', name: 'Stand-cashier', desc: 'Cassa stand, gestisce ordini e pagamenti.' },
    { icon: '\u{1F373}', name: 'Station-attendant', desc: 'Vista coda postazione, segnala piatti pronti.' },
    { icon: '\u{2705}', name: 'Stand-pickup', desc: 'Conferma solo la consegna degli ordini allo stand.' },
  ] },
  { icon: '\u{1F4B3}', title: 'Portafoglio', features: [
    { icon: '\u{1FA99}', name: 'Crediti evento', desc: 'Moneta interna dedicata a ogni manifestazione.' },
    { icon: '\u{1F4C4}', name: 'Transazioni tracciate', desc: 'Ledger completo con ricariche, addebiti e storni.' },
    { icon: '\u{1F4F7}', name: 'QR Code personale', desc: 'Identificazione utente via webcam per pagamenti rapidi.' },
    { icon: '\u{2764}\u{FE0F}', name: 'Preferiti', desc: 'Eventi e stand salvati per accesso rapido dal menu.' },
  ] },
  { icon: '\u{1F4CA}', title: 'Dashboard &amp; Operatività', features: [
    { icon: '\u{1F4BB}', name: 'Doppia dashboard', desc: 'Vista utente (eventi, wallet, QR) e operatore (gestione, report).' },
    { icon: '\u{1F5C3}\u{FE0F}', name: 'Cassa Unica POS', desc: 'Interfaccia calcolatrice con selezione cliente, griglia prodotti e pagamento misto.' },
    { icon: '\u{1F4F1}', name: 'Coda postazione', desc: 'Kiosk fullscreen, font grandi, auto-refresh 5s, bottone Pronto per item.' },
    { icon: '\u{1F4D6}', name: 'Guide stampabili', desc: '4 guide Q&A: amministratore, cassiere, addetto postazione, cassiere stand.' },
  ] },
  { icon: '\u{1F3A8}', title: 'Esperienza', features: [
    { icon: '\u{1F31F}', name: 'Temi stagionali', desc: '6 palette applicate automaticamente in base alla data.' },
    { icon: '\u{1F3A8}', name: 'Tema per evento', desc: '4 colori personalizzati con derivazioni automatiche via color-mix.' },
    { icon: '\u{1F4F1}', name: 'Mobile first', desc: 'Interfaccia responsive pensata per smartphone e tablet.' },
  ] },
]

function buildFlyerHtml() {
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

  const statsHtml = [
    { v: '7', l: 'Aree funzionali' },
    { v: '6', l: 'Ruoli dedicati' },
    { v: '100%', l: 'Mobile' },
    { v: '4', l: 'Guide stampabili' },
  ].map((s) =>
    `<div style="padding:0.75rem 0.5rem;border:1px solid #ddd;border-radius:10px;background:#fff;text-align:center">
      <span style="display:block;font-size:1.5rem;color:${theme.brand};line-height:1;margin-bottom:0.2rem;font-weight:700">${s.v}</span>
      <span style="font-size:0.7rem;color:#888;text-transform:uppercase">${s.l}</span>
    </div>`
  ).join('')

  const sectionsHtml = sections.map((sec) => {
    const featuresHtml = sec.features.map((f) =>
      `<div style="padding:0.85rem 1rem;border:1px solid #ddd;border-radius:10px;background:#fff;break-inside:avoid">
        <div style="font-size:1.1rem;margin-bottom:0.35rem">${f.icon}</div>
        <h3 style="font-size:0.9rem;color:${theme.inkStrong};margin:0 0 0.2rem;font-weight:600">${esc(f.name)}</h3>
        <p style="font-size:0.78rem;color:${theme.inkSoft};margin:0;line-height:1.5">${esc(f.desc)}</p>
      </div>`
    ).join('')

    return `
      <section style="padding:0 0 2rem">
        <div style="display:flex;align-items:center;gap:0.65rem;margin-bottom:1rem;border-bottom:2px solid rgba(191,90,42,0.1);padding-bottom:0.5rem">
          <span style="font-size:1.5rem">${sec.icon}</span>
          <h2 style="font-family:Georgia,serif;font-size:1.2rem;color:${theme.inkStrong};margin:0;font-weight:600">${sec.title}</h2>
        </div>
        <div style="display:grid;gap:0.6rem;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))">${featuresHtml}</div>
      </section>`
  }).join('')

  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Street Food Events — Volantino</title><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-family:'Segoe UI','Inter','Helvetica Neue',Arial,sans-serif;background:#fffaf2;color:${theme.ink};font-size:15px}
body{width:min(100%,1200px);margin:0 auto;padding:1rem 1.2rem 2rem}
@media print{@page{margin:0.5cm}body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media print{.no-print{display:none!important}}
.hero{display:grid;gap:1.25rem;justify-items:center;text-align:center;padding:2rem 0 1.5rem}
.hero h1{font-family:Georgia,serif;font-size:clamp(2rem,5vw,3.5rem);line-height:0.92;color:${theme.inkStrong};max-width:13ch;font-weight:400}
.hero .accent{color:${theme.brand};font-weight:700}
.hero p{max-width:34rem;font-size:1rem;line-height:1.7;color:${theme.inkSoft}}
.hero .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;width:100%;max-width:28rem}
@media(max-width:40rem){.hero .stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr!important}}
</style></head><body>
<a href="#" onclick="window.print();return false" style="display:inline-block;margin-bottom:0.5rem;padding:0.5rem 1.2rem;border:2px solid ${theme.brand};border-radius:999px;color:${theme.brand};font-weight:700;text-decoration:none;font-size:0.85rem" class="no-print">Stampa volantino</a>

<div class="hero">
  <span style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.35rem 0.85rem;border:1px solid rgba(38,65,55,0.22);border-radius:999px;background:rgba(255,250,242,0.72);color:#8d3f17;font-size:0.75rem;font-weight:700;text-transform:uppercase">&#x1F372; Street Food Events</span>
  <h1>Tutto l&rsquo;evento<br><span class="accent">in una piattaforma.</span></h1>
  <p>Dal primo stand all&rsquo;ultimo ordine: coordina eventi enogastronomici, gestisci stand, menu, postazioni, pagamenti misti e personale — tutto in un&rsquo;unica soluzione mobile-first.</p>
  <div class="stats">${statsHtml}</div>
</div>

<hr style="width:3rem;height:3px;background:linear-gradient(90deg,${theme.brand},transparent);border:none;border-radius:999px;margin:0 auto 1.5rem">

${sectionsHtml}

<section style="padding:1rem 0 2rem;text-align:center">
  <div style="max-width:32rem;margin:0 auto;display:grid;gap:1rem;padding:2rem;border:1px solid #ddd;border-radius:16px;background:#fff">
    <h2 style="font-family:Georgia,serif;font-size:1.5rem;color:${theme.inkStrong};font-weight:400">Pronto a organizzare il tuo prossimo evento?</h2>
    <p style="font-size:0.9rem;line-height:1.6;color:${theme.inkSoft}">Registrati gratis e scopri come Street Food Events trasforma la gestione di stand, ordini e pagamenti.</p>
    <a href="/register" style="display:inline-flex;align-items:center;justify-content:center;padding:0.9rem 1.8rem;border-radius:999px;font-weight:700;text-decoration:none;background:${theme.brand};color:#fff;font-size:0.9rem;width:fit-content;margin:0 auto">Crea account</a>
  </div>
</section>
</body></html>`
}

export function FlyerPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  function printFlyer() {
    const w = window.open('', '_blank', 'width=800,height=900')
    if (w) { w.document.write(buildFlyerHtml()); w.document.close() }
  }

  return (
    <div className={styles.page}>
      <div className={styles.printBar}>
        <button className={styles.printBtn} onClick={printFlyer}>Stampa volantino</button>
      </div>

      <section className={styles.hero}>
        <div className={styles.shell}>
          <div className={styles.heroInner}>
            <span className={styles.eyebrow}>&#x1F372; Street Food Events</span>
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
        { icon: '\u{1F4B5}', name: 'stand-cashier', desc: 'Cassa stand, gestisce ordini e pagamenti.' },
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
            <a className={styles.ctaBtn} href="/register" target="_blank" rel="noopener">Crea account</a>
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
