package com.streetfoodevents.app.data.repository

import com.streetfoodevents.app.data.api.ApiClient
import com.streetfoodevents.app.data.model.*
import com.streetfoodevents.app.data.model.EventDto
import com.streetfoodevents.app.data.model.HomeEventDto
import com.streetfoodevents.app.data.model.StandDto

class EventRepository {
    private val api = ApiClient.eventsApi

    suspend fun getHomeData(): Result<HomeDataResponse> = runCatching {
        val response = api.homeEvents()
        if (response.isSuccessful) {
            response.body()!!
        } else {
            throw Exception("Failed to load home data")
        }
    }

    suspend fun listEvents(): Result<List<EventDto>> = runCatching {
        val response = api.listEvents()
        if (response.isSuccessful) {
            response.body()!!.items
        } else {
            throw Exception("Failed to load events")
        }
    }

    suspend fun getEvent(eventId: String): Result<EventDto> = runCatching {
        val response = api.getEvent(eventId)
        if (response.isSuccessful) {
            response.body()!!.item
        } else {
            throw Exception("Event not found")
        }
    }

    suspend fun getStands(eventId: String): Result<List<StandDto>> = runCatching {
        val response = api.listStands(eventId)
        if (response.isSuccessful) {
            response.body()!!.items
        } else {
            throw Exception("Failed to load stands")
        }
    }

    suspend fun getEventQrCode(eventId: String): Result<String> = runCatching {
        val response = api.getEventQrCode(eventId)
        if (response.isSuccessful) {
            response.body()!!.qrCode
        } else {
            throw Exception("Failed to fetch event QR code")
        }
    }

    suspend fun getStandQrCode(standId: String): Result<String> = runCatching {
        val response = api.getStandQrCode(standId)
        if (response.isSuccessful) {
            response.body()!!.qrCode
        } else {
            throw Exception("Failed to fetch stand QR code")
        }
    }

    suspend fun getStand(standId: String): Result<StandDto> = runCatching {
        val response = api.getStand(standId)
        if (response.isSuccessful) {
            response.body()!!.item
        } else {
            throw Exception("Stand not found")
        }
    }

    suspend fun getMenu(eventId: String, standId: String): Result<List<MenuItemDto>> = runCatching {
        val response = api.getMenu(eventId, standId)
        if (response.isSuccessful) {
            response.body()!!.items
        } else {
            throw Exception("Failed to load menu")
        }
    }
}
