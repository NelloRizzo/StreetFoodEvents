package com.streetfoodevents.app.data.model

import com.google.gson.annotations.SerializedName

data class ApiError(
    val message: String
)

data class ItemsResponse<T>(
    val items: List<T>
)

data class ItemResponse<T>(
    val item: T
)

data class UserResponse(
    val user: UserDto
)

data class QrCodeResponse(
    val qrCode: String
)

data class RolesResponse(
    val isPlatformAdmin: Boolean,
    val isEventAdmin: Boolean,
    val roles: List<RoleDto>
)

data class ImageUploadResponse(
    val item: ImageDto
)

data class CreatedOrderResponse(
    val item: OrderDto
)

data class PayOrderResponse(
    val item: OrderDto
)

data class HomeDataResponse(
    val favorites: List<HomeEventDto>,
    val activeEvents: List<EventDto>
)

data class EventUsersResponse(
    val items: List<EventUserDto>
)

data class TransactionsResponse(
    val items: List<TransactionDto>
)

data class WalletTransactionResponse(
    val eventUser: EventUserDto,
    val transaction: TransactionDto
)

data class MyStandsResponse(
    val stands: List<StandInfoDto>,
    val stations: List<StationInfoDto>
)
