import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Paper } from '../types';
import { chatComplete } from '../lib/llm';
import { searchWorks } from '../lib/openalex';
import { cx, pluralAuthors, truncate } from '../lib/utils';
import { useApp } from '../store/AppContext';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookIcon,
  ExternalLinkIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from './Icons';
import { PdfBookReader } from './PdfBookReader';

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
  const relatedRef = useRef<HTMLDivElement>(null);
  const lastSelectionRef = useRef('');

  const [selection, setSelection] = useState('');
  const [ebookOpen, setEbookOpen] = useState(false);
  const [editingFullText, setEditingFullText] = useState(false);
  const [fullTextDraft, setFullTextDraft] = useState(paper.fullText ?? '');
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
      if (event.key === 'Escape') {
        if (ebookOpen) setEbookOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, ebookOpen]);

  useEffect(() => {
    let timer = 0;
    const capture = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2) return;
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const ancestor = range.commonAncestorContainer;
        const element =
          ancestor.nodeType === Node.TEXT_NODE
            ? ancestor.parentElement
            : (ancestor as Element);
        if (!element?.closest('[data-reader-text]')) return;
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

  function saveFullText() {
    const text = fullTextDraft.trim();
    onUpdatePaper({ fullText: text ? text.slice(0, 100000) : undefined });
    setFullTextDraft(text.slice(0, 100000));
    setEditingFullText(false);
  }

  const encoded = encodeURIComponent(selection);
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(`${selection} 意思`)}`;
  const scholarUrl = `https://www.semanticscholar.org/search?q=${encoded}`;

  const pdfPages = paper.pdfPages ?? [];
  const pdfChars = pdfPages.reduce((sum, page) => sum + page.length, 0);
  const pdfLastPage = Math.min(
    Math.max(paper.pdfLastPage ?? 0, 0),
    Math.max(pdfPages.length - 1, 0)
  );

  function clearPdfText() {
    if (
      !window.confirm(
        '移除这篇 PDF 的提取文字？原始 PDF 文件不会被修改或删除，可以之后重新导入。'
      )
    ) {
      return;
    }
    setEbookOpen(false);
    onUpdatePaper({
      pdfPages: undefined,
      pdfFileName: undefined,
      pdfPageCount: undefined,
      pdfTruncated: undefined,
      pdfLastPage: undefined,
    });
  }

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
            onClick={() => (ebookOpen ? setEbookOpen(false) : onClose())}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft transition hover:text-ink"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {ebookOpen ? '书籍信息' : '返回'}
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

      {ebookOpen && pdfPages.length ? (
        <PdfBookReader
          key={paper.id}
          paper={paper}
          onUpdatePaper={onUpdatePaper}
        />
      ) : (
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
          <button
            type="button"
            onClick={() => onUpdatePaper({ selected: !paper.selected })}
            aria-pressed={Boolean(paper.selected)}
            className={cx(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition',
              paper.selected
                ? 'border-sun/40 bg-sun/15 text-accent-deep'
                : 'border-line bg-surface text-ink-faint hover:text-ink-soft'
            )}
          >
            <StarIcon
              filled={Boolean(paper.selected)}
              className={cx('h-3 w-3', paper.selected && 'text-sun')}
            />
            {paper.selected ? '核心文献' : '设为核心'}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdatePaper({
                read: !paper.read,
                readAt: !paper.read ? new Date().toISOString() : undefined,
              })
            }
            aria-pressed={Boolean(paper.read)}
            title="点击切换阅读状态"
            className={cx(
              'rounded-full border px-2.5 py-1 text-[10px] transition',
              paper.read
                ? 'border-moss/30 bg-moss-soft text-moss-deep'
                : 'border-line bg-surface text-ink-faint hover:text-ink-soft'
            )}
          >
            {paper.read ? '已读' : '未读'}
          </button>
          <button
            type="button"
            onClick={() => onUpdatePaper({ irrelevant: !paper.irrelevant })}
            className={cx(
              'rounded-full border px-2.5 py-1 text-[10px] transition',
              paper.irrelevant
                ? 'border-accent/30 bg-accent-soft text-accent-deep'
                : 'border-line bg-surface text-ink-faint hover:text-ink-soft'
            )}
          >
            {paper.irrelevant ? '不相关' : '标记不相关'}
          </button>
          {paper.doi ? (
            <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] text-ink-faint">
              DOI {paper.doi}
            </span>
          ) : null}
          {paper.manual ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] text-accent-deep">
              本地
            </span>
          ) : null}
          {pdfPages.length ? (
            <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] text-paper">
              PDF · {pdfPages.length} 页
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
          站内展示摘要、解读、笔记与导入的 PDF 文字。出版社页面通常禁止嵌入，所以原文会在新标签页打开。
        </p>

        {pdfPages.length ? (
          <section className="mt-5 rounded-3xl border border-ink/10 bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow text-accent-deep">PDF Book</p>
                <h2 className="mt-1 text-[17px] font-semibold">PDF 电子书</h2>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
                  {paper.pdfFileName ? `${paper.pdfFileName} · ` : ''}
                  {pdfPages.length} / {paper.pdfPageCount ?? pdfPages.length} 页 ·{' '}
                  {pdfChars.toLocaleString()} 字
                </p>
                <p className="mt-1 text-[10.5px] text-ink-faint">
                  文字已在本机提取，不保存原始 PDF，也不会上传。
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] text-accent-deep">
                PDF
              </span>
            </div>
            {paper.pdfTruncated ? (
              <p className="mt-3 rounded-2xl border border-accent/20 bg-accent-soft/60 px-3.5 py-2 text-[10.5px] leading-relaxed text-accent-deep">
                单篇文字超过 30 万字符，已保留前 {pdfPages.length} 页。
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEbookOpen(true)}
                className="btn btn-primary btn-sm"
              >
                <BookIcon className="h-3.5 w-3.5" />
                {pdfLastPage > 0 ? `从第 ${pdfLastPage + 1} 页继续` : '开始阅读'}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={clearPdfText} className="btn btn-ghost btn-sm">
                移除 PDF 文字
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">摘要</h2>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] text-accent-deep">
              选中文字可查词
            </span>
          </div>
          <div
            data-reader-text
            className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-ink-soft selection:bg-accent-soft"
          >
            {paper.abstract ||
              '这篇文献没有公开摘要。可以点右上角的「原文」去出版社页面阅读，或者直接在下面写笔记。'}
          </div>

          {paper.interpretation ? (
            <div className="mt-4 rounded-2xl bg-accent-soft/60 px-4 py-3" data-reader-text>
              <p className="text-[10.5px] font-medium tracking-wide text-accent-deep">
                三句话解读
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                {paper.interpretation}
              </p>
            </div>
          ) : null}
        </section>

        {!pdfPages.length || paper.fullText ? (
        <section className="mt-4 card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">粘贴全文</h2>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-faint">
                可选：把网页正文粘进来，在站内大字号阅读、划词。只保存在本机。
              </p>
            </div>
            {paper.fullText && !editingFullText ? (
              <button
                type="button"
                onClick={() => {
                  setFullTextDraft(paper.fullText ?? '');
                  setEditingFullText(true);
                }}
                className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[10.5px] text-ink-soft transition hover:border-ink-faint/60 hover:text-ink"
              >
                编辑
              </button>
            ) : null}
          </div>

          {editingFullText ? (
            <>
              <textarea
                value={fullTextDraft}
                onChange={(event) => setFullTextDraft(event.target.value)}
                rows={10}
                maxLength={100000}
                placeholder="从 PDF 或网页复制正文，粘贴到这里…"
                className="mt-3 w-full resize-y rounded-2xl border border-line bg-paper/40 px-3.5 py-3 text-[13px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint/60 focus:bg-surface focus:ring-4 focus:ring-ink/5"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-ink-faint">
                  {fullTextDraft.length} / 100000 · 只保存在本机
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingFullText(false)}
                    className="btn btn-ghost btn-sm"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={saveFullText}
                    className="btn btn-primary btn-sm"
                  >
                    保存全文
                  </button>
                </div>
              </div>
            </>
          ) : paper.fullText ? (
            <div
              data-reader-text
              className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-ink-soft selection:bg-accent-soft"
            >
              {paper.fullText}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFullTextDraft('');
                setEditingFullText(true);
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line py-3 text-[12px] text-ink-faint transition hover:border-ink-faint hover:text-ink-soft"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              粘贴全文，在站内继续阅读
            </button>
          )}
        </section>
        ) : null}

        <section className="mt-4 card p-5">
          <h2 className="text-[15px] font-semibold">我的笔记</h2>
          <textarea
            value={paper.note ?? ''}
            onChange={(event) => onUpdatePaper({ note: event.target.value })}
            rows={4}
            placeholder="它和我的课题有什么关系？哪一句值得记住？"
            className="mt-2 w-full resize-y rounded-2xl border border-line bg-paper/40 px-3.5 py-3 text-[13px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint/60 focus:bg-surface focus:ring-4 focus:ring-ink/5"
          />
          <p className="mt-1.5 text-[10.5px] text-ink-faint">笔记会自动保存到本机。</p>
        </section>

        {relatedLoading || related.length || relatedError ? (
          <section
            ref={relatedRef}
            className="mt-4 scroll-mt-20 rounded-3xl border border-line bg-surface p-5 shadow-card"
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
      )}

      {selection ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
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
