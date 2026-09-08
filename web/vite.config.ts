import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发态把 /api 与 socket.io 反代到后端 3000；生产由同源网关或环境变量 VITE_API_BASE 控制
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd', '@ant-design/icons'],
          charts: ['echarts', 'echarts-for-react'],
          query: ['@tanstack/react-query', 'axios', 'zustand', 'dayjs'],
        },
      },
    },
  },
});
