package com.streetfoodevents.customer

import android.app.Application
import android.content.Context
import android.content.SharedPreferences

class StreetFoodApp : Application() {

    lateinit var prefs: SharedPreferences
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = getSharedPreferences("streetfood_prefs", Context.MODE_PRIVATE)
    }

    fun getBaseUrl(): String {
        return prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
    }

    fun setBaseUrl(url: String) {
        val normalized = if (url.endsWith("/")) url else "$url/"
        prefs.edit().putString(KEY_BASE_URL, normalized).apply()
    }

    fun getSavedWalletId(): String {
        return prefs.getString(KEY_SAVED_WALLET_ID, "") ?: ""
    }

    fun setSavedWalletId(walletId: String) {
        prefs.edit().putString(KEY_SAVED_WALLET_ID, walletId.trim()).apply()
    }

    fun getSavedSelectedEventId(): String {
        return prefs.getString(KEY_SELECTED_EVENT_ID, "") ?: ""
    }

    fun setSavedSelectedEventId(eventId: String) {
        prefs.edit().putString(KEY_SELECTED_EVENT_ID, eventId).apply()
    }

    fun getRecentOrders(): List<String> {
        val raw = prefs.getString(KEY_RECENT_ORDERS, "") ?: ""
        if (raw.isBlank()) return emptyList()
        return raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }

    fun addRecentOrder(orderId: String) {
        val clean = orderId.trim()
        if (clean.isBlank()) return
        val current = getRecentOrders().toMutableList()
        current.remove(clean)
        current.add(0, clean)
        val limited = current.take(10)
        prefs.edit().putString(KEY_RECENT_ORDERS, limited.joinToString(",")).apply()
    }

    fun removeRecentOrder(orderId: String) {
        val current = getRecentOrders().toMutableList()
        current.remove(orderId.trim())
        prefs.edit().putString(KEY_RECENT_ORDERS, current.joinToString(",")).apply()
    }

    fun generateAndSaveVisitorWalletId(): String {
        val newId = "vis_" + java.util.UUID.randomUUID().toString().replace("-", "").take(12)
        setSavedWalletId(newId)
        return newId
    }

    companion object {
        lateinit var instance: StreetFoodApp
            private set

        const val DEFAULT_BASE_URL = "https://streetfoodevents.onrender.com/"
        const val LOCAL_EMULATOR_BASE_URL = "http://10.0.2.2:4000/"

        private const val KEY_BASE_URL = "key_base_url"
        private const val KEY_SAVED_WALLET_ID = "key_saved_wallet_id"
        private const val KEY_SELECTED_EVENT_ID = "key_selected_event_id"
        private const val KEY_RECENT_ORDERS = "key_recent_orders"
    }
}
