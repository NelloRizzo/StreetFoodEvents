package com.streetfoodevents.customer.data.api

import com.streetfoodevents.customer.StreetFoodApp
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private var currentBaseUrl: String = ""
    private var cachedService: StreetFoodApiService? = null

    private val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    fun getService(): StreetFoodApiService {
        val baseUrl = StreetFoodApp.instance.getBaseUrl()
        if (cachedService != null && currentBaseUrl == baseUrl) {
            return cachedService!!
        }

        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        currentBaseUrl = baseUrl
        val service = retrofit.create(StreetFoodApiService::class.java)
        cachedService = service
        return service
    }

    fun invalidate() {
        cachedService = null
    }
}
