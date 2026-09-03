# Configurazione GTM — Eventi dataLayer

Riferimento per configurare in Google Tag Manager (container `GTM-W39HB9Q9`, proprietà GA4 `G-94RMSM6R5Z`) i tag oltre alla semplice page view.

## Prerequisito: tag GA4 Pageview

Tag "Google Analytics: GA4" con Tag ID `G-94RMSM6R5Z`, trigger **Page View / All Pages**. Copre la misurazione base delle pagine viste.

## Come aggiungere un evento personalizzato in GTM

Per ogni evento `sfe_*` che arriva sul dataLayer, si crea:

1. **Tag → Nuovo**
2. Nome: es. `GA4 - Event - <nome evento>`
3. **Configurazione tag → Google Analytics: GA4** con Tag ID `G-94RMSM6R5Z`
4. **Abilita "Enviare un evento personalizzato"** → nome evento (es. `sfe_order_created`)
5. Aggiungere i **parametri evento** (tabella sotto) come variabili
6. **Triggering → Custom Event** → nome evento = `sfe_order_created` → Salva
7. **Salva** e successivamente **Invia/Pubblica** del container

Nota: i nomi evento GA4 consigliati sono identici ai nomi `sfe_*` inviati sul dataLayer. I parametri si leggono con variabili **Data Layer** (chiave = nome parametro).

## Variabili di contesto (evento `context_set`)

Pushate da `PublicLayout` ad ogni cambio rotta (vedi `frontend/src/lib/gtm.ts`):

| Chiave dataLayer | Tipo | Descrizione |
|---|---|---|
| `user_role` | string | `guest` \| `user` \| `admin` |
| `user_logged_in` | boolean | true se utente autenticato non guest |
| `analytics_event_id` | string | eventId dalla route (vuoto se assente) |
| `analytics_stand_id` | string | standId dalla route (vuoto se assente) |

Sono pensate per split/segmentazione nei report GA4, non come eventi singoli.

## Eventi custom inviati (`frontend/src/lib/analytics.ts`)

### `sfe_order_created`
Creazione di un ordine dal menu pubblico dello stand.

| Parametro | Tipo | Note |
|---|---|---|
| `order_id` | string | id ordine |
| `event_id` | string | id evento |
| `stand_id` | string | id stand |
| `items` | number | totale pezzi ordinati |
| `total` | number | totale in valuta evento |
| `currency` | string | nome moneta evento |
| `is_gift` | boolean | true se ordine omaggio |

GA4: mappabile su `begin_checkout`/`purchase` se si vogliono standard e-commerce; qui dimensioni custom.

### `sfe_currency_exchange`
Change valuta dalla cassa cambio (top-up o refund).

| Parametro | Tipo | Note |
|---|---|---|
| `event_id` | string | id evento |
| `amount` | number | importo in crediti |
| `exchange_type` | string | `topup` \| `refund` |

### `sfe_poi_scanned`
Scansione di un POI durante una partecipazione al contest.

| Parametro | Tipo | Note |
|---|---|---|
| `contest_id` | string | id contest |
| `participant_id` | string | id partecipante |

### `sfe_photos_email_sent`
Invio di una o più foto via email dalla galleria.

| Parametro | Tipo | Note |
|---|---|---|
| `event_id` | string | id evento |
| `photos_count` | number | numero foto inviate |

## Note operative
- Gli eventi viaggiano SOLO sul dataLayer; i tag in GTM devono rispettare il **Consent Mode** (respeto `analytics_storage`): un evento non va inviato se il consenso analytics è negato.
- NON pushare PII (email, nomi) nei parametri.
- I nomi eventi custom con prefisso `sfe_` restano separati dagli eventi standard GA4 per non inquinare i report predefiniti.
