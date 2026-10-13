package com.streetfoodevents.customer.ui.screens.wallet

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.streetfoodevents.customer.StreetFoodApp
import com.streetfoodevents.customer.data.model.EventUserDto
import com.streetfoodevents.customer.data.model.TransactionDto
import com.streetfoodevents.customer.data.repository.StreetFoodRepository
import com.streetfoodevents.customer.ui.components.AppTopBar
import com.streetfoodevents.customer.ui.components.QrCodeView
import com.streetfoodevents.customer.ui.theme.BrandAccent
import com.streetfoodevents.customer.ui.theme.BrandPrimary
import com.streetfoodevents.customer.ui.theme.BrandPrimaryDark
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    onOpenSettings: () -> Unit
) {
    val repository = remember { StreetFoodRepository() }
    val scope = rememberCoroutineScope()

    var walletId by remember {
        mutableStateOf(StreetFoodApp.instance.getSavedWalletId())
    }
    var inputWalletId by remember { mutableStateOf(walletId) }
    var isEditingId by remember { mutableStateOf(walletId.isBlank()) }

    var walletData by remember { mutableStateOf<EventUserDto?>(null) }
    var transactions by remember { mutableStateOf<List<TransactionDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun refreshWallet(idToLoad: String) {
        if (idToLoad.isBlank()) {
            walletData = null
            transactions = emptyList()
            return
        }

        scope.launch {
            isLoading = true
            errorMessage = null

            val userRes = repository.getEventUser(idToLoad)
            userRes.onSuccess {
                walletData = it
                val txRes = repository.getWalletTransactions(idToLoad)
                txRes.onSuccess { list ->
                    transactions = list
                }
                isLoading = false
            }.onFailure { error ->
                errorMessage = error.localizedMessage ?: "Impossibile recuperare il wallet."
                isLoading = false
            }
        }
    }

    LaunchedEffect(walletId) {
        if (walletId.isNotBlank()) {
            refreshWallet(walletId)
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Il Mio Wallet",
                actions = {
                    if (walletId.isNotBlank()) {
                        IconButton(onClick = { refreshWallet(walletId) }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Aggiorna")
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
            }

            // Wallet ID Setup / Editing Box
            item {
                if (isEditingId || walletId.isBlank()) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Collega il tuo Wallet o Braccialetto",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Inserisci l'identificativo del tuo wallet (presente sul pass o fornito dalla cassa cambio) per visualizzare saldo e movimenti in tempo reale.",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedTextField(
                                value = inputWalletId,
                                onValueChange = { inputWalletId = it },
                                label = { Text("ID Wallet / EventUser") },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                                shape = RoundedCornerShape(10.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = BrandPrimary,
                                    cursorColor = BrandPrimary
                                )
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                androidx.compose.material3.OutlinedButton(
                                    onClick = {
                                        val newId = StreetFoodApp.instance.generateAndSaveVisitorWalletId()
                                        walletId = newId
                                        inputWalletId = newId
                                        isEditingId = false
                                        refreshWallet(newId)
                                    }
                                ) {
                                    Icon(Icons.Default.QrCode, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Genera Nuovo ID")
                                }

                                Row {
                                    if (walletId.isNotBlank()) {
                                        Button(
                                            onClick = { isEditingId = false },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color.Gray)
                                        ) {
                                            Text("Annulla")
                                        }
                                        Spacer(modifier = Modifier.width(8.dp))
                                    }
                                    Button(
                                        onClick = {
                                            val cleanId = inputWalletId.trim()
                                            walletId = cleanId
                                            StreetFoodApp.instance.setSavedWalletId(cleanId)
                                            isEditingId = false
                                            refreshWallet(cleanId)
                                        },
                                        enabled = inputWalletId.isNotBlank(),
                                        colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary)
                                    ) {
                                        Text("Salva")
                                    }
                                }
                            }
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = "ID Wallet Collegato", style = MaterialTheme.typography.bodyMedium, fontSize = 12.sp)
                            Text(text = walletId, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        }
                        IconButton(onClick = { isEditingId = true }) {
                            Icon(Icons.Default.Edit, contentDescription = "Modifica ID", tint = BrandPrimary)
                        }
                    }
                }
            }

            // Wallet Balance Card
            if (walletId.isNotBlank()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = BrandPrimaryDark),
                        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "SALDO DISPONIBILE",
                                color = BrandAccent,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            if (isLoading && walletData == null) {
                                CircularProgressIndicator(color = BrandAccent, modifier = Modifier.size(36.dp))
                            } else {
                                val balance = walletData?.balance ?: 0.0
                                Text(
                                    text = "${balance.toInt()} Gettoni",
                                    color = Color.White,
                                    fontSize = 36.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Valore stimato: ${String.format(java.util.Locale.ITALY, "%.2f €", balance)}",
                                    color = Color.White.copy(alpha = 0.8f),
                                    fontSize = 15.sp
                                )
                            }
                        }
                    }
                }

                // Personal QR Code Section
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.QrCode, contentDescription = null, tint = BrandPrimary)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Il Tuo QR Code Personale",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Spacer(modifier = Modifier.height(16.dp))
                            QrCodeView(content = walletId, size = 200.dp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "Mostra questo codice al Banco Cambio per ricaricare gettoni o chiedere il rimborso.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 8.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }

                // Transactions Header
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Ultimi Movimenti",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        if (transactions.isNotEmpty()) {
                            Text(
                                text = "${transactions.size} operazioni",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }

                if (transactions.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (isLoading) "Caricamento movimenti..." else "Nessuna transazione registrata per questo wallet.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                } else {
                    items(transactions, key = { it.id }) { tx ->
                        TransactionRow(tx = tx)
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun TransactionRow(tx: TransactionDto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val isIncome = tx.isTopUp()
                val icon = if (isIncome) Icons.Default.ArrowDownward else Icons.Default.ArrowUpward
                val iconBg = if (isIncome) Color(0xFFD1FAE5) else Color(0xFFFEE2E2)
                val iconTint = if (isIncome) Color(0xFF065F46) else Color(0xFF991B1B)

                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(iconBg),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = iconTint,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = tx.description ?: if (isIncome) "Ricarica Gettoni" else "Spesa / Rimborso",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (!tx.occurredAt.isNullOrBlank()) {
                        Text(
                            text = tx.occurredAt.take(16).replace("T", " "),
                            style = MaterialTheme.typography.bodyMedium,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            val sign = if (tx.isTopUp()) "+" else "-"
            val amountColor = if (tx.isTopUp()) Color(0xFF059669) else Color(0xFFDC2626)
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "$sign${tx.amount.toInt()} G",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = amountColor
                )
                Text(
                    text = "Saldo: ${tx.balanceAfter.toInt()}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontSize = 12.sp
                )
            }
        }
    }
}
