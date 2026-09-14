import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 배포 시각을 화면에 노출해 "지금 보고 있는 게 최신인가" 를 눈으로 확인할 수 있게 한다.
const BUILD_TIME = new Date().toISOString()

export default defineConfig({
  define: { __BUILD_TIME__: JSON.stringify(BUILD_TIME) },
  plugins: [
    react(),
    VitePWA({
      // autoUpdate 는 제어권이 바뀌는 순간 클라이언트가 스스로 새로고침해버려 알림이 뜰 새가 없다.
      // prompt 로 두어 새 워커를 대기시키고, 사용자가 누를 때 반영한다.
      registerType: 'prompt',
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
