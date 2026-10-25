/// <reference types="vite/client" />

// PDF.js worker 作为普通模块加载时只依赖它的副作用：
// 把 WorkerMessageHandler 挂到 globalThis.pdfjsWorker，供 fake worker 使用。
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
