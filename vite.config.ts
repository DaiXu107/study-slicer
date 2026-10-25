import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 让构建产物可以直接放到任意静态目录 / GitHub Pages 子路径下。
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    // Electron 的单文件渲染器无法加载额外的动态 chunk，
    // 所以 electron 模式把所有懒加载模块（PDF.js）内联进主 JS。
    rollupOptions: {
      output: mode === 'electron' ? { inlineDynamicImports: true } : undefined,
    },
  },
}));
