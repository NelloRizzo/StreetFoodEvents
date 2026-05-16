package com.streetfoodevents.app.data.api

import com.streetfoodevents.app.BuildConfig
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.HttpCookie
import java.util.concurrent.TimeUnit

object ApiClient {

    private val okHttp: OkHttpClient by lazy {
        val cookieManager = CookieManager().apply {
            setCookiePolicy(CookiePolicy.ACCEPT_ALL)
        }

        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        OkHttpClient.Builder()
            .cookieJar(object : CookieJar {
                override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                    cookies.forEach { cookie ->
                        val httpCookie = HttpCookie(cookie.name, cookie.value).apply {
                            domain = cookie.domain
                            path = cookie.path
                            secure = cookie.secure
                            maxAge = cookie.expiresAt
                        }
                        cookieManager.cookieStore.add(url.toUri(), httpCookie)
                    }
                }

                override fun loadForRequest(url: HttpUrl): List<Cookie> {
                    return cookieManager.cookieStore.get(url.toUri())
                        .filter { it.hasExpired().not() }
                        .map { Cookie.Builder()
                            .name(it.name)
                            .value(it.value)
                            .domain(it.domain)
                            .path(it.path)
                            .build()
                        }
                }
            })
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    val baseUrl: String
        get() = BuildConfig.API_BASE_URL

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttp)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val authApi: AuthApi by lazy { retrofit.create(AuthApi::class.java) }
    val eventsApi: EventsApi by lazy { retrofit.create(EventsApi::class.java) }
    val ordersApi: OrdersApi by lazy { retrofit.create(OrdersApi::class.java) }
    val favoritesApi: FavoritesApi by lazy { retrofit.create(FavoritesApi::class.java) }
    val uploadApi: UploadApi by lazy { retrofit.create(UploadApi::class.java) }
}
