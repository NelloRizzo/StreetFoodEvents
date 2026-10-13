# Street Food Events — App Android Visitatore

Applicazione Android nativa sviluppata in **Kotlin** e **Jetpack Compose** (Material 3) per i visitatori e clienti di **Street Food Events**.

---

## 📱 Funzionalità Principali

1. **Esplora Eventi**:
   - Visualizzazione degli eventi enogastronomici pubblici in arrivo.
   - Ricerca per nome evento, città o indirizzo.
   - Scheda dettaglio evento con data, luogo, tasso di cambio gettoni/€ e regolamento.

2. **Menu Stand**:
   - Consultazione di piatti e bevande offerti dai vari stand dell'evento.
   - Filtro rapido per categorie (es. Primi, Secondi, Dolci, Birre).
   - Dettaglio ingredienti, bollini allergeni (Glutine, Lattosio, ecc.) e indicazione surgelati.
   - Visualizzazione del prezzo in Gettoni dell'evento e controvalore in Euro.

3. **Wallet & Gettoni**:
   - Scheda del saldo gettoni disponibile in tempo reale.
   - **QR Code Personale**: genera il codice QR del cliente a schermo, scansionabile dal cassiere del **Banco Cambio** per effettuare ricariche gettoni o rimborsi.
   - Storico completo delle transazioni (ricariche, spese stand, rimborsi).

4. **Tracciamento Ordini**:
   - Stepper visivo dello stato di avanzamento:
     - ⏳ In attesa
     - 🍳 In preparazione (in cucina)
     - 🔔 Pronto per il ritiro!
     - ✅ Ritirato / Consegnato
   - Elenco dettagliato dei prodotti inclusi e stand di ritiro.

5. **Configurazione Connessione API**:
   - Possibilità di cambiare l'URL del server direttamente dalle impostazioni dell'app:
     - **Cloud Produzione**: `https://streetfoodevents.onrender.com/`
     - **Emulatore Android (locale)**: `http://10.0.2.2:4000/`
     - **Dispositivo fisico su Wi-Fi**: `http://<IP-DEL-TUO-PC>:4000/`

---

## 🚀 Come Aprire ed Eseguire il Progetto con Android Studio

### 1. Requisiti
- **Android Studio** (versione Iguana, Jellyfish, Koala o successiva).
- **JDK 17** o superiore (incluso di default in Android Studio).
- **Android SDK Platform 34** (Android 14) installato tramite SDK Manager.

### 2. Apertura in Android Studio
1. Avvia Android Studio.
2. Clicca su **Open** (oppure `File -> Open...`).
3. Seleziona la cartella `android` situata nella root di questo repository:
   ```
   e:\Codice\StreetFoodEvents\android
   ```
4. Clicca su **OK**. Android Studio rileverà il progetto Gradle e avvierà automaticamente la sincronizzazione (`Gradle Sync`).

### 3. Esecuzione su Emulatore o Dispositivo
1. Nella barra superiore di Android Studio, seleziona il dispositivo di destinazione (es. un emulatore Pixel con API 34 o il tuo smartphone Android collegato via USB con debug attivo).
2. Clicca sul pulsante **Run (Play verde)** o premi `Shift + F10`.
3. L'applicazione verrà compilata ed eseguita sul dispositivo.

---

## 🛠️ Stack Tecnologico e Architettura

- **Linguaggio**: Kotlin 2.0
- **UI Toolkit**: Jetpack Compose con Material Design 3
- **Navigazione**: Jetpack Navigation Compose
- **Networking**: Retrofit 2 + Gson Converter + OkHttp 3 (Logging Interceptor)
- **Caricamento Immagini**: Coil Compose
- **Generazione QR Code**: ZXing Core
- **Asincronia**: Kotlin Coroutines & Flow
- **Architettura**: MVVM / Clean Architecture con Repository pattern
