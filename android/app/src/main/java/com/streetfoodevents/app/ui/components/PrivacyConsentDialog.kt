package com.streetfoodevents.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.streetfoodevents.app.data.ads.ConsentManager

@Composable
fun PrivacyConsentDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Benvenuto su Street Food Events",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "Questa applicazione utilizza cookie tecnici necessari al funzionamento e, con il tuo consenso, cookie analytics e pubblicitari.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )

                Spacer(Modifier.height(16.dp))

                Text(
                    text =
                        "Dati raccolti: nome, cognome, email (registrazione); " +
                                "ordini; cookie di sessione per autenticazione.\n\n" +
                                "Cookie analytics: statistiche di utilizzo (futuro).\n" +
                                "Cookie pubblicitari: annunci mirati (futuro).\n\n" +
                                "Puoi modificare le tue preferenze in qualsiasi momento " +
                                "dalla sezione Privacy del profilo.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Start,
                )

                Spacer(Modifier.height(24.dp))

                Button(
                    onClick = {
                        ConsentManager.acceptAll()
                        onDismiss()
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    Text("Accetta tutti")
                }

                Spacer(Modifier.height(8.dp))

                OutlinedButton(
                    onClick = {
                        ConsentManager.rejectAll()
                        onDismiss()
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    Text("Rifiuta tutti")
                }
            }
        },
        confirmButton = {},
        dismissButton = {},
    )
}
