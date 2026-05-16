package com.streetfoodevents.app.data.api

import com.streetfoodevents.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface EventUsersApi {
    @GET("events/{eventId}/users")
    suspend fun listEventUsers(@Path("eventId") eventId: String): Response<EventUsersResponse>

    @GET("event-users/{eventUserId}/transactions")
    suspend fun listTransactions(@Path("eventUserId") eventUserId: String): Response<TransactionsResponse>
}

data class CreateTransactionRequest(
    val type: String,
    val direction: String,
    val amount: Double,
    val description: String? = null,
)
