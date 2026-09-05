/**
 * Capacitor native integration — initialised once from App.tsx.
 *
 * Handles: back-button, status-bar theming, splash-screen dismiss,
 * network offline banner, and keyboard viewport adjustments.
 *
 * All imports are Capacitor plugins that are tree-shaken on web builds
 * (the plugin calls simply no-op on non-native platforms).
 */
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Network } from '@capacitor/network'
import { Keyboard } from '@capacitor/keyboard'

let _initialised = false

/**
 * Attach all native listeners.  Safe to call on web — everything is guarded.
 *
 * @param navigate  react-router `useNavigate()` reference for back-button.
 * @param isDark    current theme flag for status-bar colouring.
 */
export function initNativeIntegration(
  navigate: (delta: number) => void,
  isDark: boolean,
) {
  if (_initialised || !Capacitor.isNativePlatform()) return
  _initialised = true

  // ── Android hardware back button ──────────────────────────────────────
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      navigate(-1)
    } else {
      CapApp.exitApp()
    }
  })

  // ── Status bar ────────────────────────────────────────────────────────
  setStatusBarTheme(isDark)

  // ── Splash screen ─────────────────────────────────────────────────────
  // Dismiss after the first meaningful paint (DOM is ready when this runs).
  SplashScreen.hide({ fadeOutDuration: 300 })

  // ── Network offline banner ────────────────────────────────────────────
  Network.addListener('networkStatusChange', (status) => {
    const existing = document.getElementById('atlas-offline-banner')
    if (!status.connected && !existing) {
      const banner = document.createElement('div')
      banner.id = 'atlas-offline-banner'
      banner.textContent = 'You are offline — some features may be unavailable.'
      banner.style.cssText = `
        position:fixed;top:0;left:0;right:0;z-index:99999;
        padding:10px 16px;text-align:center;font-size:13px;font-weight:500;
        background:#ef4444;color:#fff;
        animation:slideDown .3s ease;
      `
      document.body.prepend(banner)
    } else if (status.connected && existing) {
      existing.remove()
    }
  })

  // ── Keyboard ──────────────────────────────────────────────────────────
  Keyboard.addListener('keyboardWillShow', (info) => {
    document.documentElement.style.setProperty(
      '--keyboard-height',
      `${info.keyboardHeight}px`,
    )
    document.body.classList.add('keyboard-open')
  })
  Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.style.setProperty('--keyboard-height', '0px')
    document.body.classList.remove('keyboard-open')
  })
}

/**
 * Update the status bar colour to match the current light/dark theme.
 */
export async function setStatusBarTheme(isDark: boolean) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({
      color: isDark ? '#18181b' : '#ffffff',
    })
  } catch {
    // Status bar plugin may not be available on all devices
  }
}
