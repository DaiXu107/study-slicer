/**
 * PDF 文字提取（浏览器本地，基于 Mozilla PDF.js）。
 * 只把逐页文字存进 localStorage，不上传、不保存原始 PDF 文件。
 */
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
/** 单篇 PDF 最多保存 30 万字符，避免撑爆 localStorage */
export const MAX_PDF_TEXT = 300_000;

export interface PdfProgress {
  page: number;
  total: number;
}

export interface ExtractedPdf {
  title: string;
  authors: string[];
  year: number | null;
  pages: string[];
  pageCount: number;
  charCount: number;
  truncated: boolean;
  /** 从正文前几页识别到的 DOI（可选） */
  doi?: string;
}

interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
}

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      // 用 PDF.js 的 fake worker（主线程）而不是独立 worker：
      // 这样网页版和 Electron 的单文件构建都能工作，不需要额外拷贝 worker 资源。
      await import('pdfjs-dist/build/pdf.worker.min.mjs');
      return pdfjs;
    })().catch((error) => {
      pdfjsPromise = null;
      throw error;
    });
  }
  return pdfjsPromise;
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cleanTitle(raw: unknown, fileName: string): string {
  const title = pickString(raw);
  if (title && title.length > 1 && !/^untitled$/i.test(title)) {
    return title.slice(0, 300);
  }
  const fallback = fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (fallback || '未命名 PDF').slice(0, 300);
}

function parseAuthors(raw: unknown): string[] {
  const value = pickString(raw);
  if (!value) return [];
  return value
    .split(/[;,、\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function parseYear(raw: unknown, fallback: number | null): number | null {
  const value = pickString(raw);
  const match = value.match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  if (match) return Number(match[1]);
  return fallback && Number.isFinite(fallback) ? fallback : null;
}

function needsSpace(previous: string, next: string): boolean {
  if (!previous || !next) return false;
  const last = previous.slice(-1);
  const first = next[0];
  if (/\s/.test(last) || /\s/.test(first)) return false;
  // 只在英文 / 数字词块之间补空格；中文和标点保持原样。
  return /[A-Za-z0-9]/.test(last) && /[A-Za-z0-9]/.test(first);
}

function normalizePageText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function itemsToText(items: unknown[]): string {
  let text = '';
  for (const raw of items) {
    const item = raw as TextItemLike;
    if (typeof item.str !== 'string') continue;
    if (item.str) {
      if (needsSpace(text, item.str)) text += ' ';
      text += item.str;
    }
    if (item.hasEOL) text += '\n';
  }
  return normalizePageText(text);
}

/** 从正文前几页找 DOI，找不到就算了 */
function findDoi(pages: string[]): string | undefined {
  const text = pages.slice(0, 3).join('\n');
  const match = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  return match ? match[0].replace(/[.,;)\]]+$/, '') : undefined;
}

/** 把 PDF.js / 浏览器抛出的错误翻译成用户能看懂的一句话 */
export function friendlyPdfError(error: unknown): string {
  const name =
    typeof error === 'object' && error && 'name' in error
      ? String((error as { name?: unknown }).name ?? '')
      : '';
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (name === 'PasswordException' || /password/i.test(message)) {
    return '这个 PDF 有密码保护，暂时无法提取文字。请先解除密码后再导入。';
  }
  if (name === 'InvalidPDFException' || /invalid pdf/i.test(message)) {
    return '文件不是有效的 PDF，或已经损坏。';
  }
  if (/worker/i.test(message)) {
    return 'PDF 解析器加载失败。请刷新页面后重试。';
  }
  return message || 'PDF 解析失败，请换一个文件重试。';
}

export async function extractPdfText(
  file: File,
  onProgress?: (progress: PdfProgress) => void
): Promise<ExtractedPdf> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF 不能超过 50 MB。');
  }
  if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    throw new Error('请选择 PDF 文件。');
  }

  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    stopAtErrors: false,
  });

  let pdf: Awaited<typeof loadingTask.promise> | null = null;
  try {
    pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    let title = cleanTitle('', file.name);
    let authors: string[] = [];
    let year: number | null = null;

    try {
      const metadata = await pdf.getMetadata();
      const info = (metadata?.info ?? {}) as Record<string, unknown>;
      title = cleanTitle(info.Title, file.name);
      authors = parseAuthors(info.Author);
      year = parseYear(info.CreationDate ?? info.ModDate, null);
    } catch {
      // 元数据缺失不影响正文提取
    }

    const pages: string[] = [];
    let charCount = 0;
    let truncated = false;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        let text = itemsToText(content.items);

        const remaining = MAX_PDF_TEXT - charCount;
        if (text.length > remaining) {
          text = text.slice(0, Math.max(0, remaining)).trimEnd();
          truncated = true;
        }
        pages.push(text);
        charCount += text.length;
      } finally {
        page.cleanup();
      }

      onProgress?.({ page: pageNumber, total: pageCount });
      // 让出主线程，让进度条能刷新（fake worker 在主线程解析）
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (truncated) break;
    }

    return { title, authors, year, pages, pageCount, charCount, truncated, doi: findDoi(pages) };
  } catch (error) {
    throw new Error(friendlyPdfError(error));
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // 忽略销毁失败
    }
  }
}
