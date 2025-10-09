import { URL, fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // IMPORTANT: Change this to the name of your GitHub repository.
      // It should start and end with a slash, e.g., /my-receipt-app/
      base: '/donors-receipt-form/',
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      }
    };
});
