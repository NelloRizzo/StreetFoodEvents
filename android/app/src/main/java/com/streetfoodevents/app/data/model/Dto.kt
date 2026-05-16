package com.streetfoodevents.app.data.model

import com.google.gson.annotations.SerializedName

// ── User ──
data class UserDto(
    val id: String,
    val firstName: String,
    val lastName: String,
    val email: String,
    val phone: String?,
    val avatar: ImageDto?,
    val isAdmin: Boolean = false,
)

data class RoleDto(
    val roleId: String,
    val slug: String,
    val scope: String,
    val name: String,
    val eventId: String?,
    val standId: String?,
)

// ── Image ──
data class ImageDto(
    val url: String,
    val publicId: String,
    val width: Int,
    val height: Int,
    val format: String,
    val bytes: Int,
)

// ── Event ──
data class EventDto(
    val id: String,
    val name: String,
    val location: LocationDto?,
    val startDate: String,
    val endDate: String,
    val currencyName: String,
    val currencySymbol: ImageDto?,
    val themeBrand: String?,
    val themeText: String?,
    val themeSurface: String?,
    val themeHighlight: String?,
    val shortDescription: String?,
    val longDescription: String?,
    val coverImage: ImageDto?,
    val logo: ImageDto?,
)

data class LocationDto(
    val label: String,
    val city: String,
    val province: String,
)

data class HomeEventDto(
    val id: String,
    val event: EventDto,
    val wallet: WalletDto?,
    val createdAt: String,
)

data class WalletDto(
    val balance: Double,
    val joinedAt: String?,
)

// ── Stand ──
data class StandDto(
    val id: String,
    val name: String,
    val slogan: String?,
    val description: String?,
    val eventIds: List<String>,
    val coverImage: ImageDto?,
)

// ── Event Product (Menu) ──
data class MenuItemDto(
    val id: String,
    val eventId: String,
    val standId: String,
    val productId: String,
    val product: ProductDto?,
    val stationIds: List<String>,
    val priceOverride: Double?,
)

data class ProductDto(
    val id: String,
    val name: String,
    val price: Double,
    val ingredients: List<String>,
)

// ── Order ──
data class OrderDto(
    val id: String,
    val eventId: String,
    val standId: String,
    val orderNumber: Int,
    val userId: String,
    val customerId: String?,
    val customerName: String?,
    val status: String,
    val items: List<OrderItemDto>,
    val total: Double,
    val creditAmountUsed: Double,
    val paymentStatus: String,
    val paidAt: String?,
    val paymentTransactionId: String?,
    val notes: String?,
    val cancelledAt: String?,
    val cancelReason: String?,
    val createdAt: String,
)

data class OrderItemDto(
    val eventProductId: String,
    val productId: String,
    val productName: String,
    val stationId: String,
    val stationName: String,
    val quantity: Int,
    val unitPrice: Double,
    val subtotal: Double,
    val ready: Boolean,
    val notes: String?,
)

// ── Favorite ──
data class FavoriteDto(
    val id: String,
    val userId: String,
    val event: FavoriteRefDto?,
    val stand: FavoriteRefDto?,
    val createdAt: String,
)

data class FavoriteRefDto(
    val id: String,
    val name: String,
    val slogan: String?,
)

// ── Event User (Wallet) ──
data class EventUserDto(
    val id: String,
    val eventId: String,
    val userId: String,
    val balance: Double,
    val isActive: Boolean,
    val joinedAt: String?,
    val notes: String?,
)

data class TransactionDto(
    val id: String,
    val eventUserId: String,
    val type: String,
    val direction: String,
    val amount: Double,
    val balanceAfter: Double,
    val description: String?,
    val occurredAt: String,
)

// ── Stand / Station (for management section) ──
data class StandInfoDto(
    val id: String,
    val name: String,
)

data class StationInfoDto(
    val id: String,
    val name: String,
    val standId: String?,
    val standName: String?,
)
