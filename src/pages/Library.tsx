import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { LibraryPaperCard } from '../components/LibraryPaperCard';
import { LiteratureImport, type ImportMode } from '../components/LiteratureImport';
import { LiteratureSearch } from '../components/LiteratureSearch';
import { PaperReader } from '../components/PaperReader';
import { ReferenceExport } from '../components/ReferenceExport';
import {
  BookIcon,
  ChevronRightIcon,
  DownloadIcon,
  FolderIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from '../components/Icons';
import type { Paper, Project } from '../types';
import { chatComplete } from '../lib/llm';
import { cx } from '../lib/utils';
import { useApp } from '../store/AppContext';

type LibraryFilter = 'all' | 'unread' | 'read' | 'irrelevant';

const FILTERS: Array<{ id: LibraryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'unread', label: '未读' },
  { id: 'read', label: '已读' },
  { id: 'irrelevant', label: '不相关' },
];

function matchFilter(paper: Paper, filter: LibraryFilter): boolean {
  if (filter === 'unread') return !paper.read;
  if (filter === 'read') return Boolean(paper.read);
  if (filter === 'irrelevant') return Boolean(paper.irrelevant);
  return true;
}

export function Library() {
  const { projects, settings, updatePaper, updateProject } = useApp();
  const [readerIds, setReaderIds] = useState<{ projectId: string; paperId: string } | null>(
    null
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('manual');
  const [searchProjectId, setSearchProjectId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<{
    projectId: string;
    paper: Paper;
    index: number;
  } | null>(null);
  const undoTimer = useRef<number | null>(null);
  const [interpreting, setInterpreting] = useState<Record<string, boolean>>({});
  const [interpretErrors, setInterpretErrors] = useState<Record<string, string>>({});

  const total = projects.reduce((sum, project) => sum + project.papers.length, 0);
  const allPapers = projects.flatMap((project) => project.papers);
  const counts: Record<LibraryFilter, number> = {
    all: total,
    unread: allPapers.filter((paper) => !paper.read).length,
    read: allPapers.filter((paper) => paper.read).length,
    irrelevant: allPapers.filter((paper) => paper.irrelevant).length,
  };

  const readerProject = readerIds
    ? projects.find((project) => project.id === readerIds.projectId)
    : undefined;
  const readerPaper = readerProject?.papers.find((paper) => paper.id === readerIds?.paperId);
  const readerStrictMode = (readerProject?.aiMode ?? settings.aiMode) === 'tasks-only';
  const searchProject = searchProjectId
    ? projects.find((project) => project.id === searchProjectId)
    : undefined;

  useEffect(() => {
    return () => {
      if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    };
  }, []);

  function projectStrict(project: Project): boolean {
    return (project.aiMode ?? settings.aiMode) === 'tasks-only';
  }

  function filteredPapers(project: Project): Paper[] {
    return project.papers.filter((paper) => matchFilter(paper, filter));
  }

  function toggleFolder(projectId: string) {
    setCollapsedFolders((previous) => {
      const next = new Set(previous);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function openReader(project: Project, paper: Paper) {
    if (!paper.read) {
      updatePaper(project.id, paper.id, {
        read: true,
        readAt: new Date().toISOString(),
      });
    }
    setReaderIds({ projectId: project.id, paperId: paper.id });
  }

  function addPaperToProject(projectId: string, paper: Paper): boolean {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return false;
    const title = paper.title.trim().toLowerCase();
    const duplicate = project.papers.some(
      (existing) =>
        existing.id === paper.id ||
        (Boolean(paper.doi) &&
          Boolean(existing.doi) &&
          existing.doi?.toLowerCase() === paper.doi?.toLowerCase()) ||
        existing.title.trim().toLowerCase() === title
    );
    if (duplicate) return false;
    updateProject(projectId, (current) => ({
      ...current,
      papers: [...current.papers, paper],
    }));
    return true;
  }

  function handleDelete(project: Project, paper: Paper) {
    const index = project.papers.findIndex((item) => item.id === paper.id);
    if (index < 0) return;
    updateProject(project.id, (current) => ({
      ...current,
      papers: current.papers.filter((item) => item.id !== paper.id),
    }));
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    setDeleted({ projectId: project.id, paper, index });
    undoTimer.current = window.setTimeout(() => setDeleted(null), 6000);
  }

  function handleUndoDelete() {
    if (!deleted) return;
    if (undoTimer.current !== null) window.clearTimeout(undoTimer.current);
    updateProject(deleted.projectId, (project) => {
      if (project.papers.some((paper) => paper.id === deleted.paper.id)) return project;
      const papers = [...project.papers];
      papers.splice(Math.min(deleted.index, papers.length), 0, deleted.paper);
      return { ...project, papers };
    });
    setDeleted(null);
  }

  async function generateInterpretation(project: Project, paper: Paper) {
    if (projectStrict(project)) return;
    const key = `${project.id}:${paper.id}`;
    if (!settings.apiKey.trim()) {
      setInterpretErrors((previous) => ({
        ...previous,
        [key]: '还没有配置 API Key。先到设置里填写，再回来解读。',
      }));
      return;
    }

    setInterpreting((previous) => ({ ...previous, [key]: true }));
    setInterpretErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });

    try {
      const directions = project.directions
        .filter((direction) => direction.selected)
        .map((direction) => direction.title)
        .slice(0, 3)
        .join('、');
      const reply = await chatComplete(
        settings,
        [
          {
            role: 'system',
            content:
              '你是一位严谨、具体的学术阅读助手。只输出恰好三句中文，不要编号，不要项目符号，不要额外解释。',
          },
          {
            role: 'user',
            content: [
              `课题：${project.title}`,
              `阶段：${project.stage}`,
              directions ? `已选方向：${directions}` : '',
              `文献标题：${paper.title}`,
              `作者：${paper.authors.join('、') || '未知'}`,
              `年份：${paper.year ?? '未知'}`,
              `摘要：${(paper.abstract || '（没有公开摘要，请仅基于标题谨慎解读）').slice(0, 3000)}`,
              '',
              '请写三句话：1) 这篇文献研究什么问题；2) 用了什么方法或路径；3) 与我的课题有什么关系。',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        { temperature: 0.3, maxTokens: 320 }
      );
      updatePaper(project.id, paper.id, { interpretation: reply.trim() });
    } catch (err) {
      setInterpretErrors((previous) => ({
        ...previous,
        [key]: err instanceof Error ? err.message : '解读失败，请重试。',
      }));
    } finally {
      setInterpreting((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
    }
  }

  return (
    <div className="animate-rise">
      <p className="eyebrow">Library</p>
      <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight">
        文献库
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
        {total
          ? `${projects.length} 个课题 · ${total} 篇文献，笔记会自动保存。`
          : projects.length
            ? '从下方课题文件夹里，开始收集每个课题的文献。'
            : '读过的，值得留下来。'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {projects.length ? (
          <button
            type="button"
            onClick={() => {
              setImportMode('manual');
              setImportOpen(true);
            }}
            className="btn btn-primary btn-sm"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            添加文献
          </button>
        ) : null}
        {projects.length ? (
          <button
            type="button"
            onClick={() => {
              setImportMode('pdf');
              setImportOpen(true);
            }}
            className="btn btn-secondary btn-sm"
          >
            <UploadIcon className="h-3.5 w-3.5" />
            导入 PDF
          </button>
        ) : null}
        {total ? (
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="btn btn-secondary btn-sm"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            导出引用
          </button>
        ) : null}
      </div>

      {total ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cx('chip', filter === item.id && 'chip-active')}
            >
              {item.label}
              <span
                className={cx(
                  'font-display text-[10px]',
                  filter === item.id ? 'text-paper/60' : 'text-ink-faint'
                )}
              >
                {counts[item.id]}
              </span>
            </button>
          ))}
          {filter !== 'all' ? (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-[11px] text-ink-faint underline decoration-line underline-offset-4 transition hover:text-ink-soft"
            >
              清除筛选
            </button>
          ) : null}
        </div>
      ) : null}

      {projects.length ? (
        <div className="mt-5 space-y-4">
          {projects.map((project) => {
            const visible = filteredPapers(project);
            const open = !collapsedFolders.has(project.id);
            const strict = projectStrict(project);
            return (
              <section
                key={project.id}
                className="rounded-3xl border border-line bg-paper/40 p-2.5"
              >
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleFolder(project.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronRightIcon
                      className={cx(
                        'h-4 w-4 shrink-0 text-ink-faint transition-transform',
                        open && 'rotate-90'
                      )}
                    />
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-deep">
                      <FolderIcon className="h-4 w-4" />
                    </span>
                    <span className="line-clamp-2 min-w-0 text-[13px] font-semibold leading-snug text-ink">
                      {project.title}
                    </span>
                    <span className="shrink-0 text-[10.5px] text-ink-faint">
                      {filter === 'all'
                        ? `${project.papers.length} 篇`
                        : `${visible.length} / ${project.papers.length} 篇`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchProjectId(project.id)}
                    aria-label="在 OpenAlex 找新文献"
                    title="在 OpenAlex 找新文献"
                    className="btn btn-secondary btn-sm shrink-0 px-2.5 sm:px-3"
                  >
                    <SearchIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">找新文献</span>
                  </button>
                </div>

                {open ? (
                  <div className="mt-2.5 space-y-3 px-0.5 pb-1">
                    {visible.length ? (
                      visible.map((paper) => {
                        const key = `${project.id}:${paper.id}`;
                        return (
                          <LibraryPaperCard
                            key={paper.id}
                            paper={paper}
                            strictMode={strict}
                            interpreting={Boolean(interpreting[key])}
                            interpretationError={interpretErrors[key]}
                            onOpen={() => openReader(project, paper)}
                            onChangeNote={(note) =>
                              updatePaper(project.id, paper.id, { note })
                            }
                            onDelete={() => handleDelete(project, paper)}
                            onToggleStar={() =>
                              updatePaper(project.id, paper.id, {
                                selected: !paper.selected,
                              })
                            }
                            onToggleIrrelevant={() =>
                              updatePaper(project.id, paper.id, {
                                irrelevant: !paper.irrelevant,
                              })
                            }
                            onGenerateInterpretation={() =>
                              void generateInterpretation(project, paper)
                            }
                          />
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-line bg-surface/40 px-4 py-6 text-center">
                        <p className="text-[12px] text-ink-soft">
                          {project.papers.length
                            ? '没有符合当前筛选的文献。'
                            : '这个课题还没有文献。'}
                        </p>
                        {project.papers.length ? (
                          <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className="mt-2 text-[11px] text-ink-faint underline decoration-line underline-offset-4 hover:text-ink-soft"
                          >
                            查看全部
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSearchProjectId(project.id)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] text-ink-soft transition hover:border-ink-faint/60 hover:text-ink"
                          >
                            <SearchIcon className="h-3 w-3" />
                            在 OpenAlex 找文献
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={<BookIcon className="h-6 w-6" />}
            title="还没有课题"
            description="文献要归到课题里。先创建一个课题，再开始收集和阅读文献。"
            action={
              <Link to="/wizard" className="btn btn-primary">
                创建第一个课题
              </Link>
            }
          />
        </div>
      )}

      {readerProject && readerPaper ? (
        <PaperReader
          paper={readerPaper}
          projectTitle={readerProject.title}
          strictMode={readerStrictMode}
          onClose={() => setReaderIds(null)}
          onUpdatePaper={(patch) =>
            updatePaper(readerProject.id, readerPaper.id, patch)
          }
          onAddPaper={(paper) => addPaperToProject(readerProject.id, paper)}
        />
      ) : null}

      {searchProject ? (
        <LiteratureSearch
          projectId={searchProject.id}
          onClose={() => setSearchProjectId(null)}
        />
      ) : null}

      {exportOpen ? (
        <ReferenceExport projects={projects} onClose={() => setExportOpen(false)} />
      ) : null}

      {importOpen ? (
        <LiteratureImport
          initialMode={importMode}
          onClose={() => setImportOpen(false)}
          onImported={(projectId, paper) => {
            setImportOpen(false);
            window.setTimeout(() => {
              updatePaper(projectId, paper.id, {
                read: true,
                readAt: new Date().toISOString(),
              });
              setReaderIds({ projectId, paperId: paper.id });
            }, 0);
          }}
        />
      ) : null}

      {deleted ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lift"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[12px] text-ink-soft">
              已移除「{deleted.paper.title}」
            </p>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="shrink-0 text-[12px] font-medium text-accent-deep transition hover:text-accent"
            >
              撤销
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
