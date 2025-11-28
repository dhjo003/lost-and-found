import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:5298',
        changeOrigin: true,
        secure: false
      },
      '/hubs': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:5298',
        changeOrigin: true,
        ws: true,
        secure: false
      }
      ,
      '/uploads': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:5298',
        changeOrigin: true,
        secure: false
      }
    }
  }
});