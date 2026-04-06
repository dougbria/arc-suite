import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@arc\/(.*\.js)$/, replacement: path.resolve(__dirname, '../../packages/core/src/$1') },
      { find: /^@arc\/(.*\.css)$/, replacement: path.resolve(__dirname, '../../apps/render/src/$1') }
    ]
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://engine.prod.bria-api.com/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false
      }
    }
  },
  base: '/'
});
