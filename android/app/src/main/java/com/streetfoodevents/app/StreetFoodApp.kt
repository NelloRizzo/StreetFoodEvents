package com.streetfoodevents.app

import android.app.Application
import com.streetfoodevents.app.data.ads.AnalyticsManager
import com.streetfoodevents.app.data.ads.ConsentManager

class StreetFoodApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ConsentManager.init(this)
        ConsentManager.onAnalyticsChanged { AnalyticsManager.reinitialize() }
        AnalyticsManager.init(this)
    }
}
