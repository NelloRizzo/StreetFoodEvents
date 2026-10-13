package com.streetfoodevents.customer.ui.screens.events

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CurrencyExchange
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DividerDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.streetfoodevents.customer.StreetFoodApp
import com.streetfoodevents.customer.data.model.EventDto
import com.streetfoodevents.customer.data.repository.StreetFoodRepository
import com.streetfoodevents.customer.ui.components.AppTopBar
import com.streetfoodevents.customer.ui.components.ErrorView
import com.streetfoodevents.customer.ui.components.LoadingView
import com.streetfoodevents.customer.ui.theme.BrandAccent
import com.streetfoodevents.customer.ui.theme.BrandPrimary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventDetailScreen(
    eventId: String,
    onNavigateBack: () -> Unit,
    onOpenMenu: (String) -> Unit,
    onOpenWallet: () -> Unit
) {
    val repository = remember { StreetFoodRepository() }
    val scope = rememberCoroutineScope()

    var event by remember { mutableStateOf<EventDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun loadDetail() {
        scope.launch {
            isLoading = true
            errorMessage = null
            val result = repository.getEventById(eventId)
            result.onSuccess {
                event = it
                isLoading = false
            }.onFailure { error ->
                errorMessage = error.localizedMessage ?: "Impossibile caricare l'evento"
                isLoading = false
            }
        }
    }

    LaunchedEffect(eventId) {
        loadDetail()
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = event?.name ?: "Dettaglio Evento",
                canNavigateBack = true,
                onNavigateBack = onNavigateBack
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when {
                isLoading -> LoadingView(message = "Caricamento dettagli evento...")
                errorMessage != null -> ErrorView(message = errorMessage!!, onRetry = { loadDetail() })
                event != null -> {
                    val ev = event!!
                    val scrollState = rememberScrollState()

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(scrollState)
                    ) {
                        val imageUrl = ev.coverImage?.getBestUrl()
                        if (!imageUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = ImageRequest.Builder(LocalContext.current)
                                    .data(imageUrl)
                                    .crossfade(true)
                                    .build(),
                                contentDescription = ev.name,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(220.dp)
                            )
                        }

                        Column(modifier = Modifier.padding(20.dp)) {
                            Text(
                                text = ev.name,
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            // Luogo
                            val context = LocalContext.current
                            val locationStr = ev.location?.toReadableString()
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.LocationOn,
                                    contentDescription = null,
                                    tint = BrandAccent,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = locationStr ?: "Luogo non indicato",
                                    style = MaterialTheme.typography.bodyLarge,
                                    modifier = Modifier.weight(1f)
                                )
                                if (!locationStr.isNullOrBlank()) {
                                    androidx.compose.material3.TextButton(
                                        onClick = {
                                            try {
                                                val uri = android.net.Uri.parse("geo:0,0?q=${android.net.Uri.encode(locationStr)}")
                                                val mapIntent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
                                                context.startActivity(mapIntent)
                                            } catch (e: Exception) {
                                                // Fallback browser
                                                val webUri = android.net.Uri.parse("https://www.google.com/maps/search/?api=1&query=${android.net.Uri.encode(locationStr)}")
                                                context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, webUri))
                                            }
                                        }
                                    ) {
                                        Text("Mappa", color = BrandPrimary, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Date
                            if (!ev.startDate.isNullOrBlank()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.CalendarToday,
                                        contentDescription = null,
                                        tint = BrandAccent,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    val start = ev.startDate.take(10)
                                    val end = ev.endDate?.take(10)
                                    val text = if (!end.isNullOrBlank()) "Dal $start al $end" else "Inizio: $start"
                                    Text(
                                        text = text,
                                        style = MaterialTheme.typography.bodyLarge
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Card Cambio Gettoni
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CurrencyExchange,
                                        contentDescription = null,
                                        tint = BrandPrimary,
                                        modifier = Modifier.size(28.dp)
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = "Valuta dell'evento",
                                            style = MaterialTheme.typography.labelLarge,
                                            color = BrandPrimary,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "1 € = ${ev.exchangeRate ?: 1.0} ${ev.currencyName ?: "Gettoni"}",
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(20.dp))

                            // Descrizione
                            val description = ev.longDescription ?: ev.shortDescription
                            if (!description.isNullOrBlank()) {
                                Text(
                                    text = "Descrizione",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = description,
                                    style = MaterialTheme.typography.bodyLarge
                                )
                                Spacer(modifier = Modifier.height(24.dp))
                            }

                            HorizontalDivider(color = DividerDefaults.color)
                            Spacer(modifier = Modifier.height(20.dp))

                            // Action buttons
                            Button(
                                onClick = {
                                    StreetFoodApp.instance.setSavedSelectedEventId(ev.id)
                                    onOpenMenu(ev.id)
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary)
                            ) {
                                Icon(Icons.Default.RestaurantMenu, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Esplora Menu degli Stand", fontWeight = FontWeight.Bold)
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            OutlinedButton(
                                onClick = {
                                    StreetFoodApp.instance.setSavedSelectedEventId(ev.id)
                                    onOpenWallet()
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = BrandPrimary)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Apri Wallet Gettoni", color = BrandPrimary, fontWeight = FontWeight.Bold)
                            }

                            Spacer(modifier = Modifier.height(24.dp))
                        }
                    }
                }
            }
        }
    }
}
