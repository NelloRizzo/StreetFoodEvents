package com.streetfoodevents.app.data.ads

import android.content.Context
import android.content.SharedPreferences

object ConsentManager {
    private const val PREFS_NAME = "sfe_consent"
    private const val KEY_CONSENT_GIVEN = "consent_given"
    private const val KEY_ANALYTICS = "analytics"
    private const val KEY_ADS = "ads"

    private lateinit var prefs: SharedPreferences
    private var analyticsReinit: (() -> Unit)? = null

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun onAnalyticsChanged(callback: () -> Unit) {
        analyticsReinit = callback
    }

    fun isConsentGiven(): Boolean = prefs.getBoolean(KEY_CONSENT_GIVEN, false)

    fun isAnalyticsConsent(): Boolean = prefs.getBoolean(KEY_ANALYTICS, false)

    fun isAdsConsent(): Boolean = prefs.getBoolean(KEY_ADS, false)

    fun acceptAll() {
        prefs.edit()
            .putBoolean(KEY_CONSENT_GIVEN, true)
            .putBoolean(KEY_ANALYTICS, true)
            .putBoolean(KEY_ADS, true)
            .apply()
        analyticsReinit?.invoke()
    }

    fun rejectAll() {
        prefs.edit()
            .putBoolean(KEY_CONSENT_GIVEN, true)
            .putBoolean(KEY_ANALYTICS, false)
            .putBoolean(KEY_ADS, false)
            .apply()
    }
}
