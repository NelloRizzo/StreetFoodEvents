package com.streetfoodevents.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    primaryContainer = BrandSoft,
    onPrimaryContainer = BrandDeep,
    secondary = Ink,
    onSecondary = Color.White,
    surface = SurfaceStrong,
    onSurface = InkStrong,
    surfaceVariant = Surface,
    onSurfaceVariant = Ink,
    outline = Line,
    outlineVariant = LineStrong,
    background = SurfaceStrong,
    onBackground = InkStrong,
    error = Danger,
    onError = Color.White,
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFE8A48F),
    onPrimary = Color(0xFF1E2C21),
    primaryContainer = BrandDeep,
    onPrimaryContainer = Surface,
    secondary = Color(0xFF9EABA0),
    onSecondary = Color(0xFF1E2C21),
    surface = Color(0xFF1A1A2E),
    onSurface = Color(0xFFE0E0E0),
    surfaceVariant = Color(0xFF2D2D44),
    onSurfaceVariant = Color(0xFFC0C0C0),
    outline = Color(0x33E8A48F),
    outlineVariant = Color(0x66E8A48F),
    background = Color(0xFF121212),
    onBackground = Color(0xFFE0E0E0),
    error = Color(0xFFEF5350),
    onError = Color.White,
)

@Composable
fun StreetFoodTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,
        typography = Typography,
        content = content,
    )
}
