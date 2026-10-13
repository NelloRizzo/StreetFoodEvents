package com.streetfoodevents.customer.data.model

import com.google.gson.annotations.SerializedName

data class EventsListResponse(
    @SerializedName("items") val items: List<EventDto> = emptyList()
)

data class EventDetailResponse(
    @SerializedName("item") val item: EventDto? = null
)

data class EventDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("location") val location: LocationDto? = null,
    @SerializedName("startDate") val startDate: String? = null,
    @SerializedName("endDate") val endDate: String? = null,
    @SerializedName("currencyName") val currencyName: String? = "Gettoni",
    @SerializedName("currencySymbol") val currencySymbol: String? = null,
    @SerializedName("exchangeRate") val exchangeRate: Double? = 1.0,
    @SerializedName("shortDescription") val shortDescription: String? = null,
    @SerializedName("longDescription") val longDescription: String? = null,
    @SerializedName("coverImage") val coverImage: ImageDto? = null,
    @SerializedName("logo") val logo: ImageDto? = null,
    @SerializedName("isPublic") val isPublic: Boolean? = true
)

data class LocationDto(
    @SerializedName("address") val address: String? = null,
    @SerializedName("city") val city: String? = null,
    @SerializedName("postalCode") val postalCode: String? = null,
    @SerializedName("province") val province: String? = null
) {
    fun toReadableString(): String {
        val parts = listOfNotNull(address, city, province).filter { it.isNotBlank() }
        return if (parts.isNotEmpty()) parts.joinToString(", ") else "Luogo da definire"
    }
}

data class ImageDto(
    @SerializedName("url") val url: String? = null,
    @SerializedName("secureUrl") val secureUrl: String? = null
) {
    fun getBestUrl(): String? = secureUrl ?: url
}
