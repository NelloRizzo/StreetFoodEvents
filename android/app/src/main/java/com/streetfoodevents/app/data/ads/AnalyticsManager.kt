package com.streetfoodevents.app.data.ads

import android.content.Context
import com.streetfoodevents.app.BuildConfig

object AnalyticsManager {

    private var context: Context? = null

    fun init(appContext: Context) {
        context = appContext
        if (BuildConfig.GTM_ID.isNotBlank()) {
            GtmManager.init(appContext)
        }
    }

    fun logScreenView(screenName: String) {
        if (!ConsentManager.isAnalyticsConsent()) return
        GtmManager.pushEvent("screen_view", mapOf("screen_name" to screenName))
    }

    fun logEvent(name: String, params: Map<String, Any> = emptyMap()) {
        if (!ConsentManager.isAnalyticsConsent()) return
        GtmManager.pushEvent(name, params)
    }

    fun reinitialize() {
        val ctx = context ?: return
        if (BuildConfig.GTM_ID.isNotBlank()) {
            GtmManager.init(ctx)
        }
    }
}
