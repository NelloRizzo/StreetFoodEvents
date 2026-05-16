package com.streetfoodevents.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.streetfoodevents.app.ui.screens.home.HomeScreen
import com.streetfoodevents.app.ui.screens.login.LoginScreen
import com.streetfoodevents.app.ui.screens.register.RegisterScreen
import com.streetfoodevents.app.ui.screens.eventdetail.EventDetailScreen
import com.streetfoodevents.app.ui.screens.standmenu.StandMenuScreen
import com.streetfoodevents.app.ui.screens.orders.OrdersScreen
import com.streetfoodevents.app.ui.screens.orderdetail.OrderDetailScreen
import com.streetfoodevents.app.ui.screens.favorites.FavoritesScreen
import com.streetfoodevents.app.ui.screens.wallet.WalletScreen
import com.streetfoodevents.app.ui.screens.privacy.PrivacyScreen
import com.streetfoodevents.app.ui.screens.profile.ProfileScreen

object Routes {
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val HOME = "home"
    const val EVENT_DETAIL = "event/{eventId}"
    const val STAND_MENU = "event/{eventId}/stand/{standId}"
    const val ORDERS = "orders"
    const val ORDER_DETAIL = "order/{orderId}"
    const val FAVORITES = "favorites"
    const val WALLET = "wallet"
    const val PROFILE = "profile"
    const val PRIVACY = "privacy"

    fun eventDetail(eventId: String) = "event/$eventId"
    fun standMenu(eventId: String, standId: String) = "event/$eventId/stand/$standId"
    fun orderDetail(orderId: String) = "order/$orderId"
}

@Composable
fun NavGraph(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = Routes.HOME) {
        composable(Routes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.HOME) { inclusive = true }
                    }
                },
                onRegisterClick = {
                    navController.navigate(Routes.REGISTER) {
                        popUpTo(Routes.HOME)
                    }
                }
            )
        }

        composable(Routes.REGISTER) {
            RegisterScreen(
                onRegisterSuccess = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.HOME) { inclusive = true }
                    }
                },
                onLoginClick = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.HOME)
                    }
                }
            )
        }

        composable(Routes.HOME) {
            HomeScreen(
                onEventClick = { eventId ->
                    navController.navigate(Routes.eventDetail(eventId))
                },
                onOrdersClick = {
                    navController.navigate(Routes.ORDERS)
                },
                onFavoritesClick = {
                    navController.navigate(Routes.FAVORITES)
                },
                onLoginClick = {
                    navController.navigate(Routes.LOGIN)
                },
                onRegisterClick = {
                    navController.navigate(Routes.REGISTER)
                },
                onProfileClick = {
                    navController.navigate(Routes.PROFILE)
                },
                onPrivacyClick = {
                    navController.navigate(Routes.PRIVACY)
                },
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(
            route = Routes.EVENT_DETAIL,
            arguments = listOf(navArgument("eventId") { type = NavType.StringType })
        ) { backStackEntry ->
            val eventId = backStackEntry.arguments?.getString("eventId") ?: return@composable
            EventDetailScreen(
                eventId = eventId,
                onStandClick = { standId ->
                    navController.navigate(Routes.standMenu(eventId, standId))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.STAND_MENU,
            arguments = listOf(
                navArgument("eventId") { type = NavType.StringType },
                navArgument("standId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val eventId = backStackEntry.arguments?.getString("eventId") ?: return@composable
            val standId = backStackEntry.arguments?.getString("standId") ?: return@composable
            StandMenuScreen(
                eventId = eventId,
                standId = standId,
                onOrderCreated = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.ORDERS) {
            OrdersScreen(
                onOrderClick = { orderId ->
                    navController.navigate(Routes.orderDetail(orderId))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.ORDER_DETAIL,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType })
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId") ?: return@composable
            OrderDetailScreen(
                orderId = orderId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.FAVORITES) {
            FavoritesScreen(
                onEventClick = { eventId ->
                    navController.navigate(Routes.eventDetail(eventId))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.WALLET) {
            WalletScreen(onBack = { navController.popBackStack() })
        }

        composable(Routes.PROFILE) {
            ProfileScreen(
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onBack = { navController.popBackStack() },
                onPrivacyClick = {
                    navController.navigate(Routes.PRIVACY)
                },
            )
        }

        composable(Routes.PRIVACY) {
            PrivacyScreen(onBack = { navController.popBackStack() })
        }
    }
}
