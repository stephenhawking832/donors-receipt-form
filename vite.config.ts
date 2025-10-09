import { URL, fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // IMPORTANT: Change this to the name of your GitHub repository.
      // It should start and end with a slash, e.g., /my-receipt-app/
      base: '/donors-receipt-form/',
      plugins: [
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
          manifest: {
            name: 'Donation Receipt Generator',
            short_name: 'Receipt Gen',
            description: 'A web application to generate PDF donation receipts.',
            theme_color: '#6366f1',
            background_color: '#f1f5f9',
            display: 'standalone',
            icons: [
              {
                src: 'icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable'
              },
              {
                src: 'icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
          },
          devOptions: {
            enabled: true
          }
        })
      ],
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      }
    };
});