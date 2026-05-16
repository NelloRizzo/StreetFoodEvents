package com.streetfoodevents.app.data.repository

import com.streetfoodevents.app.data.api.ApiClient
import com.streetfoodevents.app.data.api.CreateFavoriteRequest
import com.streetfoodevents.app.data.model.FavoriteDto

class FavoriteRepository {
    private val api = ApiClient.favoritesApi

    suspend fun listFavorites(): Result<List<FavoriteDto>> = runCatching {
        val response = api.listFavorites()
        if (response.isSuccessful) {
            response.body()!!.items
        } else {
            throw Exception("Failed to load favorites")
        }
    }

    suspend fun createFavorite(eventId: String? = null, standId: String? = null): Result<FavoriteDto> = runCatching {
        val response = api.createFavorite(CreateFavoriteRequest(eventId, standId))
        if (response.isSuccessful) {
            response.body()!!.item
        } else {
            throw Exception("Failed to add favorite")
        }
    }

    suspend fun deleteFavorite(favId: String): Result<Unit> = runCatching {
        val response = api.deleteFavorite(favId)
        if (!response.isSuccessful) {
            throw Exception("Failed to remove favorite")
        }
    }
}
