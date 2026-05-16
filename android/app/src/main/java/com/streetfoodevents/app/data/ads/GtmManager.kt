package com.streetfoodevents.app.data.ads

import android.content.Context
import com.streetfoodevents.app.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL

object GtmManager {
    private var gtmId: String = ""
    private val scope = CoroutineScope(Dispatchers.IO)

    fun init(context: Context) {
        gtmId = BuildConfig.GTM_ID
    }

    fun pushEvent(eventName: String, params: Map<String, Any> = emptyMap()): Boolean {
        if (!ConsentManager.isAnalyticsConsent() || gtmId.isBlank()) return false
        val eventParams = params.toMutableMap()
        eventParams["event"] = eventName
        send(eventParams)
        return true
    }

    fun push(params: Map<String, Any>): Boolean {
        if (!ConsentManager.isAnalyticsConsent() || gtmId.isBlank()) return false
        send(params)
        return true
    }

    private fun send(params: Map<String, Any>) {
        scope.launch {
            val encoded = params.map { (k, v) ->
                "${encodeParam(k)}=${encodeParam(v.toString())}"
            }.joinToString("&")

            try {
                val url = URL("https://www.googletagmanager.com/gtm.js?id=$gtmId&$encoded")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                conn.doOutput = false
                conn.connect()
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {
                // silently ignore — GTM non disponibile
            }
        }
    }

    private fun encodeParam(value: String): String {
        return java.net.URLEncoder.encode(value, "UTF-8")
    }
}
