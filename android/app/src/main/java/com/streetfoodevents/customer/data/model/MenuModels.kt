package com.streetfoodevents.customer.data.model

import com.google.gson.annotations.SerializedName

data class MenuResponse(
    @SerializedName("event") val event: MenuEventDto? = null,
    @SerializedName("categories") val categories: List<String> = emptyList(),
    @SerializedName("items") val items: List<MenuItemDto> = emptyList(),
    @SerializedName("byCategory") val byCategory: Map<String, List<MenuItemDto>> = emptyMap()
)

data class MenuEventDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("currencyName") val currencyName: String? = "Gettoni",
    @SerializedName("currencySymbol") val currencySymbol: String? = null,
    @SerializedName("exchangeRate") val exchangeRate: Double = 1.0
)

data class MenuItemDto(
    @SerializedName("productId") val productId: String,
    @SerializedName("eventProductId") val eventProductId: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String? = null,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("ingredients") val ingredients: List<String> = emptyList(),
    @SerializedName("allergens") val allergens: List<String> = emptyList(),
    @SerializedName("isFrozen") val isFrozen: Boolean = false,
    @SerializedName("coverImage") val coverImage: ImageDto? = null,
    @SerializedName("standId") val standId: String,
    @SerializedName("standName") val standName: String,
    @SerializedName("standNumber") val standNumber: Int? = null,
    @SerializedName("standCoverImage") val standCoverImage: ImageDto? = null,
    @SerializedName("standLogo") val standLogo: ImageDto? = null,
    @SerializedName("categoryIds") val categoryIds: List<String> = emptyList()
)
