/**
 * Platform-aware storage abstraction.
 *
 * On native (Android/iOS via Capacitor) tokens are stored in
 * SharedPreferences (sandboxed per-app).  On the web the fallback
 * is localStorage which is acceptable for a browser context.
 */
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const isNative = Capacitor.isNativePlatform()

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (isNative) {
      const { value } = await Preferences.get({ key })
      return value
    }
    return localStorage.getItem(key)
  },

  async set(key: string, value: string): Promise<void> {
    if (isNative) {
      await Preferences.set({ key, value })
    } else {
      localStorage.setItem(key, value)
    }
  },

  async remove(key: string): Promise<void> {
    if (isNative) {
      await Preferences.remove({ key })
    } else {
      localStorage.removeItem(key)
    }
  },
}
