import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 让构建产物可以直接放到任意静态目录 / GitHub Pages 子路径下。
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: false,
  },
});
