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
    // 主题纹理体积不大，直接内联成 base64，网页和 Electron 单文件都不用额外请求图片。
    assetsInlineLimit: 1_000_000,
    // Electron 的单文件渲染器无法加载额外的动态 chunk，
    // 所以 electron 模式把所有懒加载模块（PDF.js）内联进主 JS。
    rollupOptions: {
      output: mode === 'electron' ? { inlineDynamicImports: true } : undefined,
    },
  },
}));
