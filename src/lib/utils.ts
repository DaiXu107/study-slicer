/** 小工具集合：id、className、剪贴板、文本截断 */

export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面的兼容方案
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function truncate(text: string, max = 200): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function pluralAuthors(authors: string[]): string {
  if (!authors.length) return '作者未知';
  if (authors.length <= 3) return authors.join('、');
  return `${authors.slice(0, 3).join('、')} 等`;
}
