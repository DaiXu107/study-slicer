import orchidInk from '../assets/themes/orchid-ink.webp';
import paperGrain from '../assets/themes/paper-grain.webp';
import snowflakes from '../assets/themes/snowflakes.webp';

/**
 * 主题纹理。Vite 会在构建时把小于 assetsInlineLimit 的图片转成 base64：
 * 网页、GitHub Pages 和 Electron 单文件渲染器都不需要额外请求图片。
 */
export const THEME_ART = {
  orchid: orchidInk,
  snow: snowflakes,
  paper: paperGrain,
} as const;

export function applyThemeArt(root: HTMLElement): void {
  if (root.dataset.themeArt === '1') return;
  root.style.setProperty('--art-orchid', `url("${THEME_ART.orchid}")`);
  root.style.setProperty('--art-snow', `url("${THEME_ART.snow}")`);
  root.style.setProperty('--art-paper', `url("${THEME_ART.paper}")`);
  root.dataset.themeArt = '1';
}
