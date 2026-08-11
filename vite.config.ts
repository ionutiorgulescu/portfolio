import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const appBuildId = Date.now().toString()

function emitBuildId(): Plugin {
  return {
    name: 'emit-build-id',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-id.txt',
        source: appBuildId,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  plugins: [
    react(),
    emitBuildId(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered manually in main.tsx so we can check for updates immediately.
      injectRegister: null,
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      // Use public/manifest.webmanifest instead of generating one
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Keep build-id out of precache so resume checks always hit the network.
        globIgnores: ['**/build-id.txt'],
        navigateFallback: 'index.html',
        // Never treat hashed asset requests as SPA navigations.
        navigateFallbackDenylist: [/^\/assets\//, /^\/build-id\.txt$/],
        runtimeCaching: [
          {
            // Prefer network for navigations so resumed PWAs don't keep an old shell.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    target: 'baseline-widely-available',
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/react-router-dom/')) {
            return 'vendor-router'
          }
          if (
            id.includes('node_modules/@mui/material/') ||
            id.includes('node_modules/@mui/icons-material/') ||
            id.includes('node_modules/@emotion/react/') ||
            id.includes('node_modules/@emotion/styled/')
          ) {
            return 'vendor-ui'
          }
          if (id.includes('node_modules/@tanstack/react-query/')) {
            return 'vendor-query'
          }
          if (id.includes('node_modules/recharts/')) {
            return 'vendor-recharts'
          }
          if (id.includes('node_modules/@supabase/supabase-js/')) {
            return 'vendor-supabase'
          }
          return undefined
        },
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts', '@tanstack/react-query'],
  },

  server: {
    port: 3000,
    hmr: {
      overlay: true,
    },
  },
})
