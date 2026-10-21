import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Paper, Project } from '../types';
import {
  CITATION_STYLES,
  buildReferenceList,
  type CitationStyle,
} from '../lib/citations';
import { copyText, cx, pluralAuthors } from '../lib/utils';
import { CheckIcon, CopyIcon, DownloadIcon, XIcon } from './Icons';

interface Entry {
  key: string;
  projectId: string;
  projectTitle: string;
  paper: Paper;
}

interface Props {
  projects: Project[];
  onClose: () => void;
}

export function ReferenceExport({ projects, onClose }: Props) {
  const entries = useMemo<Entry[]>(
    () =>
      projects.flatMap((project) =>
        project.papers.map((paper) => ({
          key: `${project.id}:${paper.id}`,
          projectId: project.id,
          projectTitle: project.title,
          paper,
        }))
      ),
    [projects]
  );

  const [style, setStyle] = useState<CitationStyle>('apa');
  const [selected, setSelected] = useState<Set<string>>(() => {
    const core = entries.filter((e) => e.paper.selected).map((e) => e.key);
    return new Set(core.length ? core : entries.map((e) => e.key));
  });
  const [copied, setCopied] = useState(false);

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

  const selectedPapers = useMemo(() => {
    const seen = new Set<string>();
    return entries
      .filter((entry) => selected.has(entry.key))
      .map((entry) => entry.paper)
      .filter((paper) => {
        const key = paper.doi
          ? `doi:${paper.doi.toLowerCase()}`
          : `title:${paper.title.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [entries, selected]);

  const styleInfo = CITATION_STYLES.find((s) => s.id === style) ?? CITATION_STYLES[0];
  const output = useMemo(
    () => buildReferenceList(selectedPapers, style),
    [selectedPapers, style]
  );

  const groups = useMemo(
    () =>
      projects
        .map((project) => ({
          project,
          entries: entries.filter((entry) => entry.projectId === project.id),
        }))
        .filter((group) => group.entries.length > 0),
    [projects, entries]
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setCopied(false);
  }

  function selectAll() {
    setSelected(new Set(entries.map((entry) => entry.key)));
    setCopied(false);
  }

  function clearAll() {
    setSelected(new Set());
    setCopied(false);
  }

  async function handleCopy() {
    if (!output) return;
    const ok = await copyText(output);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handleDownload() {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `references-${style}.${styleInfo.ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/35 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="导出参考文献"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-4xl bg-paper shadow-lift sm:rounded-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
          <div>
            <p className="eyebrow">References</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight">导出参考文献</h2>
            <p className="mt-1 text-[12px] text-ink-soft">
              勾选真正用到的文献，选一种格式，复制或下载。
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
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {CITATION_STYLES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setStyle(item.id);
                  setCopied(false);
                }}
                className={cx(
                  'chip',
                  style === item.id ? 'chip-active' : 'hover:border-ink-faint/60'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">{styleInfo.description}</p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-ink-faint">
              已选 {selected.size} / {entries.length} 篇
              <span className="ml-1.5 text-ink-faint/70">· 默认勾选核心文献，无核心时全选</span>
            </p>
            <div className="flex shrink-0 items-center gap-2 text-[11.5px]">
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

          <div className="mt-2 space-y-4">
            {groups.map(({ project, entries: projectEntries }) => (
              <section key={project.id}>
                <h3 className="mb-2 truncate text-[11.5px] font-medium text-ink-soft">
                  {project.title}
                </h3>
                <div className="space-y-2">
                  {projectEntries.map((entry) => {
                    const checked = selected.has(entry.key);
                    return (
                      <label
                        key={entry.key}
                        className={cx(
                          'flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition-colors',
                          checked
                            ? 'border-ink/40 bg-white'
                            : 'border-line bg-white/50 hover:border-ink-faint/50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(entry.key)}
                          className="sr-only"
                        />
                        <span
                          className={cx(
                            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                            checked
                              ? 'border-ink bg-ink text-paper'
                              : 'border-line bg-white text-transparent'
                          )}
                        >
                          <CheckIcon className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium leading-snug text-ink">
                            {entry.paper.title}
                          </span>
                          <span className="mt-0.5 block text-[10.5px] leading-relaxed text-ink-faint">
                            {pluralAuthors(entry.paper.authors)} · {entry.paper.year ?? '年份未知'}
                            {entry.paper.selected ? ' · 核心' : ''}
                            {entry.paper.journal ? ` · ${entry.paper.journal}` : ''}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">预览</span>
              <span className="text-[10.5px] text-ink-faint">{styleInfo.label}</span>
            </div>
            <textarea
              readOnly
              value={output || '还没有勾选文献。'}
              rows={10}
              aria-label="参考文献预览"
              className={cx(
                'w-full resize-y rounded-2xl border border-line bg-white p-3.5 text-[11.5px] leading-relaxed text-ink-soft outline-none',
                styleInfo.monospace ? 'font-mono' : ''
              )}
            />
          </div>

          <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
            格式由文献元数据自动生成，作者缩写和标点是启发式处理。投稿前请按目标期刊或学校要求核对一遍。
          </p>
        </div>

        <footer className="flex items-center gap-2.5 border-t border-line/70 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={!output}
            className="btn btn-secondary btn-sm flex-1"
          >
            <CopyIcon className="h-3.5 w-3.5" />
            {copied ? '已复制' : '复制'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!output}
            className="btn btn-primary btn-sm flex-1"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            下载 .{styleInfo.ext}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
