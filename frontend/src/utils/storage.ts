/**
 * Platform-aware storage abstraction.
 *
 * On native (Android/iOS via Capacitor) tokens are stored in
 * the iOS Keychain / Android Keystore. Browser authentication uses HttpOnly
 * cookies and deliberately never persists bearer tokens in Web Storage.
 */
import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

export const isNativePlatform = Capacitor.isNativePlatform()

let initializePromise: Promise<void> | null = null
const initializeNativeStorage = () => {
  if (!initializePromise) initializePromise = SecureStorage.setKeyPrefix('atlas_auth_')
  return initializePromise
}

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (isNativePlatform) {
      await initializeNativeStorage()
      return SecureStorage.getItem(key)
    }
    return null
  },

  async set(key: string, value: string): Promise<void> {
    if (isNativePlatform) {
      await initializeNativeStorage()
      await SecureStorage.setItem(key, value)
    }
  },

  async remove(key: string): Promise<void> {
    if (isNativePlatform) {
      await initializeNativeStorage()
      await SecureStorage.removeItem(key)
    }
  },
}
