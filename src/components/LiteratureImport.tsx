import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Paper, Project } from '../types';
import { createManualPaper } from '../lib/openalex';
import { parseBibliography } from '../lib/importers';
import { cx, pluralAuthors } from '../lib/utils';
import { useApp } from '../store/AppContext';
import { CheckIcon, UploadIcon, XIcon } from './Icons';

type Mode = 'manual' | 'file' | 'done';

interface Props {
  onClose: () => void;
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

function isDuplicate(paper: Paper, project: Project): boolean {
  const title = paper.title.trim().toLowerCase();
  const doi = paper.doi?.trim().toLowerCase();
  return project.papers.some(
    (existing) =>
      existing.id === paper.id ||
      (Boolean(doi) && existing.doi?.trim().toLowerCase() === doi) ||
      existing.title.trim().toLowerCase() === title
  );
}

export function LiteratureImport({ onClose }: Props) {
  const { projects, activeProjectId, updateProject } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [projectId, setProjectId] = useState(
    activeProjectId && projects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : projects[0]?.id ?? ''
  );
  const [mode, setMode] = useState<Mode>('manual');
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<Paper[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

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
              手动录入，或导入本地 BibTeX / RIS 文件。
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
                  'flex-1 rounded-xl px-3 py-2 text-[12.5px] transition',
                  mode === 'file'
                    ? 'bg-surface font-medium text-ink shadow-card'
                    : 'text-ink-faint hover:text-ink-soft'
                )}
              >
                导入文件
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
                暂不支持直接解析 PDF。可以先导入 .bib / .ris，或把 PDF 正文粘贴到阅读器的「全文」里。
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
                } else {
                  handleFileImport();
                }
              }}
              disabled={
                mode === 'manual'
                  ? !manual.title.trim()
                  : !selectedCount
              }
              className="btn btn-primary btn-sm flex-1"
            >
              {mode === 'manual' ? '添加到文献库' : `导入 ${selectedCount} 篇`}
            </button>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
