package com.streetfoodevents.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.streetfoodevents.app.data.ads.ConsentManager
import com.streetfoodevents.app.ui.components.PrivacyConsentDialog
import com.streetfoodevents.app.ui.navigation.NavGraph
import com.streetfoodevents.app.ui.theme.StreetFoodTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            StreetFoodTheme {
                var showConsent by remember { mutableStateOf(!ConsentManager.isConsentGiven()) }

                if (showConsent) {
                    PrivacyConsentDialog(onDismiss = { showConsent = false })
                }

                NavGraph()
            }
        }
    }
}
