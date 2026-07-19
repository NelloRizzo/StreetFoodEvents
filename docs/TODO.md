# TODO — Street Food Events

## In sospeso

### Contest: POI per gruppi con selezione casuale

- [ ] Aggiungere campo `group` sul modello ContestPOI (stringa, es. "Cibo", "Bevande", "Giochi")
- [ ] Aggiungere campo `pickConfig` sul modello Contest: `{ groupPicks: { group: string, count: number }[] }`
- [ ] Backend: logica di auto-pick alla creazione del contest — dati i gruppi e il numero per gruppo, seleziona POI casuali e li aggiunge a orderedPOIIds
- [ ] Backend: updateContest deve preservare POI manuali se già in orderedPOIIds + ricalcolare quelli da gruppi
- [ ] Frontend EventDetailPage: UI per creare gruppi (nome gruppo + slider/input per quanti POI prelevare)
- [ ] Frontend EventDetailPage: mostrare POI divisi per gruppo, checkbox per selezionarli manualmente
- [ ] Frontend EventDetailPage: permettere aggiunte manuali prima e dopo la selezione automatica
- [ ] ContestPlayPage e registerScan devono funzionare invariati (orderedPOIIds risolto a POI specifici)

### Deploy

- [ ] **Errore 403 su clone GitHub** — verificare token di accesso/repo su Render Deploy Settings
