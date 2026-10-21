import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Paper } from '../types';
import { chatComplete } from '../lib/llm';
import { searchWorks } from '../lib/openalex';
import { pluralAuthors, truncate } from '../lib/utils';
import { useApp } from '../store/AppContext';
import {
  ArrowLeftIcon,
  BookIcon,
  CheckIcon,
  ExternalLinkIcon,
  SearchIcon,
  XIcon,
} from './Icons';

interface Props {
  paper: Paper;
  projectTitle: string;
  strictMode: boolean;
  onClose: () => void;
  onUpdatePaper: (patch: Partial<Paper>) => void;
  onAddPaper?: (paper: Paper) => boolean;
}

export function PaperReader({
  paper,
  projectTitle,
  strictMode,
  onClose,
  onUpdatePaper,
  onAddPaper,
}: Props) {
  const { settings } = useApp();
  const contentRef = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLDivElement>(null);
  const lastSelectionRef = useRef('');

  const [selection, setSelection] = useState('');
  const [translation, setTranslation] = useState('');
  const [translating, setTranslating] = useState(false);
  const [related, setRelated] = useState<Paper[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState('');
  const [addStatus, setAddStatus] = useState<Record<string, 'added' | 'exists'>>({});

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let timer = 0;
    const capture = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2) return;
      if (sel.rangeCount && contentRef.current) {
        const range = sel.getRangeAt(0);
        if (!contentRef.current.contains(range.commonAncestorContainer)) return;
      }
      const next = text.slice(0, 300);
      if (next === lastSelectionRef.current) return;
      lastSelectionRef.current = next;
      setSelection(next);
      setTranslation('');
      setRelated([]);
      setRelatedError('');
      setAddStatus({});
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(capture, 120);
    };
    document.addEventListener('mouseup', schedule);
    document.addEventListener('touchend', schedule);
    document.addEventListener('selectionchange', schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseup', schedule);
      document.removeEventListener('touchend', schedule);
      document.removeEventListener('selectionchange', schedule);
    };
  }, []);

  useEffect(() => {
    if (!related.length) return;
    const timer = window.setTimeout(() => {
      relatedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [related]);

  async function translateSelection() {
    if (!selection) return;
    if (strictMode) {
      setTranslation('严格模式下不调用 AI 翻译。可以用下面的搜索或 OpenAlex 检索。');
      return;
    }
    if (!settings.apiKey.trim()) {
      setTranslation('还没有配置 API Key。可以到设置里填写，或使用下面的外部搜索。');
      return;
    }
    setTranslating(true);
    setTranslation('');
    try {
      const context = truncate(paper.abstract || paper.interpretation || '', 700);
      const reply = await chatComplete(
        settings,
        [
          {
            role: 'system',
            content:
              '你是学术阅读助手。只输出简洁的中文释义，不寒暄，不超过 120 字。',
          },
          {
            role: 'user',
            content: `文章标题：${paper.title}\n摘要片段：${context}\n\n选中的词或短语：${selection}\n\n请给出中文翻译，并用一句话解释它在学术语境中的含义。`,
          },
        ],
        { temperature: 0.2, maxTokens: 260 }
      );
      setTranslation(reply.trim());
    } catch (err) {
      setTranslation(
        err instanceof Error ? err.message : '翻译失败，可以重试或使用外部搜索。'
      );
    } finally {
      setTranslating(false);
    }
  }

  async function findRelated() {
    if (!selection) return;
    setRelatedLoading(true);
    setRelatedError('');
    setRelated([]);
    setAddStatus({});
    try {
      const papers = await searchWorks(selection, 6, { sort: 'relevance' });
      setRelated(papers);
      if (!papers.length) {
        setRelatedError('没有找到结果。换一个更通用的英文词或缩短选中范围试试。');
      }
    } catch (err) {
      setRelatedError(
        err instanceof Error ? err.message : '文献服务暂时连不上，请稍后再试。'
      );
    } finally {
      setRelatedLoading(false);
    }
  }

  function addRelated(paperToAdd: Paper) {
    if (!onAddPaper) return;
    const added = onAddPaper(paperToAdd);
    setAddStatus((prev) => ({ ...prev, [paperToAdd.id]: added ? 'added' : 'exists' }));
  }

  function closeSelection() {
    lastSelectionRef.current = '';
    setSelection('');
    setTranslation('');
    setRelated([]);
    setRelatedError('');
    setAddStatus({});
  }

  const encoded = encodeURIComponent(selection);
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(`${selection} 意思`)}`;
  const scholarUrl = `https://www.semanticscholar.org/search?q=${encoded}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[85] overflow-y-auto bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="文献阅读器"
    >
      <header className="sticky top-0 z-20 border-b border-line/60 bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft transition hover:text-ink"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            返回
          </button>
          <span className="min-w-0 truncate text-[11px] text-ink-faint">{projectTitle}</span>
          {paper.url ? (
            <a
              href={paper.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink-soft transition hover:text-ink"
            >
              原文
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="w-10" />
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-48 pt-6">
        <p className="eyebrow">Reading</p>
        <h1 className="mt-2 text-[25px] font-semibold leading-tight tracking-tight text-ink">
          {paper.title}
        </h1>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
          {pluralAuthors(paper.authors)} · {paper.year ?? '年份未知'}
          {paper.journal ? ` · ${paper.journal}` : ''}
          {paper.citedByCount > 0 ? ` · 被引 ${paper.citedByCount}` : ''}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {paper.selected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-moss-soft px-2.5 py-1 text-[10px] font-medium text-moss-deep">
              <CheckIcon className="h-3 w-3" />
              核心文献
            </span>
          ) : null}
          {paper.doi ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-ink-faint">
              DOI {paper.doi}
            </span>
          ) : null}
          {paper.manual ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] text-accent-deep">
              手动录入
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {paper.url ? (
            <a
              href={paper.url}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-primary btn-sm"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              在浏览器打开原文
            </a>
          ) : null}
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
          站内展示摘要、解读与笔记。出版社页面通常禁止嵌入，所以原文会在新标签页打开。
        </p>

        <section className="mt-6 rounded-3xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">摘要</h2>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] text-accent-deep">
              选中文字可查词
            </span>
          </div>
          <div
            ref={contentRef}
            data-reader-text
            className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-ink-soft selection:bg-accent-soft"
          >
            {paper.abstract ||
              '这篇文献没有公开摘要。可以点右上角的「原文」去出版社页面阅读，或者直接在下面写笔记。'}
          </div>

          {paper.interpretation ? (
            <div className="mt-4 rounded-2xl bg-accent-soft/60 px-4 py-3">
              <p className="text-[10.5px] font-medium tracking-wide text-accent-deep">
                三句话解读
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                {paper.interpretation}
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-4 card p-5">
          <h2 className="text-[15px] font-semibold">我的笔记</h2>
          <textarea
            value={paper.note ?? ''}
            onChange={(event) => onUpdatePaper({ note: event.target.value })}
            rows={4}
            placeholder="它和我的课题有什么关系？哪一句值得记住？"
            className="mt-2 w-full resize-y rounded-2xl border border-line bg-paper/40 px-3.5 py-3 text-[13px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint/60 focus:bg-white focus:ring-4 focus:ring-ink/5"
          />
          <p className="mt-1.5 text-[10.5px] text-ink-faint">笔记会自动保存到本机。</p>
        </section>

        {relatedLoading || related.length || relatedError ? (
          <section
            ref={relatedRef}
            className="mt-4 scroll-mt-20 rounded-3xl border border-line bg-white p-5 shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">OpenAlex 相关文献</h2>
              <span className="max-w-[50%] truncate text-[10.5px] text-ink-faint">
                “{selection}”
              </span>
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink-faint">
              这是文献索引检索，不是生成式 AI。可以把合适的条目直接加入当前课题的文献库。
            </p>

            {relatedLoading ? (
              <p className="mt-3 text-[12px] text-ink-faint">正在检索…</p>
            ) : null}
            {relatedError ? (
              <p className="mt-3 text-[12px] leading-relaxed text-accent-deep">
                {relatedError}
              </p>
            ) : null}

            <div className="mt-3 divide-y divide-line/60">
              {related.map((item) => {
                const status = addStatus[item.id];
                return (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-[13px] font-medium leading-snug text-ink">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[10.5px] text-ink-faint">
                      {pluralAuthors(item.authors)} · {item.year ?? '年份未知'}
                      {item.citedByCount > 0 ? ` · 被引 ${item.citedByCount}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {onAddPaper ? (
                        <button
                          type="button"
                          onClick={() => addRelated(item)}
                          disabled={Boolean(status)}
                          className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-ink-soft transition hover:border-ink-faint/60 hover:text-ink disabled:opacity-60"
                        >
                          {status === 'added'
                            ? '已加入'
                            : status === 'exists'
                              ? '已在库中'
                              : '加入文献库'}
                        </button>
                      ) : null}
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-[10.5px] text-ink-faint underline-offset-2 hover:text-ink hover:underline"
                        >
                          原文
                          <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>

      {selection ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 min-w-0 text-[12px] leading-relaxed text-ink-soft">
                “{selection}”
              </p>
              <button
                type="button"
                onClick={closeSelection}
                aria-label="关闭划词工具"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-ink/5 hover:text-ink"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!strictMode ? (
                <button
                  type="button"
                  onClick={() => void translateSelection()}
                  disabled={translating}
                  className="btn btn-primary btn-sm"
                >
                  {translating ? '翻译中…' : 'AI 速译'}
                </button>
              ) : null}
              <a
                href={bingUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-secondary btn-sm"
              >
                <SearchIcon className="h-3.5 w-3.5" />
                搜索词义
              </a>
              <a
                href={scholarUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn-ghost btn-sm"
              >
                学术搜索
              </a>
              <button
                type="button"
                onClick={() => void findRelated()}
                disabled={relatedLoading}
                className="btn btn-secondary btn-sm"
              >
                <BookIcon className="h-3.5 w-3.5" />
                {relatedLoading ? '检索中…' : 'OpenAlex 找文献'}
              </button>
            </div>

            {strictMode ? (
              <p className="mt-2 text-[10px] leading-relaxed text-moss-deep">
                严格模式：这里不调用 AI 翻译。搜索与 OpenAlex 检索不是生成式 AI。
              </p>
            ) : null}

            {translation ? (
              <div className="mt-2 max-h-32 overflow-y-auto rounded-2xl bg-paper px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
                {translation}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
