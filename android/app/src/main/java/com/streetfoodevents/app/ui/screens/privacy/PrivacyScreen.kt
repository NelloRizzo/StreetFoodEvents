package com.streetfoodevents.app.ui.screens.privacy

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.streetfoodevents.app.data.ads.ConsentManager

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrivacyScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Privacy") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Informativa Privacy", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Ultimo aggiornamento: maggio 2026", style = MaterialTheme.typography.bodySmall)

            Section("Titolare del trattamento") {
                Text("Street Food Events — piattaforma di gestione stand enogastronomici. I dati sono trattati esclusivamente per erogare i servizi della piattaforma.")
            }

            Section("Dati raccolti") {
                BulletList(
                    "Registrazione: nome, cognome, email, avatar (opzionale).",
                    "Ordini: prodotti ordinati, importo, metodo di pagamento, credito utilizzato.",
                    "Preferiti: eventi e stand che l'utente aggiunge ai preferiti.",
                    "Cookie: cookie di sessione (sid) per autenticazione, cookie analytics e pubblicitari (con consenso).",
                )
            }

            Section("Finalità del trattamento") {
                BulletList(
                    "Autenticazione e gestione dell'account.",
                    "Erogazione del servizio di ordinazione e pagamento.",
                    "Gestione dei preferiti e personalizzazione dell'esperienza.",
                    "Analisi statistiche aggregate (con consenso).",
                    "Pubblicità mirata (con consenso, futura).",
                )
            }

            Section("Base giuridica") {
                Text("Il trattamento si basa sul consenso dell'utente (cookie analytics/pubblicitari), sull'esecuzione del contratto (erogazione del servizio) e sul legittimo interesse del titolare (miglioramento della piattaforma).")
            }

            Section("Diritti dell'utente (GDPR)") {
                BulletList(
                    "Accedere ai propri dati personali (art. 15 GDPR).",
                    "Richiedere la rettifica dei dati inesatti (art. 16 GDPR).",
                    "Richiedere la cancellazione dei dati (art. 17 GDPR).",
                    "Richiedere la limitazione del trattamento (art. 18 GDPR).",
                    "Richiedere la portabilità dei dati (art. 20 GDPR).",
                    "Opporsi al trattamento (art. 21 GDPR).",
                    "Revocare il consenso in qualsiasi momento.",
                )
                Spacer(Modifier.height(8.dp))
                Text("Per esercitare i tuoi diritti: privacy@streetfoodevents.test")
            }

            Section("Terze parti") {
                BulletList(
                    "Google AdMob: pubblicità nell'app (futuro).",
                    "Google Analytics / Google Tag Manager: statistiche di navigazione (futuro, con consenso).",
                )
            }

            Section("Preferenze consenso") {
                Text(
                    if (ConsentManager.isConsentGiven())
                        "Stato: consenso già espresso. " +
                        "Analytics: ${if (ConsentManager.isAnalyticsConsent()) "accettati" else "rifiutati"}. " +
                        "Pubblicitari: ${if (ConsentManager.isAdsConsent()) "accettati" else "rifiutati"}."
                    else
                        "Consenso non ancora espresso."
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = { ConsentManager.acceptAll() }) {
                    Text("Accetta tutti")
                }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = { ConsentManager.rejectAll() }) {
                    Text("Rifiuta tutti")
                }
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        content()
    }
}

@Composable
private fun BulletList(vararg items: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        items.forEach { item ->
            Text("• $item", style = MaterialTheme.typography.bodySmall)
        }
    }
}
