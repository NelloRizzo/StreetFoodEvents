import { Link, useParams } from 'react-router-dom'
import styles from './GuidePage.module.scss'

type QaSection = { title: string; items: { q: string; a: string }[] }

/* ── Glossary maps a term to the section title where it's explained ── */
type GlossaryEntry = { term: string; sectionTitle: string }

/* ═══════════════════════════════════════════════════════════════════════════
   Amministratore Evento
   ═══════════════════════════════════════════════════════════════════════════ */
const eventAdminSections: QaSection[] = [
  {
    title: 'Accesso e panoramica',
    items: [
      {
        q: 'Come accedo alla pagina di un evento?',
        a: 'Dalla home page clicca sulla card dell\'evento che ti interessa. In alternativa, dal menu "Eventi" nella barra di navigazione trovi l\'elenco completo. Puoi anche aggiungere un evento ai preferiti (clicca sul cuore ♡) per ritrovarlo velocemente nella sezione Preferiti.',
      },
      {
        q: 'Come faccio a vedere la mappa dell\'evento?',
        a: 'Apri la pagina dell\'evento e clicca sul pulsante "Mappa" subito sotto al titolo. La mapa mostra tutti gli stand con marker e i punti di interesse (POI) con icone dedicate. Clicca su un marker per vedere il nome e un link per aprire la scheda dettaglio.',
      },
    ],
  },
  {
    title: 'Gestione Punti di Interesse (POI)',
    items: [
      {
        q: 'Come aggiungo un punto di interesse (POI) all\'evento?',
        a: 'Nella pagina dell\'evento, scorri fino alla sezione "Punti di Interesse". Clicca su "Nuovo POI". Compila i campi: nome, descrizione, coordinate (latitudine e longitudine separate da virgola, es. 45.4642, 9.1900), seleziona un\'icona dalla lista. Puoi anche caricare un\'immagine di copertina e una galleria immagini. Clicca "Salva" per confermare.',
      },
      {
        q: 'Come modifico o elimino un POI?',
        a: 'Nella sezione "Punti di Interesse" della pagina evento, ogni POI ha i pulsanti "Modifica" ed "Elimina". Clicca "Modifica" per cambiarne nome, descrizione, coordinate o icona. Clicca "Elimina" per rimuoverlo definitivamente (conferma la richiesta).',
      },
    ],
  },
  {
    title: 'Cassa unica e ordini',
    items: [
      {
        q: 'Come attivo la cassa unica per l\'evento?',
        a: 'Devi avere il ruolo "cassiere evento" (event-cashier) assegnato dall\'amministratore di piattaforma. Una volta assegnato, nella pagina dell\'evento vedrai il pulsante "Cassa unica". Cliccalo per aprire la schermata di cassa, seleziona uno stand tra quelli presenti e procedi con la creazione degli ordini.',
      },
      {
        q: 'Come visualizzo tutti gli ordini dell\'evento?',
        a: 'Nella pagina dell\'evento clicca su "Gestisci ordini evento". Si apre una schermata con l\'elenco di tutti gli ordini, filtrabili per stand e per stato. Puoi cambiare lo stato degli ordini (segna come pronto, consegna effettuata) e annullarli se necessario.',
      },
      {
        q: 'Come rendo un prodotto non disponibile?',
        a: 'Vai alla pagina "Prodotti per evento" dal menu Amministrazione. Trova l\'associazione prodotto-evento-stand che vuoi disabilitare e clicca sul pulsante "Disponibile": diventerà "Non disp." e il prodotto non sarà più ordinabile nelle casse. Per riabilitarlo, clicca di nuovo. Puoi fare la stessa operazione anche dalla scheda dello stand, sezione "Prodotti".',
      },
      {
        q: 'Come elimino tutti gli ordini dell\'evento? (solo admin di piattaforma)',
        a: 'Apri la pagina dell\'evento. Se hai il ruolo di amministratore di piattaforma vedrai il pulsante "Cancella tutti gli ordini". Cliccalo e conferma. Attenzione: operazione irreversibile, rimuove definitivamente tutti gli ordini dell\'evento azzerando anche i contatori numerici degli stand. Pensata per pulire dati di test o dimostrazioni.',
      },
    ],
  },
]

const eventAdminGlossary: GlossaryEntry[] = [
  { term: 'Pagina evento', sectionTitle: 'Accesso e panoramica' },
  { term: 'Preferiti (cuore)', sectionTitle: 'Accesso e panoramica' },
  { term: 'Mappa evento', sectionTitle: 'Accesso e panoramica' },
  { term: 'POI (Punto di Interesse)', sectionTitle: 'Gestione Punti di Interesse (POI)' },
  { term: 'Coordinate (lat/lng)', sectionTitle: 'Gestione Punti di Interesse (POI)' },
  { term: 'Cassa unica', sectionTitle: 'Cassa unica e ordini' },
  { term: 'Gestisci ordini evento', sectionTitle: 'Cassa unica e ordini' },
  { term: 'Prodotto non disponibile', sectionTitle: 'Cassa unica e ordini' },
  { term: 'Cancella ordini evento', sectionTitle: 'Cassa unica e ordini' },
  { term: 'Ruolo event-cashier', sectionTitle: 'Cassa unica e ordini' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Cassiere Unico
   ═══════════════════════════════════════════════════════════════════════════ */
const eventCashierSections: QaSection[] = [
  {
    title: 'Accesso',
    items: [
      {
        q: 'Come accedo alla cassa unica?',
        a: 'Dalla pagina dell\'evento, clicca sul pulsante "Cassa unica". La schermata mostra un selettore dello stand in alto e una griglia di prodotti. Il primo stand dell\'evento è selezionato automaticamente.',
      },
      {
        q: 'Perché non vedo il pulsante "Cassa unica"?',
        a: 'Devi avere il ruolo "cassiere evento" (event-cashier) assegnato dall\'amministratore di piattaforma. Contatta l\'amministratore per la configurazione dei permessi.',
      },
    ],
  },
  {
    title: 'Selezione stand e cliente',
    items: [
      {
        q: 'Come cambio lo stand in cassa?',
        a: 'Nella barra in alto della schermata c\'è un menu a tendina con l\'elenco di tutti gli stand dell\'evento. Seleziona quello desiderato. I prodotti e le postazioni si aggiorneranno automaticamente.',
      },
      {
        q: 'Come seleziono un cliente?',
        a: 'Nella barra in alto c\'è un campo di ricerca cliente. Inizia a digitare il nome o l\'email: i risultati appaiono in un menu a tendina. In alternativa clicca il pulsante "📷 QR" per scansionare il QR code dell\'utente tramite webcam. Se l\'ordine è senza cliente specifico (cliente al banco), spunta "Ordine diretto".',
      },
    ],
  },
  {
    title: 'Creazione ordine',
    items: [
      {
        q: 'Come aggiungo prodotti al carrello?',
        a: 'I prodotti sono raggruppati per postazione (es. Cucina, Griglia, Bibite). Clicca sulla scheda della postazione per vedere i suoi prodotti, poi clicca sul prodotto desiderato. Si apre un modale dove puoi impostare la quantità e aggiungere note opzionali (es. "senza cipolla"). La postazione è già selezionata automaticamente in base alla scheda attiva. Clicca "Aggiungi" per inserire il prodotto nel carrello.',
      },
      {
        q: 'Come modifico la quantità di un prodotto nel carrello?',
        a: 'Nel riepilogo carrello a destra, ogni prodotto ha i pulsanti "−" e "+" per diminuire o aumentare la quantità. Puoi anche rimuovere completamente un prodotto cliccando la "×" accanto al suo nome.',
      },
      {
        q: 'Come gestisco il pagamento?',
        a: 'Nel pannello carrello, sotto il totale, trovi le opzioni di pagamento. Spunta "Paga ora" per procedere al pagamento. Puoi inserire un importo in crediti (es. 5.00 €): il resto verrà pagato in moneta reale (contanti / bancomat). Se imposti 0 crediti, il pagamento è interamente esterno. Clicca "Invia ordine" per completare.',
      },
      {
        q: 'Cosa succede dopo l\'invio dell\'ordine?',
        a: 'Compare un popup di conferma con il numero dell\'ordine (es. #42), l\'elenco prodotti, il totale e un QR code per la ricevuta digitale. Puoi cliccare "Stampa scontrino" per stampare o salvare come PDF, oppure "Chiudi" per tornare alla cassa e iniziare un nuovo ordine. I prodotti vengono inviati alle rispettive postazioni.',
      },
    ],
  },
  {
    title: 'Ricevuta e scontrino',
    items: [
      {
        q: 'Come trovo la ricevuta di un ordine passato?',
        a: 'Vai alla pagina "Gestisci ordini evento" dalla scheda dell\'evento. Trova l\'ordine nell\'elenco e clicca sul link "Ricevuta" tra le azioni disponibili. Si apre la ricevuta in una nuova scheda, stampabile.',
      },
      {
        q: 'Come stampo lo scontrino?',
        a: 'Subito dopo la creazione dell\'ordine, clicca "Stampa scontrino" nel popup di conferma. Il browser mostrerà l\'anteprima di stampa con il formato scontrino (caratteri monospaziati, sfondo bianco). In alternativa, apri la ricevuta digitale e usa la funzione Stampa del browser.',
      },
    ],
  },
]

const eventCashierGlossary: GlossaryEntry[] = [
  { term: 'Cassa unica', sectionTitle: 'Accesso' },
  { term: 'Ruolo event-cashier', sectionTitle: 'Accesso' },
  { term: 'Selettore stand', sectionTitle: 'Selezione stand e cliente' },
  { term: 'QR cliente', sectionTitle: 'Selezione stand e cliente' },
  { term: 'Ordine diretto', sectionTitle: 'Selezione stand e cliente' },
  { term: 'Carrello', sectionTitle: 'Creazione ordine' },
  { term: 'Pagamento con crediti', sectionTitle: 'Creazione ordine' },
  { term: 'Popup conferma ordine', sectionTitle: 'Creazione ordine' },
  { term: 'Scontrino', sectionTitle: 'Ricevuta e scontrino' },
  { term: 'Ricevuta digitale', sectionTitle: 'Ricevuta e scontrino' },
  { term: 'QR code ricevuta', sectionTitle: 'Ricevuta e scontrino' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Addetto a Postazione
   ═══════════════════════════════════════════════════════════════════════════ */
const stationAttendantSections: QaSection[] = [
  {
    title: 'Accesso alla coda',
    items: [
      {
        q: 'Come accedo alla coda della mia postazione?',
        a: 'Dalla dashboard (vista operatore), nella sezione "Gestione stand", clicca sul nome della tua postazione. Si apre una schermata a schermo intero con caratteri grandi e sfondo scuro, ottimizzata per essere vista da lontano. Se non vedi la tua postazione, contatta l\'amministratore per l\'assegnazione.',
      },
      {
        q: 'La pagina si aggiorna da sola?',
        a: 'Sì, la coda si ricarica automaticamente ogni 5 secondi. I nuovi ordini appena inseriti dai cassieri compariranno senza bisogno di ricaricare manualmente. Quando arrivano nuovi ordini sentirai un breve segnale acustico.',
      },
    ],
  },
  {
    title: 'Gestione ordini in coda',
    items: [
      {
        q: 'Come segnalo un prodotto come pronto?',
        a: 'Ogni ordine in coda mostra l\'elenco dei prodotti assegnati alla tua postazione. Accanto a ciascun prodotto c\'è un pulsante "Pronto". Cliccalo quando hai preparato quel prodotto. Il prodotto verrà barrato (testo cancellato) e il pulsante diventerà una spunta verde. Quando tutti i prodotti della tua postazione per quell\'ordine sono pronti, la card dell\'ordine scompare dalla coda.',
      },
      {
        q: 'Cosa succede quando tutti i prodotti dell\'ordine sono pronti?',
        a: 'Non devi fare altro: quando ogni postazione ha preparato tutti i suoi prodotti, lo stato dell\'ordine passa automaticamente a "Pronto". Il cassiere vedrà l\'ordine pronto per la consegna nella sua schermata.',
      },
      {
        q: 'Cosa devo fare se un ordine contiene prodotti di altre postazioni?',
        a: 'Vedrai solo i prodotti assegnati alla tua postazione. Gli altri prodotti dell\'ordine saranno visibili nelle code delle rispettive postazioni. Non devi preoccuparti di loro.',
      },
    ],
  },
  {
    title: 'Risoluzione problemi',
    items: [
      {
        q: 'Ho sbagliato a marcare un prodotto come pronto. Come faccio?',
        a: 'Purtroppo non è possibile annullare il "Pronto" di un singolo prodotto. Se l\'ordine non è ancora stato consegnato, contatta il cassiere che potrà gestire la situazione, eventualmente annullando l\'ordine e creandone uno nuovo.',
      },
      {
        q: 'La coda non mostra nuovi ordini. Cosa controllo?',
        a: 'Verifica che la connessione internet sia attiva. Controlla anche che la postazione sia correttamente assegnata: dalla dashboard operatore, la tua postazione deve apparire nella sezione "Gestione stand". Se il problema persiste, contatta l\'amministratore.',
      },
    ],
  },
]

const stationAttendantGlossary: GlossaryEntry[] = [
  { term: 'Coda postazione', sectionTitle: 'Accesso alla coda' },
  { term: 'Vista operatore', sectionTitle: 'Accesso alla coda' },
  { term: 'Dashboard operatore', sectionTitle: 'Accesso alla coda' },
  { term: 'Refresh automatico', sectionTitle: 'Accesso alla coda' },
  { term: 'Segnale acustico', sectionTitle: 'Accesso alla coda' },
  { term: 'Pulsante Pronto', sectionTitle: 'Gestione ordini in coda' },
  { term: 'Prodotto barrato', sectionTitle: 'Gestione ordini in coda' },
  { term: 'Stato ordine "Pronto"', sectionTitle: 'Gestione ordini in coda' },
  { term: 'Ordine completato', sectionTitle: 'Gestione ordini in coda' },
  { term: 'Annullamento Pronto', sectionTitle: 'Risoluzione problemi' },
  { term: 'Assegnazione postazione', sectionTitle: 'Risoluzione problemi' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Cassiere Stand
   ═══════════════════════════════════════════════════════════════════════════ */
const standCashierSections: QaSection[] = [
  {
    title: 'Accesso e vista operatore',
    items: [
      {
        q: 'Come accedo alla gestione del mio stand?',
        a: 'Dalla dashboard (vista operatore), nella sezione "Gestione stand", clicca sul nome dello stand. Si apre la scheda dello stand con tutte le informazioni. In alternativa, vai alla pagina "Gestisci ordini" dal pulsante nella scheda dello stand.',
      },
      {
        q: 'Come passo alla vista operatore?',
        a: 'Nella barra di navigazione in alto, clicca sul selettore "Utente / Operatore" per passare alla vista operatore. In questa vista la dashboard mostra gli strumenti di gestione stand e eventi.',
      },
    ],
  },
  {
    title: 'Creazione ordini',
    items: [
      {
        q: 'Come creo un nuovo ordine per il mio stand?',
        a: 'Dalla scheda dello stand, seleziona l\'evento di riferimento dal menu a tendina e clicca "Nuovo ordine". Si apre la schermata cassa con la griglia dei prodotti divisi per postazione. In alternativa, dalla pagina dell\'evento clicca su "Nuovo ordine" per lo stand desiderato.',
      },
      {
        q: 'Come seleziono un cliente?',
        a: 'Nella barra superiore della cassa, puoi digitare il nome o l\'email del cliente per cercarlo tra gli utenti registrati, oppure usare il pulsante "📷 QR" per scannerizzare il QR code dell\'utente. Se il cliente è al banco e non vuoi associarlo, spunta "Ordine diretto".',
      },
      {
        q: 'Come aggiungo prodotti al carrello?',
        a: 'I prodotti sono organizzati per postazione (Cucina, Griglia, Bibite…). Clicca sulla scheda della postazione per vedere i suoi prodotti. Clicca su un prodotto per aprire il modale: imposta quantità, aggiungi note (es. "ben cotto") e clicca "Aggiungi". Il prodotto finisce nel carrello a destra.',
      },
      {
        q: 'Come gestisco il pagamento?',
        a: 'Nel carrello, sotto il totale, puoi impostare l\'importo pagato con crediti (es. 5.00 €). La differenza verrà pagata in contanti o altro metodo. Se lasci 0 crediti, il pagamento sarà interamente esterno. Spunta "Paga ora" e clicca "Invia ordine". Se non spunti "Paga ora", l\'ordine resta in attesa di pagamento.',
      },
    ],
  },
  {
    title: 'Gestione ordini esistenti',
    items: [
      {
        q: 'Come vedo l\'elenco degli ordini del mio stand?',
        a: 'Dalla scheda dello stand, seleziona l\'evento e clicca "Gestisci ordini". Oppure vai alla dashboard operatore e clicca sul nome dello stand nella sezione "Gestione stand". La pagina mostra tutti gli ordini, filtrabili per stato (In attesa, Confermato, In preparazione, Pronto, Completato, Annullato).',
      },
      {
        q: 'Come segno un ordine come pronto?',
        a: 'Nella pagina "Gestisci ordini" del tuo stand, trova l\'ordine in stato "In preparazione". Clicca "Segna come pronto". Questo marcherà tutti i prodotti dell\'ordine come pronti e ne cambierà lo stato in "Pronto".',
      },
      {
        q: 'Come consegno un ordine al cliente?',
        a: 'Quando l\'ordine è in stato "Pronto", nella pagina "Gestisci ordini" vedrai il pulsante "Consegna effettuata". Cliccalo per portare l\'ordine a "Completato". L\'operazione è irreversibile.',
      },
      {
        q: 'Come annullo un ordine?',
        a: 'Nella pagina "Gestisci ordini", trova l\'ordine e clicca "Annulla". Ti verrà chiesto di inserire un motivo opzionale (es. "cliente rinuncia", "errore inserimento"). Se l\'ordine era stato pagato con crediti, questi verranno automaticamente rimborsati al cliente.',
      },
      {
        q: 'Come annullo solo alcuni prodotti di un ordine?',
        a: 'Se l\'ordine è in stato "In preparazione" e alcuni prodotti sono già pronti, puoi cliccare "Completa parziale". Si apre un pannello con la lista dei prodotti: spunta quelli che vuoi annullare e clicca "Conferma annullamento". I prodotti annullati vengono rimossi e l\'importo (se già pagato) viene rimborsato.',
      },
    ],
  },
  {
    title: 'Ricevute e resoconti',
    items: [
      {
        q: 'Come stampo la ricevuta di un ordine?',
        a: 'Dopo aver creato l\'ordine, nel popup di conferma clicca "Stampa scontrino". In alternativa, dalla pagina "Gestisci ordini" clicca su "Ricevuta" accanto all\'ordine desiderato. La ricevuta si apre in una nuova scheda e puoi stamparla o salvarla come PDF.',
      },
      {
        q: 'Come vedo il resoconto delle vendite del mio stand?',
        a: 'Nella pagina "Gestisci ordini" del tuo stand, in alto trovi il report con il totale degli ordini, l\'incasso totale, l\'importo pagato con crediti e l\'importo in moneta esterna. Puoi filtrare per periodo (date di inizio e fine) e per evento specifico, se lo stand partecipa a più eventi.',
      },
    ],
  },
]

const standCashierGlossary: GlossaryEntry[] = [
  { term: 'Vista operatore', sectionTitle: 'Accesso e vista operatore' },
  { term: 'Dashboard', sectionTitle: 'Accesso e vista operatore' },
  { term: 'Gestisci ordini', sectionTitle: 'Accesso e vista operatore' },
  { term: 'Nuovo ordine', sectionTitle: 'Creazione ordini' },
  { term: 'QR cliente', sectionTitle: 'Creazione ordini' },
  { term: 'Ordine diretto', sectionTitle: 'Creazione ordini' },
  { term: 'Carrello', sectionTitle: 'Creazione ordini' },
  { term: 'Pagamento crediti', sectionTitle: 'Creazione ordini' },
  { term: 'Filtro stato ordini', sectionTitle: 'Gestione ordini esistenti' },
  { term: 'Segna come pronto', sectionTitle: 'Gestione ordini esistenti' },
  { term: 'Consegna effettuata', sectionTitle: 'Gestione ordini esistenti' },
  { term: 'Annulla ordine', sectionTitle: 'Gestione ordini esistenti' },
  { term: 'Completa parziale', sectionTitle: 'Gestione ordini esistenti' },
  { term: 'Rimborso crediti', sectionTitle: 'Gestione ordini esistenti' },
  { term: 'Ricevuta', sectionTitle: 'Ricevute e resoconti' },
  { term: 'Stampa scontrino', sectionTitle: 'Ricevute e resoconti' },
  { term: 'Resoconto vendite', sectionTitle: 'Ricevute e resoconti' },
  { term: 'Report per periodo', sectionTitle: 'Ricevute e resoconti' },
]

/* ── Guide registry ── */
type RoleSlug = 'event-admin' | 'event-cashier' | 'station-attendant' | 'stand-cashier'

const roles: { slug: RoleSlug; label: string }[] = [
  { slug: 'event-admin', label: 'Amministratore Evento' },
  { slug: 'event-cashier', label: 'Cassiere Unico' },
  { slug: 'station-attendant', label: 'Addetto a Postazione' },
  { slug: 'stand-cashier', label: 'Cassiere Stand' },
]

const guides: Record<RoleSlug, { title: string; sections: QaSection[]; glossary: GlossaryEntry[] }> = {
  'event-admin': { title: 'Amministratore Evento', sections: eventAdminSections, glossary: eventAdminGlossary },
  'event-cashier': { title: 'Cassiere Unico', sections: eventCashierSections, glossary: eventCashierGlossary },
  'station-attendant': { title: 'Addetto a Postazione', sections: stationAttendantSections, glossary: stationAttendantGlossary },
  'stand-cashier': { title: 'Cassiere Stand', sections: standCashierSections, glossary: standCashierGlossary },
}

export function GuidePage() {
  const { role } = useParams<{ role: string }>()
  const guide = role && role in guides ? guides[role as RoleSlug] : null

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.switcher}>
          {roles.map((r) => (
            <Link
              key={r.slug}
              to={`/guide/${r.slug}`}
              className={`${styles.switchLink} ${r.slug === role ? styles.switchActive : ''}`}
            >
              {r.label}
            </Link>
          ))}
        </div>

        {!guide && (
          <div className={styles.landing}>
            <h1>Guide operative</h1>
            <p>Seleziona una guida dal menu sopra per visualizzarne i contenuti.</p>
          </div>
        )}

        {guide && (
          <>
            <div className={styles.stampHeader}>
              Street Food Events — <strong>{guide.title}</strong>
              <span className={styles.stampDate}>{new Date().toLocaleDateString('it-IT')}</span>
            </div>

            {guide.sections.map((section, si) => (
              <section key={si} className={styles.section}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <dl className={styles.qaList}>
                  {section.items.map((item, ii) => (
                    <div key={ii} className={styles.qaItem}>
                      <dt className={styles.question}>
                        <span className={styles.qLabel}>D.</span> {item.q}
                      </dt>
                      <dd className={styles.answer}>
                        <span className={styles.aLabel}>R.</span> {item.a}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}

            <section className={styles.glossary}>
              <h2 className={styles.sectionTitle}>Termini e riferimenti</h2>
              <table className={styles.glossaryTable}>
                <thead>
                  <tr>
                    <th>Termine</th>
                    <th>Dove si trova nella guida</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.glossary.map((entry, i) => (
                    <tr key={i}>
                      <td className={styles.glossaryTerm}>{entry.term}</td>
                      <td className={styles.glossaryRef}>{entry.sectionTitle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
