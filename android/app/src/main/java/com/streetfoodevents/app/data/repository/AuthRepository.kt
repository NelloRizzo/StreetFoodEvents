package com.streetfoodevents.app.data.repository

import com.streetfoodevents.app.data.api.ApiClient
import com.streetfoodevents.app.data.api.LoginRequest
import com.streetfoodevents.app.data.api.RegisterRequest
import com.streetfoodevents.app.data.api.UpdateProfileRequest
import com.streetfoodevents.app.data.model.ImageDto
import com.streetfoodevents.app.data.model.RolesResponse
import com.streetfoodevents.app.data.model.UserDto

class AuthRepository {
    private val api = ApiClient.authApi

    suspend fun register(firstName: String, lastName: String, email: String, password: String): Result<UserDto> = runCatching {
        val response = api.register(RegisterRequest(firstName, lastName, email, password))
        if (response.isSuccessful) {
            response.body()!!.user
        } else {
            throw Exception("Registration failed")
        }
    }

    suspend fun login(email: String, password: String): Result<UserDto> = runCatching {
        val response = api.login(LoginRequest(email, password))
        if (response.isSuccessful) {
            response.body()!!.user
        } else {
            throw Exception("Login failed")
        }
    }

    suspend fun logout(): Result<Unit> = runCatching {
        api.logout()
    }

    suspend fun getMe(): Result<UserDto> = runCatching {
        val response = api.me()
        if (response.isSuccessful) {
            response.body()!!.user
        } else {
            throw Exception("Session expired")
        }
    }

    suspend fun updateProfile(
        firstName: String? = null,
        lastName: String? = null,
        phone: String? = null,
        avatar: ImageDto? = null,
        currentPassword: String? = null,
        newPassword: String? = null,
    ): Result<UserDto> = runCatching {
        val response = api.updateMe(
            UpdateProfileRequest(
                firstName = firstName,
                lastName = lastName,
                phone = phone,
                avatar = avatar,
                currentPassword = currentPassword,
                newPassword = newPassword,
            )
        )
        if (response.isSuccessful) {
            response.body()!!.user
        } else {
            throw Exception("Update failed")
        }
    }

    suspend fun getRoles(): Result<RolesResponse> = runCatching {
        val response = api.getMyRoles()
        if (response.isSuccessful) {
            response.body()!!
        } else {
            throw Exception("Failed to fetch roles")
        }
    }

    suspend fun getQrCode(): Result<String> = runCatching {
        val response = api.meQrCode()
        if (response.isSuccessful) {
            response.body()!!.qrCode
        } else {
            throw Exception("Failed to fetch QR code")
        }
    }
}
