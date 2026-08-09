# TODO — Street Food Events

## Visualizzazione Google Maps su EventMapPage (feature futura)
- Mostrare stand e POI dell'evento anche su una visualizzazione "Google Maps" scelta dall'utente nella mappa.
- Orientamento: soluzione **ufficiale con API key** (Google Maps JavaScript API), non endpoint tile non ufficiali (violano i ToS Google).
- Richiede: chiave API Google Cloud (Maps JavaScript API) configurata come `VITE_GOOGLE_MAPS_KEY`, vista/mappa dedicata con marker custom per evento, stand e POI (popup come l'attuale pagina Leaflet).
- Stato attuale: EventMapPage usa Leaflet con tile Esri (Satellite + Mappa); marker già renderizzati come overlay, ma nessuna base layer Google.
