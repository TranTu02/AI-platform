import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite chạy ở :5173, mọi request /api được proxy sang Mastra server :4111
// (cùng origin nên không vướng CORS). Production: nginx làm đúng việc này
// (xem chat/nginx.conf). Muốn chat gọi thẳng server khác thì set
// VITE_MASTRA_URL, ví dụ VITE_MASTRA_URL=http://192.168.10.201:4111
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
});
