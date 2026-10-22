// 把 Vite 的 dist 产物内联成一个 HTML，供 Electron 用 file:// 直接加载。
// 这样不需要本地服务器，也不会碰到 file:// 下 ES module 的跨域限制。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');
const outDir = join(root, 'electron', 'renderer');
const outFile = join(outDir, 'index.html');

let html = await readFile(join(distDir, 'index.html'), 'utf8');

const scriptMatch = html.match(
  /<script[^>]*src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/
);
const styleMatch = html.match(
  /<link[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/
);

if (!scriptMatch || !styleMatch) {
  throw new Error('dist/index.html 里没有找到预期的 JS / CSS 产物，请先运行 vite build。');
}

const [js, css] = await Promise.all([
  readFile(join(distDir, scriptMatch[1]), 'utf8'),
  readFile(join(distDir, styleMatch[1]), 'utf8'),
]);

// 内联脚本里如果出现 </script 会提前结束标签，转义后语义不变。
const safeJs = js.replace(/<\/script/gi, '<\\/script');

// 用函数替换，避免 JS 代码里的 $&、$` 被 String.replace 当成替换模式。
html = html
  .replace(styleMatch[0], () => `<style>${css}</style>`)
  .replace(scriptMatch[0], () => `<script type="module">${safeJs}</script>`);

const faviconMatch = html.match(/<link[^>]*rel="icon"[^>]*>/);
if (faviconMatch) {
  const favicon = await readFile(join(root, 'build', 'icon-64.png'));
  html = html.replace(
    faviconMatch[0],
    () => `<link rel="icon" type="image/png" href="data:image/png;base64,${favicon.toString('base64')}">`
  );
}

await mkdir(outDir, { recursive: true });
await writeFile(outFile, html, 'utf8');
console.log(`electron renderer: ${outFile} (${(html.length / 1024).toFixed(0)} KB)`);
