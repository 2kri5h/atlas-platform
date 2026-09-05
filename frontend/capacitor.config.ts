import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.iitb.atlas',
  appName: 'ATLAS',
  webDir: 'dist',
  server: {
    // Use https scheme so cookies / storage APIs behave like production
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#18181b',
      showSpinner: false,
      launchShowDuration: 2000,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#18181b',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  android: {
    buildOptions: {
      signingType: 'apksigner',
    },
  },
}

export default config
