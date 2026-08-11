import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
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
        navigateFallback: 'index.html',
        // Never treat hashed asset requests as SPA navigations.
        navigateFallbackDenylist: [/^\/assets\//],
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
