import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['evidentia_logo.png', 'evidentia-logo.png'],
      manifest: {
        name: 'Força',
        short_name: 'Força',
        description: 'Plataforma premium de entrenamiento y salud',
        theme_color: '#111318',
        background_color: '#0f1210',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: './',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: false,
        type: 'module',
      }
    })
  ],
})
