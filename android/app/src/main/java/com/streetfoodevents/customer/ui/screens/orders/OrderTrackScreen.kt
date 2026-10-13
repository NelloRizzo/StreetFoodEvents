package com.streetfoodevents.customer.ui.screens.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Store
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streetfoodevents.customer.data.model.OrderTrackDto
import com.streetfoodevents.customer.data.repository.StreetFoodRepository
import com.streetfoodevents.customer.ui.components.AppTopBar
import com.streetfoodevents.customer.ui.theme.BrandAccent
import com.streetfoodevents.customer.ui.theme.BrandPrimary
import com.streetfoodevents.customer.ui.theme.BrandPrimaryDark
import com.streetfoodevents.customer.ui.theme.StatusDelivered
import com.streetfoodevents.customer.ui.theme.StatusPending
import com.streetfoodevents.customer.ui.theme.StatusPreparing
import com.streetfoodevents.customer.ui.theme.StatusReady
import kotlinx.coroutines.launch

import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import com.streetfoodevents.customer.StreetFoodApp
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderTrackScreen() {
    val repository = remember { StreetFoodRepository() }
    val scope = rememberCoroutineScope()

    var inputOrderId by remember { mutableStateOf("") }
    var activeOrderId by remember { mutableStateOf("") }
    var orderData by remember { mutableStateOf<OrderTrackDto?>(null) }
    var recentOrders by remember { mutableStateOf(StreetFoodApp.instance.getRecentOrders()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun trackOrder(orderId: String) {
        val cleanId = orderId.trim()
        if (cleanId.isBlank()) return
        activeOrderId = cleanId
        scope.launch {
            isLoading = true
            errorMessage = null
            val result = repository.getOrderTrack(cleanId)
            result.onSuccess {
                orderData = it
                StreetFoodApp.instance.addRecentOrder(cleanId)
                recentOrders = StreetFoodApp.instance.getRecentOrders()
                isLoading = false
            }.onFailure { error ->
                errorMessage = error.localizedMessage ?: "Ordine non trovato o ID non valido."
                isLoading = false
            }
        }
    }

    // Auto-polling: re-checks order status every 5 seconds while active and in preparation
    LaunchedEffect(activeOrderId, orderData?.status) {
        val status = orderData?.status?.lowercase()
        if (activeOrderId.isNotBlank() && (status == null || status == "pending" || status == "confirmed" || status == "preparing")) {
            while (true) {
                delay(5000)
                val result = repository.getOrderTrack(activeOrderId)
                result.onSuccess { updated ->
                    orderData = updated
                }
            }
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Stato del Tuo Ordine",
                actions = {
                    if (activeOrderId.isNotBlank()) {
                        IconButton(onClick = { trackOrder(activeOrderId) }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Aggiorna")
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Search / Track box
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Traccia il tuo ordine",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Inserisci l'ID dell'ordine presente sullo scontrino per vedere lo stato di preparazione in tempo reale.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = inputOrderId,
                            onValueChange = { inputOrderId = it },
                            placeholder = { Text("Es. 65f2a1b9c...") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = BrandPrimary,
                                cursorColor = BrandPrimary
                            )
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = { trackOrder(inputOrderId) },
                            enabled = inputOrderId.isNotBlank() && !isLoading,
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary)
                        ) {
                            Icon(Icons.Default.Search, contentDescription = "Cerca")
                        }
                    }

                    // Recent orders quick chips
                    if (recentOrders.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Ordini recenti:",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            recentOrders.forEach { id ->
                                val isCurrent = id == activeOrderId
                                AssistChip(
                                    onClick = {
                                        inputOrderId = id
                                        trackOrder(id)
                                    },
                                    label = { Text("ID: …" + id.takeLast(6)) },
                                    trailingIcon = {
                                        Icon(
                                            Icons.Default.DeleteOutline,
                                            contentDescription = "Rimuovi",
                                            modifier = Modifier
                                                .size(16.dp)
                                                .clickable {
                                                    StreetFoodApp.instance.removeRecentOrder(id)
                                                    recentOrders = StreetFoodApp.instance.getRecentOrders()
                                                }
                                        )
                                    },
                                    colors = AssistChipDefaults.assistChipColors(
                                        containerColor = if (isCurrent) BrandAccent.copy(alpha = 0.3f) else MaterialTheme.colorScheme.surface
                                    )
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            when {
                isLoading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = BrandAccent)
                    }
                }
                errorMessage != null -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2))
                    ) {
                        Text(
                            text = errorMessage!!,
                            color = Color(0xFF991B1B),
                            modifier = Modifier.padding(16.dp),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
                orderData != null -> {
                    val order = orderData!!
                    OrderDetailsCard(order = order)
                }
                else -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Nessun ordine attualmente selezionato.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun OrderDetailsCard(order: OrderTrackDto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            // Header: Order Number and Stand
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "ORDINE #${order.orderNumber}",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = BrandPrimary
                    )
                    if (!order.standName.isNullOrBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Store, contentDescription = null, tint = BrandAccent, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = order.standName,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            if (order.status.lowercase() == "ready") {
                Spacer(modifier = Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFDCFCE7))
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = Color(0xFF16A34A), modifier = Modifier.size(28.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "IL TUO ORDINE È PRONTO!",
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF15803D),
                                fontSize = 16.sp
                            )
                            Text(
                                text = "Puoi ritirare i tuoi piatti presso lo stand indicato.",
                                color = Color(0xFF166534),
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Visual Status Stepper
            OrderStatusStepper(currentStatus = order.status)

            Spacer(modifier = Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(16.dp))

            // Order items
            Text(
                text = "Piatti Ordinati:",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))

            order.items.forEach { item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "${item.quantity}x ${item.productName}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    if (!item.stationName.isNullOrBlank()) {
                        Text(
                            text = item.stationName,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (!order.createdAt.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Effettuato alle: " + order.createdAt.take(16).replace("T", " "),
                    style = MaterialTheme.typography.bodyMedium,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun OrderStatusStepper(currentStatus: String) {
    val status = currentStatus.lowercase()

    val steps = listOf(
        Triple("pending", "In Attesa", Icons.Default.HourglassTop),
        Triple("preparing", "In Preparazione", Icons.Default.Restaurant),
        Triple("ready", "Pronto!", Icons.Default.NotificationsActive),
        Triple("delivered", "Ritirato", Icons.Default.Check)
    )

    val activeIndex = when (status) {
        "pending" -> 0
        "preparing" -> 1
        "ready" -> 2
        "delivered" -> 3
        else -> -1
    }

    if (status == "cancelled") {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFFFEE2E2))
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Close, contentDescription = null, tint = Color(0xFFDC2626))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Questo ordine è stato annullato.",
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFDC2626)
                )
            }
        }
        return
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        steps.forEachIndexed { index, (stepKey, label, icon) ->
            val isCompleted = index <= activeIndex
            val isCurrent = index == activeIndex

            val circleColor = when {
                isCurrent && stepKey == "ready" -> StatusReady
                isCurrent -> BrandAccent
                isCompleted -> BrandPrimary
                else -> Color(0xFFE5E7EB)
            }

            val iconColor = if (isCompleted) Color.White else Color.Gray

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(circleColor),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = iconColor,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Text(
                    text = label,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = if (isCurrent) FontWeight.ExtraBold else if (isCompleted) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isCurrent) BrandPrimary else if (isCompleted) Color.Black else Color.Gray
                )
            }

            if (index < steps.size - 1) {
                Box(
                    modifier = Modifier
                        .padding(start = 17.dp)
                        .width(2.dp)
                        .height(24.dp)
                        .background(if (index < activeIndex) BrandPrimary else Color(0xFFE5E7EB))
                )
            }
        }
    }
}
