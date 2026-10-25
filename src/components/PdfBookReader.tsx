import { useEffect, useRef, useState } from 'react';
import type { Paper } from '../types';
import { ArrowLeftIcon, ArrowRightIcon, BookIcon } from './Icons';
import { ProgressBar } from './ProgressBar';
import { cx } from '../lib/utils';

interface Props {
  paper: Paper;
  onUpdatePaper: (patch: Partial<Paper>) => void;
}

const FONT_SIZES = [15, 17, 19, 21, 23];

/** 把 PDF 逐页文字当成电子书来读：翻页、字号、进度保存。 */
export function PdfBookReader({ paper, onUpdatePaper }: Props) {
  const pages = paper.pdfPages ?? [];
  const total = pages.length;
  const initial = Math.min(Math.max(paper.pdfLastPage ?? 0, 0), Math.max(total - 1, 0));
  const [index, setIndex] = useState(initial);
  const [fontIndex, setFontIndex] = useState(1);
  const [pageInput, setPageInput] = useState(String(initial + 1));
  const topRef = useRef<HTMLDivElement>(null);

  const pageText = pages[index] ?? '';
  const fontSize = FONT_SIZES[fontIndex] ?? 17;

  function go(next: number) {
    if (!total) return;
    const target = Math.min(Math.max(next, 0), total - 1);
    if (target === index) return;
    setIndex(target);
    setPageInput(String(target + 1));
    onUpdatePaper({ pdfLastPage: target });
    window.setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function commitPageInput() {
    const value = Number(pageInput);
    if (!Number.isFinite(value) || !total) {
      setPageInput(String(index + 1));
      return;
    }
    const target = Math.min(Math.max(Math.floor(value), 1), total) - 1;
    if (target === index) setPageInput(String(index + 1));
    else go(target);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        go(index + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-48 pt-6">
      <div ref={topRef} className="scroll-mt-20">
        <div className="flex items-center justify-end gap-1">
          <span className="mr-1 text-[10.5px] text-ink-faint">字号</span>
          <button
              type="button"
              onClick={() => setFontIndex((value) => Math.max(0, value - 1))}
              disabled={fontIndex === 0}
              aria-label="减小字号"
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-[12px] text-ink-soft transition hover:border-ink-faint disabled:opacity-40"
            >
              A−
            </button>
            <button
              type="button"
              onClick={() =>
                setFontIndex((value) => Math.min(FONT_SIZES.length - 1, value + 1))
              }
              disabled={fontIndex === FONT_SIZES.length - 1}
              aria-label="增大字号"
              className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-[14px] text-ink-soft transition hover:border-ink-faint disabled:opacity-40"
            >
              A+
            </button>
          </div>

        <div className="mt-3 flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-deep">
            <BookIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold leading-snug text-ink">
              {paper.title}
            </h1>
            <p className="truncate text-[10.5px] text-ink-faint">
              {paper.pdfFileName ?? 'PDF'} · 已提取 {total} / {paper.pdfPageCount ?? total} 页
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index <= 0}
              className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-soft transition hover:border-ink-faint disabled:opacity-40"
              aria-label="上一页"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
            </button>
            <label className="inline-flex items-center gap-1 text-[11.5px] text-ink-faint">
              第
              <input
                type="number"
                min={1}
                max={total || 1}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                aria-label="跳转到页"
                className="w-12 rounded-lg border border-line bg-paper px-1 py-1 text-center text-[12px] text-ink outline-none focus:border-ink-faint"
              />
              / {total} 页
            </label>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index >= total - 1}
              className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-soft transition hover:border-ink-faint disabled:opacity-40"
              aria-label="下一页"
            >
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-[10.5px] text-ink-faint">
            {pageText.length} 字 · 方向键翻页
          </span>
        </div>

        <ProgressBar value={total ? ((index + 1) / total) * 100 : 0} className="mt-2.5" />

        {paper.pdfTruncated ? (
          <p className="mt-3 rounded-2xl border border-accent/20 bg-accent-soft/60 px-3.5 py-2 text-[10.5px] leading-relaxed text-accent-deep">
            这篇 PDF 的文字超过了单篇 30 万字符的保存上限，已保留前 {total} 页。
          </p>
        ) : null}

        <article className="mt-5 rounded-3xl border border-line bg-surface px-5 py-6 shadow-card sm:px-7">
          <div
            data-reader-text
            className={cx(
              'whitespace-pre-wrap break-words text-ink-soft selection:bg-accent-soft',
              !pageText && 'text-center text-ink-faint'
            )}
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.95 }}
          >
            {pageText ||
              '这一页没有提取到文字。可能是图片页、扫描页，或 PDF 本身没有文字层。'}
          </div>
        </article>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index <= 0}
            className="btn btn-secondary btn-sm disabled:opacity-40"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            上一页
          </button>
          <span className="text-[10.5px] text-ink-faint">
            {total ? Math.round(((index + 1) / total) * 100) : 0}%
          </span>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index >= total - 1}
            className="btn btn-primary btn-sm disabled:opacity-40"
          >
            下一页
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </main>
  );
}
