package com.streetfoodevents.customer.data.api

import com.streetfoodevents.customer.data.model.EventDetailResponse
import com.streetfoodevents.customer.data.model.EventUserResponse
import com.streetfoodevents.customer.data.model.EventsListResponse
import com.streetfoodevents.customer.data.model.MenuResponse
import com.streetfoodevents.customer.data.model.OrderTrackResponse
import com.streetfoodevents.customer.data.model.TransactionsResponse
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface StreetFoodApiService {

    @GET("api/events")
    suspend fun getPublicEvents(
        @Query("public") publicOnly: Boolean = true
    ): EventsListResponse

    @GET("api/events/{eventId}")
    suspend fun getEventById(
        @Path("eventId") eventId: String
    ): EventDetailResponse

    @GET("api/events/{eventId}/menu")
    suspend fun getEventMenu(
        @Path("eventId") eventId: String
    ): MenuResponse

    @GET("api/orders/{orderId}/track")
    suspend fun getOrderTrack(
        @Path("orderId") orderId: String
    ): OrderTrackResponse

    @GET("api/event-users/{eventUserId}")
    suspend fun getEventUser(
        @Path("eventUserId") eventUserId: String
    ): EventUserResponse

    @GET("api/event-users/{eventUserId}/transactions")
    suspend fun getWalletTransactions(
        @Path("eventUserId") eventUserId: String
    ): TransactionsResponse
}
