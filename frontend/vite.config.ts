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
        manualChunks(id) {
          // Rolldown (Vite 8) accepts a resolver function here. Keep the
          // framework runtime cacheable without pulling react-markdown into it.
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
