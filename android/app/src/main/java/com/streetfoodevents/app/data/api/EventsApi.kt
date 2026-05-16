package com.streetfoodevents.app.data.api

import com.streetfoodevents.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface EventsApi {
    @GET("events")
    suspend fun listEvents(): Response<ItemsResponse<EventDto>>

    @GET("events/home")
    suspend fun homeEvents(): Response<HomeDataResponse>

    @GET("events/{eventId}")
    suspend fun getEvent(@Path("eventId") eventId: String): Response<ItemResponse<EventDto>>

    @GET("events/{eventId}/qrcode")
    suspend fun getEventQrCode(@Path("eventId") eventId: String): Response<QrCodeResponse>

    @GET("stands")
    suspend fun listStands(@Query("eventId") eventId: String): Response<ItemsResponse<StandDto>>

    @GET("stands/{standId}")
    suspend fun getStand(@Path("standId") standId: String): Response<ItemResponse<StandDto>>

    @GET("stands/{standId}/qrcode")
    suspend fun getStandQrCode(@Path("standId") standId: String): Response<QrCodeResponse>

    @GET("event-products")
    suspend fun getMenu(
        @Query("eventId") eventId: String,
        @Query("standId") standId: String,
    ): Response<ItemsResponse<MenuItemDto>>
}
