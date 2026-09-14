import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // prompt 로 두면 새 워커가 waiting 에 걸린 채 기존 워커가 옛 화면을 계속 내줘서
      // 알림조차 뜨지 않는다. 갱신은 즉시 받되(autoUpdate), 반영됐다는 사실을 화면에 알린다.
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '웹훅 알림 허브',
        short_name: '웹훅 알림',
        description: '웹훅을 받아 조건에 맞으면 메일로 알려줍니다.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f9',
        theme_color: '#14181f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // API 와 웹훅 수신 경로는 절대 캐시하지 않는다.
        navigateFallbackDenylist: [/^\/api/, /^\/w\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api') || url.pathname.startsWith('/w/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/w': 'http://localhost:8787',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
