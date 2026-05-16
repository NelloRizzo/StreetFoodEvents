package com.streetfoodevents.app.data.api

import com.streetfoodevents.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface FavoritesApi {
    @GET("favorites")
    suspend fun listFavorites(): Response<ItemsResponse<FavoriteDto>>

    @POST("favorites")
    suspend fun createFavorite(@Body body: CreateFavoriteRequest): Response<ItemResponse<FavoriteDto>>

    @DELETE("favorites/{favId}")
    suspend fun deleteFavorite(@Path("favId") favId: String): Response<Unit>
}

data class CreateFavoriteRequest(
    val eventId: String? = null,
    val standId: String? = null,
)
