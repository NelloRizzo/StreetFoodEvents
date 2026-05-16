package com.streetfoodevents.app.ui.screens.eventdetail

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.streetfoodevents.app.data.repository.EventRepository
import com.streetfoodevents.app.data.model.EventDto
import com.streetfoodevents.app.data.model.StandDto
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailScreen(
    eventId: String,
    onStandClick: (String) -> Unit,
    onBack: () -> Unit,
) {
    val repo = remember { EventRepository() }
    val scope = rememberCoroutineScope()
    var event by remember { mutableStateOf<EventDto?>(null) }
    var stands by remember { mutableStateOf<List<StandDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var qrCode by remember { mutableStateOf<String?>(null) }
    var showQrDialog by remember { mutableStateOf(false) }

    LaunchedEffect(eventId) {
        val eventResult = repo.getEvent(eventId)
        val standsResult = repo.getStands(eventId)

        eventResult.onSuccess { event = it }
        standsResult.onSuccess { stands = it }
        isLoading = false
    }

    if (showQrDialog && qrCode != null) {
        AlertDialog(
            onDismissRequest = { showQrDialog = false },
            title = { Text(event?.name ?: "Evento", fontWeight = FontWeight.Bold) },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Inquadra il QR code per aprire la pagina dell'evento.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    AsyncImage(
                        model = qrCode,
                        contentDescription = "QR Code evento",
                        modifier = Modifier.size(200.dp).clip(RoundedCornerShape(12.dp)),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showQrDialog = false }) { Text("Chiudi") }
            },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(event?.name ?: "Evento") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        scope.launch {
                            val result = repo.getEventQrCode(eventId)
                            result.onSuccess { qrCode = it }
                            showQrDialog = true
                        }
                    }) {
                        Icon(Icons.Filled.QrCode, contentDescription = "QR Code")
                    }
                },
            )
        },
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                event?.let { ev ->
                    item {
                        Spacer(Modifier.height(8.dp))

                        if (!ev.shortDescription.isNullOrBlank()) {
                            Text(
                                text = ev.shortDescription!!,
                                style = MaterialTheme.typography.bodyLarge,
                            )
                            Spacer(Modifier.height(8.dp))
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column {
                                Text("Data", style = MaterialTheme.typography.labelSmall)
                                Text(
                                    text = formatDate(ev.startDate),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                            Column {
                                Text("Valuta", style = MaterialTheme.typography.labelSmall)
                                Text(
                                    text = ev.currencyName,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }

                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = "Stand",
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                }

                items(stands) { stand ->
                    Card(
                        onClick = { onStandClick(stand.id) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = stand.name,
                                style = MaterialTheme.typography.titleMedium,
                            )
                            if (!stand.slogan.isNullOrBlank()) {
                                Text(
                                    text = stand.slogan!!,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }

                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}

private fun formatDate(iso: String): String {
    return try {
        val parts = iso.substring(0, 10).split("-")
        "${parts[2]}/${parts[1]}/${parts[0]}"
    } catch (_: Exception) {
        iso.substring(0, 10)
    }
}
