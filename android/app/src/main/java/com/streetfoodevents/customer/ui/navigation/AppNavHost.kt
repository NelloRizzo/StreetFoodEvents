package com.streetfoodevents.customer.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.streetfoodevents.customer.ui.screens.events.EventDetailScreen
import com.streetfoodevents.customer.ui.screens.events.EventsScreen
import com.streetfoodevents.customer.ui.screens.menu.MenuScreen
import com.streetfoodevents.customer.ui.screens.orders.OrderTrackScreen
import com.streetfoodevents.customer.ui.screens.settings.SettingsScreen
import com.streetfoodevents.customer.ui.screens.wallet.WalletScreen
import com.streetfoodevents.customer.ui.theme.BrandAccent
import com.streetfoodevents.customer.ui.theme.BrandPrimary
import com.streetfoodevents.customer.ui.theme.BrandPrimaryDark

@Composable
fun AppNavHost() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Check if bottom bar should be visible (only on main tabs)
    val showBottomBar = BottomNavItems.any { item ->
        currentRoute == item.route || (item == Screen.Menu && currentRoute?.startsWith("menu") == true)
    }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = BrandPrimaryDark,
                    contentColor = Color.White
                ) {
                    BottomNavItems.forEach { screen ->
                        val isSelected = when (screen) {
                            Screen.Menu -> currentRoute?.startsWith("menu") == true
                            else -> currentRoute == screen.route
                        }

                        NavigationBarItem(
                            icon = {
                                if (screen.icon != null) {
                                    Icon(screen.icon, contentDescription = screen.title)
                                }
                            },
                            label = { Text(screen.title) },
                            selected = isSelected,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = BrandPrimaryDark,
                                selectedTextColor = BrandAccent,
                                indicatorColor = BrandAccent,
                                unselectedIconColor = Color.White.copy(alpha = 0.7f),
                                unselectedTextColor = Color.White.copy(alpha = 0.7f)
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Events.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Events.route) {
                EventsScreen(
                    onEventClick = { eventId ->
                        navController.navigate(Screen.EventDetail.createRoute(eventId))
                    },
                    onMenuClick = { eventId ->
                        navController.navigate(Screen.Menu.createRoute(eventId))
                    },
                    onOpenSettings = {
                        navController.navigate(Screen.Settings.route)
                    }
                )
            }

            composable(
                route = Screen.EventDetail.route,
                arguments = listOf(navArgument("eventId") { type = NavType.StringType })
            ) { backStackEntry ->
                val eventId = backStackEntry.arguments?.getString("eventId") ?: ""
                EventDetailScreen(
                    eventId = eventId,
                    onNavigateBack = { navController.popBackStack() },
                    onOpenMenu = { id -> navController.navigate(Screen.Menu.createRoute(id)) },
                    onOpenWallet = { navController.navigate(Screen.Wallet.route) }
                )
            }

            composable(
                route = Screen.Menu.route,
                arguments = listOf(
                    navArgument("eventId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    }
                )
            ) { backStackEntry ->
                val eventId = backStackEntry.arguments?.getString("eventId")
                MenuScreen(
                    eventId = eventId,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Wallet.route) {
                WalletScreen(
                    onOpenSettings = { navController.navigate(Screen.Settings.route) }
                )
            }

            composable(Screen.OrderTrack.route) {
                OrderTrackScreen()
            }

            composable(Screen.Settings.route) {
                SettingsScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}
