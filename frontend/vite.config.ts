import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const port = Number(process.env.PORT) || 3000
const target = process.env.BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
      },
    },
  },
  build: {
    // Capacitor loads from local assets — keep sourcemaps for debugging
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libraries into separate chunks so the
          // initial bundle is small and subsequent loads benefit from
          // browser / WebView cache.
          'vendor-react': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          'vendor-charts': ['recharts'],
          'vendor-three': ['three'],
        },
      },
    },
  },
})