package com.streetfoodevents.app.ui.screens.standmenu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.streetfoodevents.app.data.model.EventDto
import com.streetfoodevents.app.data.model.MenuItemDto
import com.streetfoodevents.app.data.model.StandDto
import com.streetfoodevents.app.data.repository.AuthRepository
import com.streetfoodevents.app.data.repository.EventRepository
import com.streetfoodevents.app.data.repository.OrderRepository
import com.streetfoodevents.app.data.api.CreateOrderItem
import kotlinx.coroutines.launch

data class CartItem(
    val eventProductId: String,
    val productName: String,
    val stationId: String,
    val quantity: Int,
    val unitPrice: Double,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StandMenuScreen(
    eventId: String,
    standId: String,
    onOrderCreated: (String) -> Unit,
    onBack: () -> Unit,
) {
    val eventRepo = remember { EventRepository() }
    val orderRepo = remember { OrderRepository() }
    val authRepo = remember { AuthRepository() }
    val scope = rememberCoroutineScope()

    var event by remember { mutableStateOf<EventDto?>(null) }
    var stand by remember { mutableStateOf<StandDto?>(null) }
    var menuItems by remember { mutableStateOf<List<MenuItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var cart by remember { mutableStateOf<List<CartItem>>(emptyList()) }
    var isSubmitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var qrCode by remember { mutableStateOf<String?>(null) }
    var showQrDialog by remember { mutableStateOf(false) }

    LaunchedEffect(eventId, standId) {
        val eventResult = eventRepo.getEvent(eventId)
        val standResult = eventRepo.getStand(standId)
        val menuResult = eventRepo.getMenu(eventId, standId)

        eventResult.onSuccess { event = it }
        standResult.onSuccess { stand = it }
        menuResult.onSuccess { menuItems = it }
        isLoading = false
    }

    fun addToCart(item: MenuItemDto) {
        val product = item.product ?: return
        if (item.stationIds.isEmpty()) return
        val unitPrice = item.priceOverride ?: product.price
        val stationId = item.stationIds.first()

        val existing = cart.indexOfFirst { it.eventProductId == item.id }
        if (existing >= 0) {
            cart = cart.toMutableList().apply {
                this[existing] = this[existing].copy(quantity = this[existing].quantity + 1)
            }
        } else {
            cart = cart + CartItem(
                eventProductId = item.id,
                productName = product.name,
                stationId = stationId,
                quantity = 1,
                unitPrice = unitPrice,
            )
        }
    }

    val total = cart.sumOf { it.unitPrice * it.quantity }

    if (showQrDialog && qrCode != null) {
        AlertDialog(
            onDismissRequest = { showQrDialog = false },
            title = { Text(stand?.name ?: "Stand", fontWeight = FontWeight.Bold) },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Inquadra il QR code per aprire la pagina dello stand.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    AsyncImage(
                        model = qrCode,
                        contentDescription = "QR Code stand",
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
                title = { Text(stand?.name ?: "Menu") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        scope.launch {
                            val result = eventRepo.getStandQrCode(standId)
                            result.onSuccess { qrCode = it }
                            showQrDialog = true
                        }
                    }) {
                        Icon(Icons.Filled.QrCode, contentDescription = "QR Code")
                    }
                    if (cart.isNotEmpty()) {
                        BadgedBox(badge = { Badge { Text("${cart.size}") } }) {
                            Icon(Icons.Filled.ShoppingCart, contentDescription = "Carrello")
                        }
                    }
                },
            )
        },
        bottomBar = {
            if (cart.isNotEmpty()) {
                Surface(
                    tonalElevation = 3.dp,
                    shadowElevation = 8.dp,
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text("Totale", style = MaterialTheme.typography.labelSmall)
                            Text(
                                text = "${event?.currencyName ?: "€"} ${total.toInt()}",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        Button(
                            onClick = {
                                scope.launch {
                                    isSubmitting = true
                                    error = null
                                    val items = cart.map { c ->
                                        CreateOrderItem(
                                            eventProductId = c.eventProductId,
                                            stationId = c.stationId,
                                            quantity = c.quantity,
                                        )
                                    }
                                    val result = orderRepo.createOrder(
                                        eventId = eventId,
                                        standId = standId,
                                        customerName = null,
                                        items = items,
                                    )
                                    isSubmitting = false
                                    result.fold(
                                        onSuccess = { order -> onOrderCreated(order.id) },
                                        onFailure = { error = "Errore durante la creazione dell'ordine" },
                                    )
                                }
                            },
                            enabled = !isSubmitting,
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                )
                            } else {
                                Text("Ordina")
                            }
                        }
                    }
                }
            }
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
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    Spacer(Modifier.height(8.dp))
                    if (!stand?.slogan.isNullOrBlank()) {
                        Text(
                            text = stand!!.slogan!!,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(16.dp))
                    }
                }

                items(menuItems) { item ->
                    val product = item.product ?: return@items
                    val unitPrice = item.priceOverride ?: product.price
                    val qtyInCart = cart.find { it.eventProductId == item.id }?.quantity ?: 0

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = product.name,
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                if (product.ingredients.isNotEmpty()) {
                                    Text(
                                        text = product.ingredients.joinToString(", "),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = "${event?.currencyName ?: "€"} ${unitPrice.toInt()}",
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }

                            if (qtyInCart > 0) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    IconButton(onClick = {
                                        cart = cart.mapNotNull {
                                            if (it.eventProductId == item.id) {
                                                if (it.quantity > 1) it.copy(quantity = it.quantity - 1) else null
                                            } else it
                                        }
                                    }) {
                                        Icon(Icons.Filled.Remove, contentDescription = "Rimuovi")
                                    }
                                    Text(
                                        text = "$qtyInCart",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                            }

                            IconButton(onClick = { addToCart(item) }) {
                                Icon(Icons.Filled.Add, contentDescription = "Aggiungi")
                            }
                        }
                    }
                }

                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}
