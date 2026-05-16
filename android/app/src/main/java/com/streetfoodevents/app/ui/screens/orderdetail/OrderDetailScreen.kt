package com.streetfoodevents.app.ui.screens.orderdetail

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.streetfoodevents.app.data.model.OrderDto
import com.streetfoodevents.app.data.repository.OrderRepository
import kotlinx.coroutines.launch

fun statusLabel(status: String): String = when (status) {
    "pending" -> "In attesa"
    "confirmed" -> "Confermato"
    "preparing" -> "In preparazione"
    "ready" -> "Pronto"
    "completed" -> "Completato"
    "cancelled" -> "Annullato"
    else -> status
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    orderId: String,
    onBack: () -> Unit,
) {
    val repo = remember { OrderRepository() }
    val scope = rememberCoroutineScope()
    var order by remember { mutableStateOf<OrderDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isPaying by remember { mutableStateOf(false) }
    var isCancelling by remember { mutableStateOf(false) }

    fun refresh() {
        scope.launch {
            val result = repo.getOrder(orderId)
            result.onSuccess { order = it }
        }
    }

    LaunchedEffect(orderId) {
        val result = repo.getOrder(orderId)
        result.onSuccess { order = it }
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Dettaglio ordine") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                    }
                },
            )
        },
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (order == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Ordine non trovato")
            }
        } else {
            val o = order!!

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Ordine #${o.orderNumber}",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        Surface(
                            shape = MaterialTheme.shapes.small,
                            color = MaterialTheme.colorScheme.primaryContainer,
                        ) {
                            Text(
                                text = statusLabel(o.status),
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                            )
                        }
                    }
                }

                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Articoli", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(8.dp))
                            o.items.forEach { item ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = item.productName,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                        Text(
                                            text = "${item.stationName} · x${item.quantity}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    Text(
                                        text = "€${item.subtotal.toInt()}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                                HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text("Totale", style = MaterialTheme.typography.titleMedium)
                                Text(
                                    text = "€${o.total.toInt()}",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                    }
                }

                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Pagamento", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text("Stato", style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    text = when (o.paymentStatus) {
                                        "paid" -> "Pagato"
                                        "refunded" -> "Rimborsato"
                                        else -> "Da pagare"
                                    },
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                            if (o.creditAmountUsed > 0) {
                                Spacer(Modifier.height(4.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text("Usato wallet", style = MaterialTheme.typography.bodySmall)
                                    Text(
                                        text = "€${o.creditAmountUsed.toInt()}",
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                }
                            }
                        }
                    }
                }

                item {
                    if (o.paymentStatus == "unpaid" && o.status != "cancelled") {
                        Button(
                            onClick = {
                                scope.launch {
                                    isPaying = true
                                    val result = repo.payOrder(o.id)
                                    isPaying = false
                                    result.onSuccess { order = it }
                                }
                            },
                            enabled = !isPaying,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (isPaying) {
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Paga ora")
                            }
                        }
                    }

                    if (o.status != "completed" && o.status != "cancelled") {
                        Spacer(Modifier.height(8.dp))
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    isCancelling = true
                                    val result = repo.cancelOrder(o.id)
                                    isCancelling = false
                                    result.onSuccess { order = it }
                                }
                            },
                            enabled = !isCancelling,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.error,
                            ),
                        ) {
                            if (isCancelling) {
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Annulla ordine")
                            }
                        }
                    }
                }

                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}
