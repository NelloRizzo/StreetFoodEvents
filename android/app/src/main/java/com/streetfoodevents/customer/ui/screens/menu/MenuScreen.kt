package com.streetfoodevents.customer.ui.screens.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AcUnit
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Store
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.streetfoodevents.customer.StreetFoodApp
import com.streetfoodevents.customer.data.model.MenuItemDto
import com.streetfoodevents.customer.data.model.MenuResponse
import com.streetfoodevents.customer.data.repository.StreetFoodRepository
import com.streetfoodevents.customer.ui.components.AppTopBar
import com.streetfoodevents.customer.ui.components.ErrorView
import com.streetfoodevents.customer.ui.components.LoadingView
import com.streetfoodevents.customer.ui.components.StatusBadge
import com.streetfoodevents.customer.ui.theme.BrandAccent
import com.streetfoodevents.customer.ui.theme.BrandPrimary
import com.streetfoodevents.customer.ui.theme.BrandPrimaryDark
import kotlinx.coroutines.launch
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenuScreen(
    eventId: String? = null,
    onNavigateBack: () -> Unit = {}
) {
    val repository = remember { StreetFoodRepository() }
    val scope = rememberCoroutineScope()

    var activeEventId by remember {
        mutableStateOf(eventId ?: StreetFoodApp.instance.getSavedSelectedEventId())
    }

    var menuData by remember { mutableStateOf<MenuResponse?>(null) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var selectedStandId by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun loadMenu() {
        if (activeEventId.isBlank()) {
            // Se nessun evento è selezionato, cerchiamo il primo evento pubblico attivo
            scope.launch {
                isLoading = true
                val eventsResult = repository.getPublicEvents()
                eventsResult.onSuccess { events ->
                    val first = events.firstOrNull()
                    if (first != null) {
                        activeEventId = first.id
                        StreetFoodApp.instance.setSavedSelectedEventId(first.id)
                        val menuResult = repository.getEventMenu(first.id)
                        menuResult.onSuccess {
                            menuData = it
                            isLoading = false
                        }.onFailure { err ->
                            errorMessage = err.localizedMessage ?: "Errore caricamento menu"
                            isLoading = false
                        }
                    } else {
                        errorMessage = "Nessun evento disponibile al momento."
                        isLoading = false
                    }
                }.onFailure {
                    errorMessage = "Impossibile recuperare gli eventi."
                    isLoading = false
                }
            }
            return
        }

        scope.launch {
            isLoading = true
            errorMessage = null
            val result = repository.getEventMenu(activeEventId)
            result.onSuccess {
                menuData = it
                isLoading = false
            }.onFailure { error ->
                errorMessage = error.localizedMessage ?: "Errore nel caricamento del menu"
                isLoading = false
            }
        }
    }

    LaunchedEffect(activeEventId) {
        loadMenu()
    }

    val allItems = menuData?.items ?: emptyList()
    val categories = menuData?.categories ?: emptyList()
    val eventInfo = menuData?.event

    val stands = remember(allItems) {
        allItems.map { Triple(it.standId, it.standName, it.standNumber) }
            .distinctBy { it.first }
            .sortedBy { it.third ?: 999 }
    }

    val filteredItems = remember(allItems, selectedCategory, selectedStandId, searchQuery) {
        allItems.filter { item ->
            val matchCategory = selectedCategory == null || item.categoryIds.contains(selectedCategory)
            val matchStand = selectedStandId == null || item.standId == selectedStandId
            val matchSearch = searchQuery.isBlank() ||
                    item.name.contains(searchQuery, ignoreCase = true) ||
                    item.standName.contains(searchQuery, ignoreCase = true) ||
                    item.ingredients.any { it.contains(searchQuery, ignoreCase = true) }
            matchCategory && matchStand && matchSearch
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = eventInfo?.name?.let { "Menu - $it" } ?: "Menu Stand",
                canNavigateBack = eventId != null,
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
                isLoading -> LoadingView(message = "Caricamento piatti e bevande...")
                errorMessage != null -> ErrorView(message = errorMessage!!, onRetry = { loadMenu() })
                allItems.isEmpty() -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = "Nessun piatto presente nel menu per questo evento.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                else -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Search field
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Cerca piatto, stand o ingrediente...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = BrandPrimary,
                                cursorColor = BrandPrimary
                            )
                        )

                        // Categories chips row
                        if (categories.isNotEmpty()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState())
                                    .padding(horizontal = 16.dp, vertical = 4.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                FilterChip(
                                    selected = selectedCategory == null,
                                    onClick = { selectedCategory = null },
                                    label = { Text("Tutti") },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = BrandPrimary,
                                        selectedLabelColor = Color.White
                                    )
                                )
                                categories.forEach { category ->
                                    FilterChip(
                                        selected = selectedCategory == category,
                                        onClick = { selectedCategory = if (selectedCategory == category) null else category },
                                        label = { Text(category) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = BrandPrimary,
                                            selectedLabelColor = Color.White
                                        )
                                    )
                                }
                            }
                        }

                        // Stands filter chips row (if more than 1 stand exists)
                        if (stands.size > 1) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState())
                                    .padding(horizontal = 16.dp, vertical = 2.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                FilterChip(
                                    selected = selectedStandId == null,
                                    onClick = { selectedStandId = null },
                                    label = { Text("Tutti gli stand") },
                                    leadingIcon = {
                                        Icon(Icons.Default.Store, contentDescription = null, modifier = Modifier.size(16.dp))
                                    }
                                )
                                stands.forEach { (standId, standName, standNumber) ->
                                    val labelText = if (standNumber != null) "#$standNumber $standName" else standName
                                    FilterChip(
                                        selected = selectedStandId == standId,
                                        onClick = { selectedStandId = if (selectedStandId == standId) null else standId },
                                        label = { Text(labelText) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = BrandAccent,
                                            selectedLabelColor = BrandPrimaryDark
                                        )
                                    )
                                }
                            }
                        }

                        // Product list
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(filteredItems, key = { it.eventProductId }) { item ->
                                MenuItemCard(
                                    item = item,
                                    currencyName = eventInfo?.currencyName ?: "Gettoni",
                                    exchangeRate = eventInfo?.exchangeRate ?: 1.0
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MenuItemCard(
    item: MenuItemDto,
    currencyName: String,
    exchangeRate: Double
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            val imageUrl = item.coverImage?.getBestUrl()
            if (!imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(imageUrl)
                        .crossfade(true)
                        .build(),
                    contentDescription = item.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp)
                        .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                )
            }

            Column(modifier = Modifier.padding(16.dp)) {
                // Stand Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Store,
                            contentDescription = null,
                            tint = BrandPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        val standTitle = if (item.standNumber != null) {
                            "${item.standName} (#${item.standNumber})"
                        } else {
                            item.standName
                        }
                        Text(
                            text = standTitle,
                            style = MaterialTheme.typography.labelLarge,
                            color = BrandPrimary,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    if (item.isFrozen) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.AcUnit,
                                contentDescription = "Surgelato",
                                tint = Color(0xFF0284C7),
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Surgelato",
                                fontSize = 11.sp,
                                color = Color(0xFF0284C7)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Product Name
                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                // Description
                if (!item.description.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = item.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Ingredients
                if (item.ingredients.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Ingredienti: " + item.ingredients.joinToString(", "),
                        style = MaterialTheme.typography.bodyMedium,
                        fontSize = 13.sp
                    )
                }

                // Allergens
                if (item.allergens.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.horizontalScroll(rememberScrollState())
                    ) {
                        item.allergens.forEach { allergen ->
                            StatusBadge(
                                text = allergen,
                                backgroundColor = Color(0xFFFEF3C7),
                                textColor = Color(0xFF92400E)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Price Row
                val euroAmount = if (exchangeRate > 0) item.price / exchangeRate else item.price
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = String.format(Locale.ITALY, "%.2f €", euroAmount),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Text(
                        text = "${item.price.toInt()} $currencyName",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = BrandPrimary
                    )
                }
            }
        }
    }
}
