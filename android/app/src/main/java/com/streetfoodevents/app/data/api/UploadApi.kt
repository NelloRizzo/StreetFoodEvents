package com.streetfoodevents.app.data.api

import com.streetfoodevents.app.data.model.ImageUploadResponse
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface UploadApi {
    @Multipart
    @POST("upload/image")
    suspend fun uploadImage(@Part image: MultipartBody.Part): Response<ImageUploadResponse>
}
