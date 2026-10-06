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
    // Source maps off in prod — errors go through Sentry/request_id
    sourcemap: false,

    // Raise chunk warning threshold (AI markdown + katex are intentionally large)
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        /**
         * Manual chunk strategy:
         *  - vendor-react:    React + router — tiny, changes rarely → long browser cache
         *  - vendor-markdown: react-markdown + remark/rehype + katex → rarely changes
         *  - vendor-ui:       lucide-react icons → rarely changes
         *  - Everything else: app code (frequent changes → short cache, small size)
         */
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) {
            return 'vendor-react'
          }
          if (/node_modules[\\/](react-markdown|remark|rehype|remark-gfm|remark-math|rehype-katex|katex|unified|micromark|mdast|hast|vfile|property-information|decode-named-character-reference)[\\/]/.test(id)) {
            return 'vendor-markdown'
          }
          if (/node_modules[\\/]lucide-react[\\/]/.test(id)) {
            return 'vendor-ui'
          }
          if (/node_modules[\\/]axios[\\/]/.test(id)) {
            return 'vendor-http'
          }
        },
      },
    },
  },

  // Inline small assets (< 4KB) as base64 to save round-trips
  assetsInlineLimit: 4096,
})
