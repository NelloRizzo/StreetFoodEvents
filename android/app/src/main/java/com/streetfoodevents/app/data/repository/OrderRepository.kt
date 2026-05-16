package com.streetfoodevents.app.data.repository

import com.streetfoodevents.app.data.api.ApiClient
import com.streetfoodevents.app.data.api.CreateOrderItem
import com.streetfoodevents.app.data.api.CreateOrderRequest
import com.streetfoodevents.app.data.api.PayOrderRequest
import com.streetfoodevents.app.data.api.CancelOrderRequest
import com.streetfoodevents.app.data.model.OrderDto

class OrderRepository {
    private val api = ApiClient.ordersApi

    suspend fun listOrders(
        userId: String? = null,
        customerId: String? = null,
        status: String? = null,
        standId: String? = null,
    ): Result<List<OrderDto>> = runCatching {
        val response = api.listOrders(userId, customerId, status, standId)
        if (response.isSuccessful) {
            response.body()!!.items
        } else {
            throw Exception("Failed to load orders")
        }
    }

    suspend fun getOrder(orderId: String): Result<OrderDto> = runCatching {
        val response = api.getOrder(orderId)
        if (response.isSuccessful) {
            response.body()!!.item
        } else {
            throw Exception("Order not found")
        }
    }

    suspend fun createOrder(
        eventId: String,
        standId: String,
        customerName: String?,
        items: List<CreateOrderItem>,
        creditAmount: Double? = null,
    ): Result<OrderDto> = runCatching {
        val response = api.createOrder(
            CreateOrderRequest(
                eventId = eventId,
                standId = standId,
                customerName = customerName,
                items = items,
                paymentOnCreate = if (creditAmount != null && creditAmount > 0) {
                    com.streetfoodevents.app.data.api.PaymentOnCreate(creditAmount)
                } else null,
            )
        )
        if (response.isSuccessful) {
            response.body()!!.item
        } else {
            throw Exception("Failed to create order")
        }
    }

    suspend fun payOrder(orderId: String, creditAmount: Double? = null): Result<OrderDto> = runCatching {
        val response = api.payOrder(orderId, PayOrderRequest(creditAmount))
        if (response.isSuccessful) {
            response.body()!!.item
        } else {
            throw Exception("Payment failed")
        }
    }

    suspend fun cancelOrder(orderId: String, reason: String? = null): Result<OrderDto> = runCatching {
        val response = api.cancelOrder(orderId, CancelOrderRequest(reason))
        if (response.isSuccessful) {
            response.body()!!.item
        } else {
            throw Exception("Cancellation failed")
        }
    }
}
