/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 纯前端工作台：产物为静态文件，不依赖任何联网服务
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 8080,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
