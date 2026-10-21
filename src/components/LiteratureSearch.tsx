import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Paper, Project } from '../types';
import { searchWorks } from '../lib/openalex';
import { cx, pluralAuthors, truncate } from '../lib/utils';
import { useApp } from '../store/AppContext';
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  RefreshIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from './Icons';

interface Props {
  projectId: string;
  onClose: () => void;
}

const SPLITTER = /[,，;；:：、/|｜\n]+/;

function splitTerms(value: string): string[] {
  return value
    .split(SPLITTER)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function buildSearchVariants(title: string, keywords: string): string[] {
  const cleanTitle = title.replace(/\s+/g, ' ').trim();
  const parts = splitTerms(keywords);
  const titleParts = splitTerms(title);
  const joined = parts.join(' ');
  const candidates = [
    joined,
    ...parts,
    cleanTitle,
    ...titleParts.filter((part) => part !== cleanTitle),
    parts.length ? `${cleanTitle} ${joined}` : '',
    parts.length > 1 ? `${parts[0]} ${parts[1]}` : '',
    titleParts.length > 1 ? titleParts.slice(0, 2).join(' ') : '',
  ];
  const unique: string[] = [];
  for (const candidate of candidates) {
    const value = candidate.trim();
    if (value && !unique.includes(value)) unique.push(value);
  }
  return unique.length ? unique.slice(0, 7) : [cleanTitle];
}

function existingPaper(project: Project, paper: Paper): Paper | undefined {
  const title = paper.title.trim().toLowerCase();
  const doi = paper.doi?.trim().toLowerCase();
  return project.papers.find(
    (item) =>
      item.id === paper.id ||
      (Boolean(doi) && item.doi?.trim().toLowerCase() === doi) ||
      item.title.trim().toLowerCase() === title
  );
}

export function LiteratureSearch({ projectId, onClose }: Props) {
  const { projects, updateProject } = useApp();
  const project = projects.find((item) => item.id === projectId);

  const variants = useMemo(
    () => buildSearchVariants(project?.title ?? '', project?.keywords ?? ''),
    [project?.title, project?.keywords]
  );
  const [query, setQuery] = useState(() => variants[0] ?? '');
  const [results, setResults] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(0);
  const [page, setPage] = useState(1);
  const [manual, setManual] = useState(false);
  const didInit = useRef(false);

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
    if (didInit.current || !project) return;
    didInit.current = true;
    void runSearch(variants[0] ?? project.title, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, variants]);

  async function runSearch(text: string, targetPage: number) {
    const value = text.trim();
    if (!value) {
      setError('先输入关键词再搜索。');
      return;
    }
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const papers = await searchWorks(value, 10, {
        sort: 'relevance',
        page: targetPage,
      });
      setResults(papers);
      if (!papers.length) {
        setError('这一页没有结果，点「换一换」试试别的关键词或下一页。');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '文献服务暂时连不上，请稍后再试。'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setManual(true);
    setCursor(0);
    setPage(1);
    void runSearch(query, 1);
  }

  function handleShuffle() {
    // 手动输入的关键词由用户掌控，换一换只在这次搜索里翻页。
    if (manual) {
      if (page >= 8) {
        setManual(false);
        setCursor(0);
        const first = variants[0] ?? query;
        setQuery(first);
        setPage(1);
        void runSearch(first, 1);
        return;
      }
      const nextPage = page + 1;
      setPage(nextPage);
      void runSearch(query, nextPage);
      return;
    }
    const nextCursor = cursor + 1;
    const nextQuery = variants[nextCursor % variants.length] ?? query;
    const nextPage = Math.floor(nextCursor / Math.max(variants.length, 1)) + 1;
    setCursor(nextCursor);
    setQuery(nextQuery);
    setPage(nextPage);
    void runSearch(nextQuery, nextPage);
  }

  function handleAdd(paper: Paper) {
    if (!project) return;
    updateProject(project.id, (current) => {
      if (existingPaper(current, paper)) return current;
      return {
        ...current,
        papers: [...current.papers, { ...paper, selected: false, read: false }],
      };
    });
  }

  if (!project) {
    return createPortal(
      <div className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/35 p-5 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl bg-paper p-6 text-center shadow-lift">
          <h2 className="text-[18px] font-semibold">课题不存在</h2>
          <button type="button" onClick={onClose} className="btn btn-primary btn-sm mt-4">
            返回文献库
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[85] overflow-y-auto bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="在 OpenAlex 寻找新文献"
    >
      <header className="sticky top-0 z-20 border-b border-line/60 bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft transition hover:text-ink"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            返回文献库
          </button>
          <span className="min-w-0 truncate text-[11px] text-ink-faint">
            {project.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition hover:bg-ink/5 hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-6">
        <p className="eyebrow">Discover</p>
        <h1 className="mt-2 text-[27px] font-semibold leading-tight tracking-tight">
          寻找新文献
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
          根据这个课题的关键词与标题，在 OpenAlex 里按相关性找文献。找到合适的直接入库。
        </p>

        <form onSubmit={handleSearch} className="mt-5 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入关键词或标题"
            aria-label="搜索关键词"
            className="field"
          />
          <button type="submit" className="btn btn-primary shrink-0 px-4" disabled={loading}>
            <SearchIcon className="h-4 w-4" />
            搜索
          </button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShuffle}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            <RefreshIcon className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />
            换一换
          </button>
          <span className="text-[10.5px] text-ink-faint">
            第 {page} 页 · 相关性排序 · OpenAlex 对英文关键词更敏感
          </span>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
          {manual
            ? '「换一换」会在这次搜索里翻到下一页；想换方向就直接改关键词再搜。'
            : '「换一换」会在课题关键词 / 标题之间轮换，并自动翻页；不会使用 AI 生成新关键词。'}
        </p>
        {query && !/[a-z]/i.test(query) ? (
          <div className="mt-2 rounded-2xl border border-sun/40 bg-sun/10 px-3 py-2 text-[10.5px] leading-relaxed text-ink-soft">
            当前关键词里没有英文。OpenAlex 的索引以英文为主，中文检索会混进不相关的文献——建议改成英文术语，例如课题核心概念的英文写法。
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-accent/25 bg-accent-soft px-3.5 py-3 text-[12px] leading-relaxed text-accent-deep">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 space-y-3" aria-live="polite">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-3xl border border-line bg-surface/60"
              />
            ))}
          </div>
        ) : null}

        {!loading && results.length ? (
          <div className="mt-5 space-y-3">
            {results.map((paper) => {
              const existing = existingPaper(project, paper);
              return (
                <article key={paper.id} className="rounded-3xl border border-line bg-surface p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug text-ink">
                      {paper.title}
                    </h3>
                    {paper.url ? (
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label="打开原文"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition hover:border-ink-faint/60 hover:text-ink"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>

                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-ink-faint">
                    <span>{pluralAuthors(paper.authors)}</span>
                    <span>·</span>
                    <span>{paper.year ?? '年份未知'}</span>
                    {paper.journal ? (
                      <>
                        <span>·</span>
                        <span className="max-w-[15rem] truncate">{paper.journal}</span>
                      </>
                    ) : null}
                    {paper.citedByCount > 0 ? (
                      <>
                        <span>·</span>
                        <span>被引 {paper.citedByCount}</span>
                      </>
                    ) : null}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {existing ? (
                      <>
                        <span className="rounded-full bg-moss-soft px-2 py-0.5 text-[10px] text-moss-deep">
                          已入库
                        </span>
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent-deep">
                          {existing.read ? '已读' : '未读'}
                        </span>
                        {existing.irrelevant ? (
                          <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] text-ink-faint">
                            不相关
                          </span>
                        ) : null}
                        {existing.selected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[10px] text-accent-deep">
                            <StarIcon filled className="h-3 w-3 text-sun" />
                            核心
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] text-ink-faint">
                        未入库
                      </span>
                    )}
                  </div>

                  {paper.abstract ? (
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
                      {truncate(paper.abstract, 240)}
                    </p>
                  ) : null}

                  <div className="mt-3">
                    {existing ? (
                      <span className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-[11px] text-ink-faint">
                        已在当前课题文献库
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAdd(paper)}
                        className="inline-flex items-center rounded-full bg-ink px-3.5 py-1.5 text-[11px] font-medium text-paper transition hover:bg-ink/90"
                      >
                        加入文献库
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {!loading && !results.length && !error ? (
          <p className="mt-6 text-center text-[12px] text-ink-faint">
            还没有结果。改改关键词，或点「换一换」。
          </p>
        ) : null}
      </main>
    </div>,
    document.body
  );
}
