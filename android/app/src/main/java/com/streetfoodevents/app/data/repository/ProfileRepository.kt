package com.streetfoodevents.app.data.repository

import android.content.Context
import android.net.Uri
import com.streetfoodevents.app.BuildConfig
import com.streetfoodevents.app.data.api.ApiClient
import com.streetfoodevents.app.data.model.ImageDto
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream

class ProfileRepository {

    private val uploadApi = ApiClient.uploadApi

    suspend fun uploadAvatar(context: Context, uri: Uri): Result<ImageDto> = runCatching {
        val inputStream = context.contentResolver.openInputStream(uri)
            ?: throw Exception("Cannot open image")

        val byteArray = ByteArrayOutputStream().use { output ->
            inputStream.use { input ->
                input.copyTo(output)
            }
            output.toByteArray()
        }

        val requestBody = byteArray.toRequestBody("image/*".toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("image", "avatar.jpg", requestBody)

        val response = uploadApi.uploadImage(part)
        if (response.isSuccessful) {
            response.body()!!.item
        } else {
            throw Exception("Upload failed")
        }
    }
}
