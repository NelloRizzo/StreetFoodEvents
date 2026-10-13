package com.streetfoodevents.customer.data.repository

import com.streetfoodevents.customer.data.api.ApiClient
import com.streetfoodevents.customer.data.model.EventDto
import com.streetfoodevents.customer.data.model.EventUserDto
import com.streetfoodevents.customer.data.model.MenuResponse
import com.streetfoodevents.customer.data.model.OrderTrackDto
import com.streetfoodevents.customer.data.model.TransactionDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class StreetFoodRepository {

    private val api get() = ApiClient.getService()

    suspend fun getPublicEvents(): Result<List<EventDto>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getPublicEvents(publicOnly = true)
            Result.success(response.items)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getEventById(eventId: String): Result<EventDto?> = withContext(Dispatchers.IO) {
        try {
            val response = api.getEventById(eventId)
            Result.success(response.item)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getEventMenu(eventId: String): Result<MenuResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.getEventMenu(eventId)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getOrderTrack(orderId: String): Result<OrderTrackDto> = withContext(Dispatchers.IO) {
        try {
            val response = api.getOrderTrack(orderId)
            val item = response.item
            if (item != null) {
                Result.success(item)
            } else {
                Result.failure(Exception(response.message ?: "Ordine non trovato"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getEventUser(eventUserId: String): Result<EventUserDto?> = withContext(Dispatchers.IO) {
        try {
            val response = api.getEventUser(eventUserId)
            Result.success(response.item)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getWalletTransactions(eventUserId: String): Result<List<TransactionDto>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getWalletTransactions(eventUserId)
            Result.success(response.items)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
