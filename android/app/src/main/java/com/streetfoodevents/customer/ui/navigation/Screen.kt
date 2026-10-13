package com.streetfoodevents.customer.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector? = null) {
    object Events : Screen("events", "Eventi", Icons.Default.DateRange)
    object EventDetail : Screen("events/{eventId}", "Dettaglio Evento") {
        fun createRoute(eventId: String) = "events/$eventId"
    }
    object Menu : Screen("menu?eventId={eventId}", "Menu Stand", Icons.Default.Fastfood) {
        fun createRoute(eventId: String? = null) = if (eventId.isNullOrBlank()) "menu" else "menu?eventId=$eventId"
    }
    object Wallet : Screen("wallet", "Wallet", Icons.Default.AccountBalanceWallet)
    object OrderTrack : Screen("orders", "I Miei Ordini", Icons.AutoMirrored.Filled.ReceiptLong)
    object Settings : Screen("settings", "Impostazioni", Icons.Default.Settings)
}

val BottomNavItems = listOf(
    Screen.Events,
    Screen.Menu,
    Screen.Wallet,
    Screen.OrderTrack
)
