package com.streetfoodevents.customer.data.model

import com.google.gson.annotations.SerializedName

data class OrderTrackResponse(
    @SerializedName("item") val item: OrderTrackDto? = null,
    @SerializedName("message") val message: String? = null
)

data class OrderTrackDto(
    @SerializedName("id") val id: String,
    @SerializedName("orderNumber") val orderNumber: Int,
    @SerializedName("status") val status: String, // pending, preparing, ready, delivered, cancelled
    @SerializedName("isGift") val isGift: Boolean = false,
    @SerializedName("readyAt") val readyAt: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("eventId") val eventId: String? = null,
    @SerializedName("standId") val standId: String? = null,
    @SerializedName("eventName") val eventName: String? = null,
    @SerializedName("standName") val standName: String? = null,
    @SerializedName("items") val items: List<OrderItemTrackDto> = emptyList()
) {
    fun getStatusLabel(): String {
        return when (status.lowercase()) {
            "pending" -> "In attesa"
            "preparing" -> "In preparazione"
            "ready" -> "Pronto per il ritiro!"
            "delivered" -> "Ritirato / Consegnato"
            "cancelled" -> "Annullato"
            else -> status
        }
    }
}

data class OrderItemTrackDto(
    @SerializedName("productName") val productName: String,
    @SerializedName("quantity") val quantity: Int = 1,
    @SerializedName("stationName") val stationName: String? = null
)
