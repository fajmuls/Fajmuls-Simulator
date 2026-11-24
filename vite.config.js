import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pasar Satwa',
        short_name: 'Pasar Satwa',
        description: 'Game simulator toko hewan: belanja, jual, breeding, investasi, dan kembangkan pasarmu.',
        id: 'pasar-satwa',
        lang: 'id',
        categories: ['games', 'simulation'],
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fff3d6',
        theme_color: '#fff3d6',
        screenshots: [
          { src: 'screenshots/toko.png', sizes: '720x1280', type: 'image/png', form_factor: 'narrow', label: 'Toko dan peta Pasar Satwa' },
          { src: 'screenshots/menu.png', sizes: '720x1280', type: 'image/png', form_factor: 'narrow', label: 'Menu: koleksi, skill, karyawan' },
          { src: 'screenshots/cerita.png', sizes: '720x1280', type: 'image/png', form_factor: 'narrow', label: 'Campaign cerita' },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 2500 },
  test: { include: ['tests/**/*.test.js'] },
});
