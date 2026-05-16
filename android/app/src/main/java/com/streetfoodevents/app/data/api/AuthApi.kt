package com.streetfoodevents.app.data.api

import com.streetfoodevents.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface AuthApi {
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<UserResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<UserResponse>

    @POST("auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("auth/me")
    suspend fun me(): Response<UserResponse>

    @PATCH("auth/me")
    suspend fun updateMe(@Body body: UpdateProfileRequest): Response<UserResponse>

    @GET("auth/me/qrcode")
    suspend fun meQrCode(): Response<QrCodeResponse>

    @GET("auth/me/roles")
    suspend fun getMyRoles(): Response<RolesResponse>

    @GET("auth/me/stands")
    suspend fun getMyStands(): Response<MyStandsResponse>
}

data class RegisterRequest(
    val firstName: String,
    val lastName: String,
    val email: String,
    val password: String,
)

data class LoginRequest(
    val email: String,
    val password: String,
)

data class UpdateProfileRequest(
    val firstName: String? = null,
    val lastName: String? = null,
    val phone: String? = null,
    val avatar: ImageDto? = null,
    val currentPassword: String? = null,
    val newPassword: String? = null,
)
