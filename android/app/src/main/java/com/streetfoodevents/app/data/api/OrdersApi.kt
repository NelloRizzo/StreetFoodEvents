package com.streetfoodevents.app.data.api

import com.streetfoodevents.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface OrdersApi {
    @GET("orders")
    suspend fun listOrders(
        @Query("userId") userId: String? = null,
        @Query("customerId") customerId: String? = null,
        @Query("status") status: String? = null,
        @Query("standId") standId: String? = null,
    ): Response<ItemsResponse<OrderDto>>

    @GET("orders/{orderId}")
    suspend fun getOrder(@Path("orderId") orderId: String): Response<ItemResponse<OrderDto>>

    @POST("orders")
    suspend fun createOrder(@Body body: CreateOrderRequest): Response<CreatedOrderResponse>

    @PATCH("orders/{orderId}/status")
    suspend fun updateOrderStatus(
        @Path("orderId") orderId: String,
        @Body body: UpdateStatusRequest,
    ): Response<ItemResponse<OrderDto>>

    @POST("orders/{orderId}/cancel")
    suspend fun cancelOrder(
        @Path("orderId") orderId: String,
        @Body body: CancelOrderRequest,
    ): Response<ItemResponse<OrderDto>>

    @POST("orders/{orderId}/pay")
    suspend fun payOrder(
        @Path("orderId") orderId: String,
        @Body body: PayOrderRequest?,
    ): Response<ItemResponse<OrderDto>>
}

data class CreateOrderRequest(
    val eventId: String,
    val standId: String,
    val customerName: String? = null,
    val items: List<CreateOrderItem>,
    val paymentOnCreate: PaymentOnCreate? = null,
)

data class CreateOrderItem(
    val eventProductId: String,
    val stationId: String,
    val quantity: Int,
)

data class PaymentOnCreate(
    val creditAmount: Double,
)

data class UpdateStatusRequest(
    val status: String,
)

data class CancelOrderRequest(
    val reason: String? = null,
)

data class PayOrderRequest(
    val creditAmount: Double? = null,
)
