/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages など、サブパス（/リポジトリ名/）に置く場合は BASE_PATH で指定する
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
