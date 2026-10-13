package com.streetfoodevents.customer.data.model

import com.google.gson.annotations.SerializedName

data class EventUserResponse(
    @SerializedName("item") val item: EventUserDto? = null
)

data class EventUserDto(
    @SerializedName("id") val id: String,
    @SerializedName("eventId") val eventId: String,
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("balance") val balance: Double = 0.0,
    @SerializedName("isActive") val isActive: Boolean = true,
    @SerializedName("joinedAt") val joinedAt: String? = null,
    @SerializedName("notes") val notes: String? = null
)

data class TransactionsResponse(
    @SerializedName("items") val items: List<TransactionDto> = emptyList()
)

data class TransactionDto(
    @SerializedName("id") val id: String,
    @SerializedName("eventUserId") val eventUserId: String,
    @SerializedName("type") val type: String, // top-up, refund, payment, etc.
    @SerializedName("direction") val direction: String, // in, out
    @SerializedName("amount") val amount: Double = 0.0,
    @SerializedName("balanceAfter") val balanceAfter: Double = 0.0,
    @SerializedName("description") val description: String? = null,
    @SerializedName("occurredAt") val occurredAt: String? = null
) {
    fun isTopUp(): Boolean = direction.lowercase() == "in" || type.lowercase() == "top-up"
}
