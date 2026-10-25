import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Paper, Project } from '../types';
import { createManualPaper, lookupPaperByDoi, lookupPaperByTitle } from '../lib/openalex';
import { parseBibliography } from '../lib/importers';
import { MAX_PDF_BYTES, extractPdfText, type ExtractedPdf } from '../lib/pdf';
import { cx, normalizeDoi, pluralAuthors, uid } from '../lib/utils';
import { useApp } from '../store/AppContext';
import { CheckIcon, UploadIcon, XIcon } from './Icons';

export type ImportMode = 'manual' | 'file' | 'pdf';
type Mode = ImportMode | 'done';

interface Props {
  onClose: () => void;
  initialMode?: ImportMode;
  onImported?: (projectId: string, paper: Paper) => void;
}

const EMPTY_MANUAL = {
  title: '',
  authors: '',
  year: '',
  journal: '',
  doi: '',
  abstract: '',
  url: '',
};

function findDuplicate(paper: Paper, project: Project): Paper | undefined {
  const title = paper.title.trim().toLowerCase();
  const doi = paper.doi?.trim().toLowerCase();
  return project.papers.find(
    (existing) =>
      existing.id === paper.id ||
      (Boolean(doi) && existing.doi?.trim().toLowerCase() === doi) ||
      existing.title.trim().toLowerCase() === title
  );
}

function isDuplicate(paper: Paper, project: Project): boolean {
  return Boolean(findDuplicate(paper, project));
}

export function LiteratureImport({ onClose, initialMode = 'manual', onImported }: Props) {
  const { projects, activeProjectId, updateProject } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [projectId, setProjectId] = useState(
    activeProjectId && projects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : projects[0]?.id ?? ''
  );
  const [mode, setMode] = useState<Mode>(initialMode);
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<Paper[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [pdfName, setPdfName] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ page: 0, total: 0 });
  const [pdfResult, setPdfResult] = useState<ExtractedPdf | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfAuthors, setPdfAuthors] = useState('');
  const [pdfYear, setPdfYear] = useState('');
  const [pdfJournal, setPdfJournal] = useState('');
  const [pdfDoi, setPdfDoi] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfAbstract, setPdfAbstract] = useState('');
  const [pdfCitedByCount, setPdfCitedByCount] = useState(0);
  const [pdfLookupLoading, setPdfLookupLoading] = useState(false);
  const [pdfLookupNote, setPdfLookupNote] = useState('');

  const targetProject = projects.find((project) => project.id === projectId) ?? projects[0];

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

  const newPapers = targetProject
    ? parsed.filter((paper) => !isDuplicate(paper, targetProject))
    : parsed;
  const selectableCount = newPapers.length;
  const selectedCount = parsed.filter(
    (paper) => selectedIds.has(paper.id) && newPapers.some((item) => item.id === paper.id)
  ).length;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (file.size > 1024 * 1024) {
      setError('文件不能超过 1 MB。');
      return;
    }
    try {
      const text = await file.text();
      const papers = parseBibliography(text);
      if (!papers.length) {
        setError('没有解析到文献。请确认文件里有 BibTeX 或 RIS 条目。');
        return;
      }
      setFileName(file.name);
      setParsed(papers);
      setSelectedIds(
        new Set(
          targetProject
            ? papers.filter((paper) => !isDuplicate(paper, targetProject)).map((p) => p.id)
            : papers.map((p) => p.id)
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件解析失败。');
    }
  }

  async function handlePdfFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setPdfResult(null);
    setPdfName(file.name);
    setPdfLookupNote('');
    setPdfLookupLoading(false);
    setPdfJournal('');
    setPdfDoi('');
    setPdfUrl('');
    setPdfAbstract('');
    setPdfCitedByCount(0);
    if (file.size > MAX_PDF_BYTES) {
      setError('PDF 不能超过 50 MB。');
      return;
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('请选择 PDF 文件。');
      return;
    }

    setPdfLoading(true);
    setPdfProgress({ page: 0, total: 0 });
    try {
      const result = await extractPdfText(file, (progress) => setPdfProgress(progress));
      setPdfLoading(false);
      setPdfResult(result);
      setPdfTitle(result.title);
      setPdfAuthors(result.authors.join(', '));
      setPdfYear(result.year ? String(result.year) : '');
      setPdfDoi(result.doi ?? '');
      setPdfUrl(result.doi ? `https://doi.org/${result.doi}` : '');

      if (!result.charCount) {
        setError(
          '这个 PDF 没有提取到文字，可能是扫描件或图片型 PDF。可以先用 OCR 工具生成可搜索 PDF，再把文字导入。'
        );
        return;
      }

      // 用标题去 OpenAlex 找同一条记录；只发送标题 / 作者 / 年份，不发送 PDF 正文。
      setPdfLookupLoading(true);
      try {
        const timeout = Symbol('openalex-timeout');
        const lookup = async () => {
          if (result.doi) {
            try {
              const byDoi = await lookupPaperByDoi(result.doi);
              if (byDoi) return byDoi;
            } catch {
              // DOI 查询失败时继续用标题兜底
            }
          }
          return lookupPaperByTitle(result.title, result.authors, result.year);
        };
        const match = await Promise.race([
          lookup(),
          new Promise<typeof timeout>((resolve) =>
            window.setTimeout(() => resolve(timeout), 8000)
          ),
        ]);
        if (match === timeout) {
          setPdfLookupNote('OpenAlex 匹配超时，可手动补充；不影响导入。');
        } else if (match) {
          setPdfTitle(match.title || result.title);
          setPdfAuthors(
            match.authors.length ? match.authors.join(', ') : result.authors.join(', ')
          );
          setPdfYear(
            match.year ? String(match.year) : result.year ? String(result.year) : ''
          );
          setPdfJournal(match.journal ?? '');
          setPdfDoi(match.doi ?? result.doi ?? '');
          setPdfUrl(
            match.url || (match.doi ? `https://doi.org/${match.doi}` : '')
          );
          setPdfAbstract(match.abstract ?? '');
          setPdfCitedByCount(match.citedByCount || 0);
          setPdfLookupNote(
            `已从 OpenAlex 匹配：被引 ${match.citedByCount}${
              match.journal ? ` · ${match.journal}` : ''
            }`
          );
        } else {
          setPdfLookupNote('OpenAlex 没有匹配到，可手动补充期刊 / DOI；不影响导入。');
        }
      } catch {
        setPdfLookupNote('OpenAlex 暂时不可用，可手动补充；不影响导入。');
      } finally {
        setPdfLookupLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 解析失败，请换一个文件重试。');
    } finally {
      setPdfLoading(false);
    }
  }

  function handlePdfImport() {
    if (!targetProject || !pdfResult) return;
    const title = pdfTitle.trim();
    if (!title) {
      setError('标题不能为空。');
      return;
    }
    if (!pdfResult.charCount) {
      setError('这个 PDF 没有提取到文字，暂时无法导入。');
      return;
    }

    const authors = pdfAuthors
      .split(/[;,、\n]/)
      .map((name) => name.trim())
      .filter(Boolean);
    const parsedYear = Number(pdfYear);
    const normalizedDoi = normalizeDoi(pdfDoi);
    const doi = /^10\.\d{4,9}\//.test(normalizedDoi) ? normalizedDoi : undefined;
    const paper: Paper = {
      id: uid('paper-'),
      title,
      abstract: pdfAbstract.trim(),
      authors,
      year: Number.isFinite(parsedYear) && parsedYear > 0 ? Math.round(parsedYear) : null,
      url: doi ? `https://doi.org/${doi}` : pdfUrl.trim(),
      citedByCount: pdfCitedByCount,
      journal: pdfJournal.trim() || undefined,
      doi,
      manual: true,
      pdfPages: pdfResult.pages,
      pdfFileName: pdfName || `${title}.pdf`,
      pdfPageCount: pdfResult.pageCount,
      pdfTruncated: pdfResult.truncated || undefined,
    };

    if (isDuplicate(paper, targetProject)) {
      const existing = findDuplicate(paper, targetProject);
      if (existing) {
        // 同名 / 同 DOI 的文献已经存在：直接把 PDF 文字补到这篇上，不新建重复条目。
        const merged: Paper = {
          ...existing,
          authors: existing.authors.length ? existing.authors : paper.authors,
          year: existing.year ?? paper.year,
          abstract: existing.abstract || paper.abstract,
          journal: existing.journal ?? paper.journal,
          doi: existing.doi ?? paper.doi,
          url: existing.url || paper.url,
          citedByCount: existing.citedByCount || paper.citedByCount,
          pdfPages: paper.pdfPages,
          pdfFileName: paper.pdfFileName,
          pdfPageCount: paper.pdfPageCount,
          pdfTruncated: paper.pdfTruncated,
          pdfLastPage: undefined,
        };
        updateProject(targetProject.id, (project) => ({
          ...project,
          papers: project.papers.map((item) =>
            item.id === existing.id ? merged : item
          ),
        }));
        setImportedCount(1);
        setSkippedCount(0);
        setMode('done');
        onImported?.(targetProject.id, merged);
        return;
      }
      setError('这篇文献已经在当前课题的文献库里了。');
      return;
    }

    updateProject(targetProject.id, (project) => ({
      ...project,
      papers: [...project.papers, paper],
    }));
    setImportedCount(1);
    setSkippedCount(0);
    setMode('done');
    onImported?.(targetProject.id, paper);
  }

  function togglePaper(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(newPapers.map((paper) => paper.id)));
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  function handleManualSubmit(event: FormEvent) {
    event.preventDefault();
    if (!targetProject) return;
    const paper = createManualPaper(manual);
    if (!paper.title.trim()) {
      setError('标题不能为空。');
      return;
    }
    if (isDuplicate(paper, targetProject)) {
      setError('这篇文献已经在当前课题的文献库里了。');
      return;
    }
    updateProject(targetProject.id, (project) => ({
      ...project,
      papers: [...project.papers, paper],
    }));
    setImportedCount(1);
    setSkippedCount(0);
    setMode('done');
  }

  function handleFileImport() {
    if (!targetProject) return;
    const toImport = parsed.filter(
      (paper) => selectedIds.has(paper.id) && !isDuplicate(paper, targetProject)
    );
    if (!toImport.length) {
      setError('没有勾选任何可导入的新文献。');
      return;
    }
    const duplicates = parsed.filter((paper) => isDuplicate(paper, targetProject)).length;
    updateProject(targetProject.id, (project) => {
      const fresh = toImport.filter((paper) => !isDuplicate(paper, project));
      return { ...project, papers: [...project.papers, ...fresh] };
    });
    setImportedCount(toImport.length);
    setSkippedCount(duplicates);
    setMode('done');
  }

  function resetForMore() {
    setMode('manual');
    setParsed([]);
    setFileName('');
    setSelectedIds(new Set());
    setError('');
    setImportedCount(0);
    setSkippedCount(0);
    setManual(EMPTY_MANUAL);
    setPdfName('');
    setPdfResult(null);
    setPdfTitle('');
    setPdfAuthors('');
    setPdfYear('');
    setPdfJournal('');
    setPdfDoi('');
    setPdfUrl('');
    setPdfAbstract('');
    setPdfCitedByCount(0);
    setPdfLookupLoading(false);
    setPdfLookupNote('');
    setPdfProgress({ page: 0, total: 0 });
  }

  if (!targetProject) {
    return createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/35 p-5 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl bg-paper p-6 text-center shadow-lift">
          <h2 className="text-[18px] font-semibold">还没有课题</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            文献需要归到一个课题里。请先去创建一个课题，再回来导入。
          </p>
          <button type="button" onClick={onClose} className="btn btn-primary btn-sm mt-4">
            知道了
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/35 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="添加文献"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-4xl bg-paper shadow-lift sm:rounded-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
          <div>
            <p className="eyebrow">Library</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight">添加文献</h2>
            <p className="mt-1 text-[12px] text-ink-soft">
              手动录入，导入 BibTeX / RIS，或上传 PDF 提取文字后在站内阅读。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-ink/5 hover:text-ink"
          >
            <XIcon className="h-[18px] w-[18px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="import-project" className="text-[11.5px] text-ink-faint">
              导入到课题
            </label>
            {projects.length > 1 ? (
              <select
                id="import-project"
                value={targetProject.id}
                onChange={(event) => setProjectId(event.target.value)}
                className="max-w-[70%] rounded-xl border border-line bg-surface px-3 py-1.5 text-[12px] text-ink outline-none"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="truncate text-[12px] text-ink-soft">{targetProject.title}</span>
            )}
          </div>

          {mode !== 'done' ? (
            <div className="mt-4 flex gap-2 rounded-2xl bg-paper/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('manual');
                  setError('');
                }}
                className={cx(
                  'flex-1 rounded-xl px-3 py-2 text-[12.5px] transition',
                  mode === 'manual'
                    ? 'bg-surface font-medium text-ink shadow-card'
                    : 'text-ink-faint hover:text-ink-soft'
                )}
              >
                手动录入
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('file');
                  setError('');
                }}
                className={cx(
                  'flex-1 rounded-xl px-2 py-2 text-[12px] transition',
                  mode === 'file'
                    ? 'bg-surface font-medium text-ink shadow-card'
                    : 'text-ink-faint hover:text-ink-soft'
                )}
              >
                BibTeX / RIS
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('pdf');
                  setError('');
                }}
                className={cx(
                  'flex-1 rounded-xl px-2 py-2 text-[12px] transition',
                  mode === 'pdf'
                    ? 'bg-surface font-medium text-ink shadow-card'
                    : 'text-ink-faint hover:text-ink-soft'
                )}
              >
                PDF 文件
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-2xl border border-accent/25 bg-accent-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-accent-deep">
              {error}
            </div>
          ) : null}

          {mode === 'manual' ? (
            <form ref={formRef} onSubmit={handleManualSubmit} className="mt-4 space-y-3">
              <input
                required
                value={manual.title}
                onChange={(event) =>
                  setManual((previous) => ({ ...previous, title: event.target.value }))
                }
                placeholder="文献标题（必填）"
                className="field field-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={manual.authors}
                  onChange={(event) =>
                    setManual((previous) => ({ ...previous, authors: event.target.value }))
                  }
                  placeholder="作者，用逗号分隔"
                  className="field field-sm"
                />
                <input
                  value={manual.year}
                  onChange={(event) =>
                    setManual((previous) => ({ ...previous, year: event.target.value }))
                  }
                  placeholder="年份"
                  inputMode="numeric"
                  className="field field-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={manual.journal}
                  onChange={(event) =>
                    setManual((previous) => ({ ...previous, journal: event.target.value }))
                  }
                  placeholder="期刊 / 来源（可选）"
                  className="field field-sm"
                />
                <input
                  value={manual.doi}
                  onChange={(event) =>
                    setManual((previous) => ({ ...previous, doi: event.target.value }))
                  }
                  placeholder="DOI（可选）"
                  className="field field-sm"
                />
              </div>
              <textarea
                value={manual.abstract}
                onChange={(event) =>
                  setManual((previous) => ({ ...previous, abstract: event.target.value }))
                }
                placeholder="摘要（可选）"
                rows={3}
                className="field field-sm resize-y"
              />
              <input
                value={manual.url}
                onChange={(event) =>
                  setManual((previous) => ({ ...previous, url: event.target.value }))
                }
                placeholder="原文链接（可选）"
                className="field field-sm"
              />
            </form>
          ) : null}

          {mode === 'file' ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line bg-surface/50 px-5 py-8 text-center transition hover:border-ink-faint hover:bg-surface"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-deep">
                  <UploadIcon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-medium text-ink">
                  {fileName || '选择 BibTeX / RIS 文件'}
                </span>
                <span className="text-[10.5px] text-ink-faint">
                  支持 .bib / .ris / .txt，最大 1 MB
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".bib,.ris,.txt,text/plain"
                className="sr-only"
                onChange={(event) => void handleFile(event)}
              />

              {parsed.length ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11.5px] text-ink-faint">
                      解析到 {parsed.length} 篇，可导入 {selectableCount} 篇
                    </p>
                    <div className="flex items-center gap-2 text-[11.5px]">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-ink-soft transition hover:text-ink"
                      >
                        全选
                      </button>
                      <span className="text-line">|</span>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-ink-soft transition hover:text-ink"
                      >
                        清空
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {parsed.map((paper) => {
                      const duplicate = isDuplicate(paper, targetProject);
                      const checked = selectedIds.has(paper.id) && !duplicate;
                      return (
                        <label
                          key={paper.id}
                          className={cx(
                            'flex items-start gap-3 rounded-2xl border px-3.5 py-3 transition-colors',
                            duplicate
                              ? 'border-line/60 bg-paper/40 opacity-60'
                              : checked
                                ? 'border-ink/40 bg-surface'
                                : 'border-line bg-surface/50 hover:border-ink-faint/50'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={duplicate}
                            onChange={() => togglePaper(paper.id)}
                            className="sr-only"
                          />
                          <span
                            className={cx(
                              'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                              checked
                                ? 'border-ink bg-ink text-paper'
                                : 'border-line bg-surface text-transparent'
                            )}
                          >
                            <CheckIcon className="h-3 w-3" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium leading-snug text-ink">
                              {paper.title}
                            </span>
                            <span className="mt-0.5 block text-[10.5px] leading-relaxed text-ink-faint">
                              {pluralAuthors(paper.authors)} · {paper.year ?? '年份未知'}
                              {paper.journal ? ` · ${paper.journal}` : ''}
                              {duplicate ? ' · 已在库中' : ''}
                            </span>
                            {paper.doi ? (
                              <span className="mt-0.5 block text-[10px] text-ink-faint/80">
                                DOI {paper.doi}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
                也可以切到「PDF 文件」，直接导入文字型 PDF，自动提取正文。
              </p>
            </div>
          ) : null}

          {mode === 'pdf' ? (
            <div className="mt-4">
              <button
                type="button"
                disabled={pdfLoading}
                onClick={() => pdfRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line bg-surface/50 px-5 py-8 text-center transition hover:border-ink-faint hover:bg-surface disabled:pointer-events-none disabled:opacity-60"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-deep">
                  <UploadIcon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-medium text-ink">
                  {pdfName || '选择 PDF 文件'}
                </span>
                <span className="text-[10.5px] text-ink-faint">
                  文字型 PDF，最大 50 MB · 在本机提取，不上传
                </span>
              </button>
              <input
                ref={pdfRef}
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={(event) => void handlePdfFile(event)}
              />

              {pdfLoading ? (
                <div className="mt-4 rounded-2xl border border-line bg-surface px-4 py-4">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-medium text-ink">正在提取文字…</span>
                    <span className="text-[10.5px] text-ink-faint">
                      {pdfProgress.total
                        ? `${pdfProgress.page} / ${pdfProgress.total} 页`
                        : '正在解析 PDF'}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line/80">
                    <div
                      className="h-full rounded-full bg-ink transition-all duration-300"
                      style={{
                        width: pdfProgress.total
                          ? `${Math.round((pdfProgress.page / pdfProgress.total) * 100)}%`
                          : '12%',
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[10.5px] text-ink-faint">
                    页数多时可能需要十几秒，期间可以继续切到其他页面。
                  </p>
                </div>
              ) : null}

              {pdfResult ? (
                <div className="mt-4 rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-ink">
                      已提取 {pdfResult.pages.length} / {pdfResult.pageCount} 页 ·{' '}
                      {pdfResult.charCount.toLocaleString()} 字
                    </p>
                    {pdfResult.truncated ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[9.5px] text-accent-deep">
                        已按 30 万字符上限截断
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2.5">
                    <input
                      value={pdfTitle}
                      onChange={(event) => setPdfTitle(event.target.value)}
                      placeholder="文献标题"
                      className="field field-sm"
                    />
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <input
                        value={pdfAuthors}
                        onChange={(event) => setPdfAuthors(event.target.value)}
                        placeholder="作者，用逗号分隔（可选）"
                        className="field field-sm"
                      />
                      <input
                        value={pdfYear}
                        onChange={(event) => setPdfYear(event.target.value)}
                        placeholder="年份（可选）"
                        inputMode="numeric"
                        className="field field-sm"
                      />
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <input
                        value={pdfJournal}
                        onChange={(event) => setPdfJournal(event.target.value)}
                        placeholder="期刊 / 来源（可选）"
                        className="field field-sm"
                      />
                      <input
                        value={pdfDoi}
                        onChange={(event) => setPdfDoi(event.target.value)}
                        placeholder="DOI（可选）"
                        className="field field-sm"
                      />
                    </div>
                  </div>

                  {pdfLookupLoading ? (
                    <p className="mt-3 flex items-center gap-2 rounded-xl bg-paper/70 px-3 py-2 text-[10.5px] text-ink-faint">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-faint/30 border-t-ink" />
                      正在 OpenAlex 匹配被引 / 期刊 / DOI…
                    </p>
                  ) : pdfLookupNote ? (
                    <p className="mt-3 rounded-xl bg-paper/70 px-3 py-2 text-[10.5px] leading-relaxed text-ink-faint">
                      {pdfLookupNote}
                    </p>
                  ) : null}

                  {pdfResult.pages[0] ? (
                    <details className="mt-3 rounded-xl bg-paper/70 px-3 py-2">
                      <summary className="cursor-pointer text-[11px] text-ink-soft">
                        预览第一页
                      </summary>
                      <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-soft">
                        {pdfResult.pages[0].slice(0, 1200)}
                      </p>
                    </details>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => pdfRef.current?.click()}
                    className="mt-3 text-[11px] text-ink-faint underline decoration-line underline-offset-4 transition hover:text-ink-soft"
                  >
                    重新选择 PDF
                  </button>
                </div>
              ) : null}

              <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
                只在本机提取并保存文字，不保存原始 PDF。自动用标题到 OpenAlex 匹配被引 / 期刊 / DOI（只发送标题，不发送正文）；匹配不到可手动补充。单篇最多 30 万字符；扫描件 / 图片型 PDF 需要先做 OCR。
              </p>
            </div>
          ) : null}

          {mode === 'done' ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-moss-soft text-moss-deep">
                <CheckIcon className="h-6 w-6" />
              </span>
              <h3 className="mt-3 text-[17px] font-semibold">已导入 {importedCount} 篇</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
                已归入「{targetProject.title}」。
                {skippedCount ? `跳过 ${skippedCount} 篇重复文献。` : ''}
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={resetForMore} className="btn btn-secondary btn-sm">
                  再导入一批
                </button>
                <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
                  完成
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {mode !== 'done' ? (
          <footer className="flex items-center gap-2.5 border-t border-line/70 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm flex-1">
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === 'manual') {
                  formRef.current?.requestSubmit();
                } else if (mode === 'file') {
                  handleFileImport();
                } else {
                  handlePdfImport();
                }
              }}
              disabled={
                mode === 'manual'
                  ? !manual.title.trim()
                  : mode === 'pdf'
                    ? pdfLoading || pdfLookupLoading || !pdfResult || !pdfTitle.trim() || !pdfResult.charCount
                    : !selectedCount
              }
              className="btn btn-primary btn-sm flex-1"
            >
              {mode === 'manual'
                ? '添加到文献库'
                : mode === 'pdf'
                  ? pdfLoading
                    ? '正在提取…'
                    : pdfLookupLoading
                      ? '正在匹配元数据…'
                      : pdfResult
                        ? onImported
                          ? '导入并阅读'
                          : '导入 PDF'
                        : '先选择 PDF'
                  : `导入 ${selectedCount} 篇`}
            </button>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
