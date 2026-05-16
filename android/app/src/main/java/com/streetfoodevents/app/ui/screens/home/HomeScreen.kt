package com.streetfoodevents.app.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.streetfoodevents.app.data.model.HomeEventDto
import com.streetfoodevents.app.data.repository.AuthRepository
import com.streetfoodevents.app.data.repository.EventRepository
import com.streetfoodevents.app.data.repository.FavoriteRepository
import kotlinx.coroutines.launch

data class HomeUiState(
    val isLoading: Boolean = true,
    val isLoggedIn: Boolean = false,
    val userName: String = "",
    val avatarUrl: String? = null,
    val favorites: List<HomeEventDto> = emptyList(),
    val activeEvents: List<com.streetfoodevents.app.data.model.EventDto> = emptyList(),
    val error: String? = null,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onEventClick: (String) -> Unit,
    onOrdersClick: () -> Unit,
    onFavoritesClick: () -> Unit,
    onLoginClick: () -> Unit,
    onRegisterClick: () -> Unit,
    onProfileClick: () -> Unit,
    onPrivacyClick: () -> Unit = {},
    onLogout: () -> Unit,
) {
    val authRepo = remember { AuthRepository() }
    val eventRepo = remember { EventRepository() }
    val scope = rememberCoroutineScope()

    var state by remember { mutableStateOf(HomeUiState()) }
    var showAllEvents by remember { mutableStateOf(false) }
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showUserMenu by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val userResult = authRepo.getMe()

        userResult.onSuccess { user ->
            state = state.copy(isLoggedIn = true, userName = user.firstName, avatarUrl = user.avatar?.url)
            val homeResult = eventRepo.getHomeData()
            homeResult.onSuccess { data ->
                state = state.copy(
                    isLoading = false,
                    favorites = data.favorites,
                    activeEvents = data.activeEvents,
                )
            }.onFailure {
                state = state.copy(isLoading = false, error = "Impossibile caricare i dati")
            }
        }.onFailure {
            state = state.copy(isLoggedIn = false)
            val eventsResult = eventRepo.listEvents()
            eventsResult.onSuccess { events ->
                state = state.copy(
                    isLoading = false,
                    activeEvents = events,
                )
            }.onFailure {
                state = state.copy(isLoading = false, error = "Impossibile caricare i dati")
            }
        }
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Esci") },
            text = { Text("Vuoi davvero uscire?") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutDialog = false
                    scope.launch { authRepo.logout() }
                    state = state.copy(isLoggedIn = false, userName = "", avatarUrl = null, favorites = emptyList())
                    onLogout()
                }) { Text("Esci") }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) { Text("Annulla") }
            },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Street Food Events") },
                actions = {
                    Box {
                        if (state.isLoggedIn && state.avatarUrl != null) {
                            IconButton(onClick = { showUserMenu = true }) {
                                AsyncImage(
                                    model = state.avatarUrl,
                                    contentDescription = "Profilo",
                                    modifier = Modifier.size(32.dp).clip(CircleShape),
                                )
                            }
                        } else if (state.isLoggedIn) {
                            IconButton(onClick = { showUserMenu = true }) {
                                Box(
                                    modifier = Modifier.size(32.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = state.userName.take(1).uppercase(),
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        style = MaterialTheme.typography.labelMedium,
                                        textAlign = TextAlign.Center,
                                    )
                                }
                            }
                        } else {
                            IconButton(onClick = { showUserMenu = true }) {
                                Icon(Icons.Filled.Person, contentDescription = "Account", modifier = Modifier.size(28.dp))
                            }
                        }

                        DropdownMenu(
                            expanded = showUserMenu,
                            onDismissRequest = { showUserMenu = false },
                        ) {
                            if (state.isLoggedIn) {
                                DropdownMenuItem(
                                    text = { Text("Profilo") },
                                    onClick = { showUserMenu = false; onProfileClick() },
                                    leadingIcon = { Icon(Icons.Filled.Person, contentDescription = null) },
                                )
                                DropdownMenuItem(
                                    text = { Text("Privacy") },
                                    onClick = { showUserMenu = false; onPrivacyClick() },
                                    leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = null) },
                                )
                                DropdownMenuItem(
                                    text = { Text("Esci") },
                                    onClick = { showUserMenu = false; showLogoutDialog = true },
                                    leadingIcon = { Icon(Icons.Filled.Logout, contentDescription = null) },
                                )
                            } else {
                                DropdownMenuItem(
                                    text = { Text("Accedi") },
                                    onClick = { showUserMenu = false; onLoginClick() },
                                    leadingIcon = { Icon(Icons.Filled.Login, contentDescription = null) },
                                )
                                DropdownMenuItem(
                                    text = { Text("Registrati") },
                                    onClick = { showUserMenu = false; onRegisterClick() },
                                    leadingIcon = { Icon(Icons.Filled.PersonAdd, contentDescription = null) },
                                )
                                DropdownMenuItem(
                                    text = { Text("Privacy") },
                                    onClick = { showUserMenu = false; onPrivacyClick() },
                                    leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = null) },
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                )
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                    label = { Text("Home") },
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onOrdersClick,
                    icon = { Icon(Icons.Outlined.Receipt, contentDescription = null) },
                    label = { Text("Ordini") },
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onFavoritesClick,
                    icon = { Icon(Icons.Outlined.Favorite, contentDescription = null) },
                    label = { Text("Preferiti") },
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onProfileClick,
                    icon = { Icon(Icons.Outlined.Settings, contentDescription = null) },
                    label = { Text("Profilo") },
                )
            }
        },
    ) { padding ->
        if (state.isLoading) {
            Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center,
            ) {
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
                item {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = if (state.isLoggedIn) "Bentornato/a, ${state.userName}." else "Benvenuto!",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = if (state.isLoggedIn) "I tuoi eventi preferiti e il saldo wallet a colpo d'occhio."
                        else "Esplora gli eventi in programma.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(16.dp))
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = if (state.isLoggedIn && !showAllEvents) "I tuoi eventi preferiti" else "Eventi",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        if (state.isLoggedIn) {
                            TextButton(onClick = { showAllEvents = !showAllEvents }) {
                                Text(
                                    if (showAllEvents) "Vedi preferiti" else "Vedi tutti",
                                    style = MaterialTheme.typography.labelLarge,
                                )
                            }
                        }
                    }
                }

                val displayEvents = if (state.isLoggedIn && !showAllEvents) {
                    state.favorites.map { it.event }
                } else {
                    state.activeEvents
                }

                if (displayEvents.isEmpty()) {
                    item {
                        Text(
                            text = if (state.isLoggedIn && !showAllEvents) "Nessun preferito. Aggiungi eventi ai preferiti per vederli qui."
                            else "Nessun evento in programma.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(vertical = 24.dp),
                        )
                    }
                }

                items(displayEvents) { event ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onEventClick(event.id) },
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = event.name,
                                style = MaterialTheme.typography.titleMedium,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (!event.shortDescription.isNullOrBlank()) {
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = event.shortDescription!!,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    text = event.location?.label ?: "",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                val fav = state.favorites.find { it.event.id == event.id }
                                if (fav?.wallet != null) {
                                    Text(
                                        text = "${fav.wallet!!.balance.toInt()} ${event.currencyName}",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.primary,
                                    )
                                } else if (state.isLoggedIn) {
                                    Text(
                                        text = event.currencyName,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }

                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}
