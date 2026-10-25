import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlusIcon,
  RefreshIcon,
  ShieldIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from '../components/Icons';
import type {
  AiMode,
  DailyTask,
  Direction,
  Feasibility,
  Paper,
  Project,
  Stage,
  WizardDraft,
} from '../types';
import { STAGES } from '../types';
import { addDays, friendlyDate, groupByDate, sortTasksByDate, todayStr } from '../lib/date';
import { EMPTY_DRAFT, clearDraft, hasDraftContent, loadDraft, saveDraft } from '../lib/draft';
import { buildFallbackTasks, makeEmptyTask } from '../lib/fallbackTasks';
import { nextStageOf, withStage } from '../lib/tasks';
import { chatComplete, parseLooseJSON } from '../lib/llm';
import { createManualPaper, searchWorks } from '../lib/openalex';
import {
  STAGE_STRATEGY,
  buildAnalysisPrompt,
  buildCopyPrompt,
  buildTaskPrompt,
  type AnalysisResult,
  type TaskGenResult,
} from '../lib/prompts';
import { clamp, copyText, cx, pluralAuthors, truncate, uid } from '../lib/utils';
import { useApp } from '../store/AppContext';

const STEP_TITLES = ['设定课题', '文献检索', '解读与方向', '每日任务'];
const MAX_PAPERS = 5;
const FEASIBILITIES: Feasibility[] = ['高', '中', '低'];

function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'ok';
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        'rounded-2xl border px-4 py-3 text-[12.5px] leading-relaxed',
        tone === 'error' && 'border-accent/25 bg-accent-soft text-accent-deep',
        tone === 'ok' && 'border-moss/25 bg-moss-soft text-moss-deep',
        tone === 'info' && 'border-line bg-surface/70 text-ink-soft'
      )}
    >
      {children}
    </div>
  );
}

function TaskEditor({
  task,
  onChange,
  onRemove,
}: {
  task: DailyTask;
  onChange: (patch: Partial<DailyTask>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-card">
      <div className="flex items-start gap-2">
        <input
          value={task.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="任务标题"
          aria-label="任务标题"
          className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-faint/60"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="删除任务"
          className="gesture mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint/70 transition hover:bg-accent-soft hover:text-accent-deep"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <textarea
        value={task.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="怎么做？一两句就够。"
        aria-label="任务描述"
        rows={2}
        className="mt-1.5 w-full resize-y bg-transparent text-[12.5px] leading-relaxed text-ink-soft outline-none placeholder:text-ink-faint/60"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
        <label className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1">
          <CalendarIcon className="h-3.5 w-3.5" />
          <input
            type="date"
            value={task.date}
            onChange={(e) => e.target.value && onChange({ date: e.target.value })}
            aria-label="任务日期"
            className="bg-transparent text-[11px] text-ink-soft outline-none"
          />
        </label>
        <label className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1">
          <ClockIcon className="h-3.5 w-3.5" />
          <input
            type="number"
            min={5}
            max={60}
            value={task.minutes ?? 30}
            onChange={(e) =>
              onChange({ minutes: clamp(Number(e.target.value) || 30, 5, 60) })
            }
            aria-label="预计分钟数"
            className="w-10 bg-transparent text-center text-[11px] text-ink-soft outline-none"
          />
          分钟
        </label>
      </div>

      <input
        value={task.criteria}
        onChange={(e) => onChange({ criteria: e.target.value })}
        placeholder="完成标准：做到什么算完成？"
        aria-label="完成标准"
        className="mt-2 w-full rounded-xl bg-paper/80 px-2.5 py-2 text-[11.5px] text-ink-soft outline-none placeholder:text-ink-faint/70 focus:ring-2 focus:ring-ink/5"
      />
    </div>
  );
}

function normalizeFeasibility(value?: string): Feasibility {
  return value === '高' || value === '低' ? value : '中';
}

/** 从已有课题进入「下一阶段」时，复用课题信息，只生成新阶段任务 */
function makeExtensionDraft(
  project: Project,
  rawStage: string | null,
  fallbackMode: AiMode
): WizardDraft {
  const targetStage = STAGES.includes(rawStage as Stage)
    ? (rawStage as Stage)
    : nextStageOf(project.stage) ?? project.stage;
  const chosenPapers = project.papers.filter((paper) => paper.selected);
  const selectedPapers = chosenPapers.length ? chosenPapers : project.papers;
  const directions = project.directions.length
    ? project.directions.map((direction) => ({ ...direction }))
    : [
        {
          id: uid('dir-'),
          title: project.title,
          description: '沿用当前课题方向，把这一阶段拆成可执行的小任务。',
          feasibility: '中' as Feasibility,
          selected: true,
        },
      ];
  if (!directions.some((direction) => direction.selected)) {
    directions[0] = { ...directions[0], selected: true };
  }

  return {
    step: 4,
    title: project.title,
    stage: targetStage,
    keywords: project.keywords ?? '',
    query: project.keywords || project.title,
    results: project.papers,
    selectedIds: selectedPapers.slice(0, MAX_PAPERS).map((paper) => paper.id),
    directions,
    tasks: [],
    aiMode: project.aiMode ?? fallbackMode,
  };
}

export function Wizard() {
  const { projects, settings, createProject, updateProject, setActiveProject } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const extendId = searchParams.get('extend');
  const extendProject = extendId
    ? projects.find((project) => project.id === extendId)
    : undefined;
  const isExtension = Boolean(extendProject);

  const [draft, setDraft] = useState<WizardDraft>(() => {
    if (extendProject) {
      return makeExtensionDraft(
        extendProject,
        searchParams.get('stage'),
        settings.aiMode
      );
    }
    const saved = loadDraft();
    if (!saved) return { ...EMPTY_DRAFT, aiMode: settings.aiMode };
    return { ...saved, aiMode: saved.aiMode ?? settings.aiMode };
  });

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    title: '',
    authors: '',
    year: '',
    journal: '',
    doi: '',
    abstract: '',
    url: '',
  });

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [copyOpen, setCopyOpen] = useState(() => !settings.apiKey.trim());
  const [copied, setCopied] = useState(false);

  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [taskNotice, setTaskNotice] = useState('');

  const hasKey = Boolean(settings.apiKey.trim());
  /** 严格模式：AI 不参与解读与方向，只在第 4 步拆任务 */
  const strictMode = draft.aiMode === 'tasks-only';
  const stage = (draft.stage || '文献综述') as Stage;
  const selectedPapers = draft.results.filter((p) => draft.selectedIds.includes(p.id));
  const selectedDirections = draft.directions.filter((d) => d.selected);
  const activeDirections = selectedDirections.filter((d) => d.title.trim());
  const atMaxPapers = draft.selectedIds.length >= MAX_PAPERS;

  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (isExtension) return;
    const timer = window.setTimeout(() => {
      if (hasDraftContent(draft)) saveDraft(draft);
      else clearDraft();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, isExtension]);

  useEffect(() => {
    if (isExtension) return;
    const flush = () => {
      if (hasDraftContent(draftRef.current)) saveDraft(draftRef.current);
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [isExtension]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [draft.step]);

  function patch(p: Partial<WizardDraft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function goBack() {
    if (isExtension) {
      if (extendProject) {
        setActiveProject(extendProject.id);
        navigate(`/tasks?project=${extendProject.id}`);
      } else {
        navigate('/projects');
      }
      return;
    }
    if (draft.step <= 1) navigate('/projects');
    else setDraft((d) => ({ ...d, step: d.step - 1 }));
  }

  async function runSearch(rawQuery: string) {
    const q = rawQuery.trim();
    if (!q) {
      setSearchError('先写一个关键词，再开始找。');
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    try {
      const papers = await searchWorks(q);
      setDraft((d) => {
        // 保留之前手动录入的文献，避免重新搜索时丢掉
        const manual = d.results.filter((p) => p.manual);
        const manualIds = new Set(manual.map((p) => p.id));
        const merged = [...manual, ...papers.filter((p) => !manualIds.has(p.id))];
        const ids = new Set(merged.map((p) => p.id));
        return {
          ...d,
          query: q,
          results: merged,
          selectedIds: d.selectedIds.filter((id) => ids.has(id)),
        };
      });
      if (!papers.length) {
        setSearchError('这次没有找到结果。换几个更宽泛的词，或手动录入一篇。');
        setManualOpen(true);
      }
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : '文献服务暂时连不上，可以手动录入。'
      );
      setManualOpen(true);
      patch({ query: q });
    } finally {
      setSearchLoading(false);
    }
  }

  function goNext() {
    if (draft.step === 1) {
      if (!draft.title.trim() || !draft.stage) return;
      const q = draft.query.trim() || draft.keywords.trim() || draft.title.trim();
      setDraft((d) => ({ ...d, step: 2, query: d.query.trim() || q }));
      if (!draft.results.length && q) void runSearch(q);
      return;
    }
    if (draft.step === 2) {
      if (!draft.selectedIds.length) return;
      setDraft((d) => ({ ...d, step: 3 }));
      return;
    }
    if (draft.step === 3) {
      if (!activeDirections.length) return;
      setDraft((d) => ({ ...d, step: 4 }));
      return;
    }
    finish();
  }

  function togglePaper(id: string) {
    setDraft((d) => {
      if (d.selectedIds.includes(id)) {
        return { ...d, selectedIds: d.selectedIds.filter((x) => x !== id) };
      }
      if (d.selectedIds.length >= MAX_PAPERS) return d;
      return { ...d, selectedIds: [...d.selectedIds, id] };
    });
  }

  function addManualPaper(e: FormEvent) {
    e.preventDefault();
    if (!manual.title.trim()) return;
    const paper = createManualPaper(manual);
    setDraft((d) => ({
      ...d,
      results: [paper, ...d.results],
      selectedIds:
        d.selectedIds.length < MAX_PAPERS ? [...d.selectedIds, paper.id] : d.selectedIds,
    }));
    setManual({
      title: '',
      authors: '',
      year: '',
      journal: '',
      doi: '',
      abstract: '',
      url: '',
    });
    setManualOpen(false);
    setSearchError('');
  }

  async function generateAnalysis() {
    // 严格模式硬闸门：无论 UI 如何变化，第 3 步都不发起任何 AI 请求
    if (strictMode) return;
    if (!hasKey) {
      setCopyOpen(true);
      return;
    }
    if (draft.directions.length) {
      const ok = window.confirm('重新生成会覆盖当前的方向与解读，确定吗？');
      if (!ok) return;
    }
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const content = await chatComplete(
        settings,
        [
          {
            role: 'system',
            content:
              '你是一位严谨、具体的研究导师。严格按用户要求输出 JSON，不使用 markdown 代码块。',
          },
          {
            role: 'user',
            content: buildAnalysisPrompt(
              draft.title.trim(),
              stage,
              draft.keywords,
              selectedPapers
            ),
          },
        ],
        { temperature: 0.4 }
      );
      const data = parseLooseJSON<AnalysisResult>(content);
      applyAnalysis(data);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : '生成失败了，可以重试或改用复制模式。'
      );
      setCopyOpen(true);
    } finally {
      setAnalysisLoading(false);
    }
  }

  function applyAnalysis(data: AnalysisResult) {
    const directions = (data.directions ?? [])
      .map((d) => ({
        title: (d.title ?? '').trim(),
        description: (d.description ?? '').trim(),
        feasibility: normalizeFeasibility(d.feasibility),
      }))
      .filter((d) => d.title)
      .slice(0, 3);

    if (!directions.length) {
      throw new Error('AI 没有给出可用的研究方向，请重试或手动添加。');
    }

    const interp = new Map<string, string>();
    (data.interpretations ?? []).forEach((item, index) => {
      const pid =
        item.paperId && selectedPapers.some((p) => p.id === item.paperId)
          ? item.paperId
          : selectedPapers[index]?.id;
      if (pid && item.text?.trim()) interp.set(pid, item.text.trim());
    });

    setDraft((d) => ({
      ...d,
      results: d.results.map((p) =>
        interp.has(p.id) ? { ...p, interpretation: interp.get(p.id) } : p
      ),
      directions: directions.map((dir, index) => ({
        id: uid('dir-'),
        title: dir.title,
        description: dir.description,
        feasibility: dir.feasibility,
        selected: index === 0,
      })),
    }));
  }

  async function copyPrompt() {
    if (strictMode) return;
    const ok = await copyText(
      buildCopyPrompt(draft.title.trim(), stage, draft.keywords, selectedPapers)
    );
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function updateDirection(id: string, p: Partial<Direction>) {
    setDraft((d) => ({
      ...d,
      directions: d.directions.map((dir) => (dir.id === id ? { ...dir, ...p } : dir)),
    }));
  }

  function toggleDirection(id: string) {
    setDraft((d) => {
      const target = d.directions.find((x) => x.id === id);
      if (!target) return d;
      if (!target.selected && d.directions.filter((x) => x.selected).length >= 2) return d;
      return {
        ...d,
        directions: d.directions.map((x) =>
          x.id === id ? { ...x, selected: !x.selected } : x
        ),
      };
    });
  }

  function addDirection() {
    setDraft((d) => ({
      ...d,
      directions: [
        ...d.directions,
        {
          id: uid('dir-'),
          title: '',
          description: '',
          feasibility: '中',
          selected: d.directions.filter((x) => x.selected).length === 0,
        },
      ],
    }));
  }

  function removeDirection(id: string) {
    setDraft((d) => ({ ...d, directions: d.directions.filter((x) => x.id !== id) }));
  }

  async function generateTasks() {
    if (!activeDirections.length) return;
    if (
      draft.tasks.length &&
      !window.confirm('重新生成会覆盖现有任务（包括手动改过的内容），确定吗？')
    ) {
      return;
    }

    if (!hasKey) {
      useTemplateTasks(false);
      return;
    }

    setTaskLoading(true);
    setTaskError('');
    setTaskNotice('');
    try {
      const content = await chatComplete(
        settings,
        [
          {
            role: 'system',
            content:
              '你是一位擅长把研究拆成每日行动的研究教练。严格按用户要求输出 JSON，不使用 markdown 代码块。',
          },
          {
            role: 'user',
            content: buildTaskPrompt(
              draft.title.trim(),
              stage,
              activeDirections,
              todayStr(),
              strictMode
            ),
          },
        ],
        { temperature: 0.5 }
      );
      const data = parseLooseJSON<TaskGenResult>(content);
      const raw = (data.tasks ?? []).filter((t) => (t.title ?? '').trim());
      if (!raw.length) throw new Error('AI 没有生成可用任务，请重试或使用阶段模板。');

      const tasks: DailyTask[] = raw.slice(0, 15).map((t, index) => {
        const rawOffset = Number(t.dayOffset);
        const offset = Number.isFinite(rawOffset) ? Math.floor(rawOffset) : index;
        return {
          id: uid('task-'),
          date: addDays(todayStr(), clamp(offset, 0, 90)),
          title: (t.title ?? '').trim(),
          description: (t.description ?? '').trim(),
          criteria: (t.criteria ?? '').trim(),
          minutes:
            typeof t.minutes === 'number' ? clamp(Math.round(t.minutes), 5, 45) : 30,
          linkedDirectionId: activeDirections[index % activeDirections.length]?.id,
          done: false,
          note: '',
        };
      });

      const sorted = sortTasksByDate(tasks);
      setDraft((d) => ({ ...d, tasks: sorted }));
      setTaskNotice(
        sorted.length >= 10
          ? `已生成 ${sorted.length} 个任务，可以改日期、改标准，或删掉不合适的。`
          : `AI 只生成了 ${sorted.length} 个任务，可以再生成一次补充，或手动添加。`
      );
    } catch (err) {
      setTaskError(
        err instanceof Error ? err.message : '生成失败，可以重试，或直接用阶段模板。'
      );
    } finally {
      setTaskLoading(false);
    }
  }

  function useTemplateTasks(confirmFirst = true) {
    if (
      confirmFirst &&
      draft.tasks.length &&
      !window.confirm('用阶段模板会覆盖现有任务，确定吗？')
    ) {
      return;
    }
    const tasks = buildFallbackTasks({
      projectTitle: draft.title.trim() || '我的课题',
      stage,
      directions: activeDirections,
      startDate: todayStr(),
    });
    setDraft((d) => ({ ...d, tasks }));
    setTaskError('');
    setTaskNotice(`已按「${stage}」模板生成 ${tasks.length} 个任务，可以逐条修改。`);
  }

  function updateTaskField(id: string, p: Partial<DailyTask>) {
    setDraft((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)),
    }));
  }

  function removeTask(id: string) {
    setDraft((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }

  function addTask() {
    const firstDirection = selectedDirections[0];
    setDraft((d) => ({
      ...d,
      tasks: sortTasksByDate([
        ...d.tasks,
        makeEmptyTask(todayStr(), firstDirection?.id),
      ]),
    }));
  }

  function finish() {
    if (!draft.stage || !draft.title.trim()) return;
    const now = new Date().toISOString();
    const cleanTasks: DailyTask[] = draft.tasks
      .filter((task) => task.title.trim())
      .map((task) => ({
        ...task,
        title: task.title.trim(),
        description: task.description.trim(),
        criteria: task.criteria.trim(),
        stage: draft.stage as Stage,
      }));

    if (extendProject) {
      const projectId = extendProject.id;
      updateProject(projectId, (project) => {
        const merged = withStage(project, draft.stage as Stage, now);
        return {
          ...merged,
          keywords: draft.keywords.trim() || project.keywords,
          directions: draft.directions
            .filter((direction) => direction.title.trim())
            .map((direction) => ({ ...direction })),
          // 关键：不同阶段的任务都追加到同一个课题，进度统计不分裂
          dailyTasks: [...project.dailyTasks, ...cleanTasks],
        };
      });
      setActiveProject(projectId);
      setDraft({ ...EMPTY_DRAFT, aiMode: settings.aiMode });
      navigate(`/tasks?project=${projectId}`);
      return;
    }

    const project: Project = {
      id: uid('project-'),
      title: draft.title.trim(),
      stage: draft.stage,
      keywords: draft.keywords.trim(),
      createdAt: now,
      aiMode: strictMode ? 'tasks-only' : 'full',
      stageHistory: [{ stage: draft.stage, startedAt: now }],
      papers: draft.results.map((paper) => ({
        ...paper,
        selected: draft.selectedIds.includes(paper.id),
      })),
      directions: draft.directions
        .filter((direction) => direction.title.trim())
        .map((direction) => ({ ...direction })),
      dailyTasks: cleanTasks,
    };
    createProject(project);
    setDraft({ ...EMPTY_DRAFT, aiMode: settings.aiMode });
    clearDraft();
    navigate('/');
  }

  function restartDraft() {
    if (!window.confirm('清空当前向导草稿，从第 1 步重新开始？')) return;
    clearDraft();
    setDraft({ ...EMPTY_DRAFT, aiMode: settings.aiMode });
    setSearchError('');
    setAnalysisError('');
    setTaskError('');
    setTaskNotice('');
    setCopyOpen(!hasKey);
    window.scrollTo(0, 0);
  }

  const canNext =
    draft.step === 1
      ? Boolean(draft.title.trim() && draft.stage)
      : draft.step === 2
        ? draft.selectedIds.length > 0
        : draft.step === 3
          ? activeDirections.length > 0
          : draft.tasks.some((t) => t.title.trim());

  const busy = analysisLoading || taskLoading;
  const nextLabel = isExtension
    ? '完成，加入课题'
    : draft.step === 1
      ? '下一步'
      : draft.step === 2
        ? '选好了，看方向'
        : draft.step === 3
          ? '选好了，拆任务'
          : '完成，开始打卡';

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/60 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="返回上一步"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition hover:bg-ink/5"
          >
            <ArrowLeftIcon className="h-[18px] w-[18px]" />
          </button>
          <div className="text-center">
            {isExtension ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  继续课题
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">
                  {draft.stage || extendProject?.stage} · 添加任务
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  第 {draft.step} 步 / 共 4 步
                </p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">
                  {STEP_TITLES[draft.step - 1]}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              isExtension && extendProject
                ? navigate(`/tasks?project=${extendProject.id}`)
                : navigate('/projects')
            }
            aria-label="退出向导"
            title="退出（草稿会自动保留）"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition hover:bg-ink/5 hover:text-ink"
          >
            <XIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
        {isExtension ? (
          <div className="mx-auto flex w-full max-w-2xl gap-1.5 px-5 pb-3">
            <span className="h-1 flex-1 rounded-full bg-ink" />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl gap-1.5 px-5 pb-3">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={cx(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  n <= draft.step ? 'bg-ink' : 'bg-line'
                )}
              />
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-36 pt-7">
        <div key={draft.step} className="animate-rise">
          {draft.step === 1 ? (
            <section>
              <h1 className="text-[27px] font-semibold leading-tight tracking-tight">
                先给课题一个名字
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                不需要很精确。一句你愿意继续追下去的问题，就够开始了。
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canNext) goNext();
                }}
                className="card mt-6 space-y-5 p-5 sm:p-6"
              >
                <div>
                  <label htmlFor="project-title" className="label">
                    课题标题
                  </label>
                  <input
                    id="project-title"
                    value={draft.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder="例如：短视频使用与青少年注意力的关系"
                    className="field text-[16px]"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="project-stage" className="label">
                    现在处于哪个阶段
                  </label>
                  <select
                    id="project-stage"
                    value={draft.stage}
                    onChange={(e) => patch({ stage: e.target.value as Stage | '' })}
                    className={cx('field', !draft.stage && 'text-ink-faint')}
                  >
                    <option value="" disabled>
                      选择一个阶段
                    </option>
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <p className="hint">阶段只影响任务模板，之后可以调整任务内容。</p>
                </div>

                <div>
                  <label htmlFor="project-keywords" className="label">
                    关键词补充 <span className="font-normal text-ink-faint">（可选）</span>
                  </label>
                  <input
                    id="project-keywords"
                    value={draft.keywords}
                    onChange={(e) => patch({ keywords: e.target.value })}
                    placeholder="例如：adolescent, short video, attention"
                    className="field"
                  />
                  <p className="hint">留空就用课题标题去检索文献。</p>
                </div>

                <div>
                  <span className="label">AI 参与范围</span>
                  <div
                    role="radiogroup"
                    aria-label="AI 参与范围"
                    className="grid grid-cols-2 gap-2"
                  >
                    {[
                      {
                        value: 'full' as const,
                        title: '完整辅助',
                        desc: 'AI 可写解读与方向',
                      },
                      {
                        value: 'tasks-only' as const,
                        title: '仅任务规划',
                        desc: '第 3 步完全手动',
                      },
                    ].map((mode) => {
                      const active = draft.aiMode === mode.value;
                      return (
                        <button
                          key={mode.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => patch({ aiMode: mode.value })}
                          className={cx(
                            'rounded-2xl border px-3.5 py-3 text-left transition-colors',
                            active
                              ? 'border-ink bg-ink text-paper'
                              : 'border-line bg-surface text-ink-soft hover:border-ink-faint/60'
                          )}
                        >
                          <span className="block text-[13px] font-semibold">{mode.title}</span>
                          <span
                            className={cx(
                              'mt-0.5 block text-[10px]',
                              active ? 'text-paper/70' : 'text-ink-faint'
                            )}
                          >
                            {mode.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="hint">
                    {strictMode
                      ? '严格模式：第 3 步不调用 AI、不生成可复制提示词，解读与方向全部由你撰写；AI 只在第 4 步拆任务。切换模式不会自动删除已有草稿内容。'
                      : 'AI 可以生成文献解读与研究方向。所有生成内容仍然可以修改。'}
                  </p>
                </div>
              </form>

              <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-faint">
                不知道选哪个阶段？选最接近的就好。课题本来就是边走边清楚的。
              </p>

              {draft.results.length || draft.directions.length || draft.tasks.length ? (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={restartDraft}
                    className="text-[11.5px] text-ink-faint underline decoration-line underline-offset-4 transition hover:text-ink-soft"
                  >
                    清空上次的草稿，重新开始
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {draft.step === 2 ? (
            <section>
              <h1 className="text-[27px] font-semibold leading-tight tracking-tight">
                先读读别人做过什么
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                从被引最多的 10 篇开始。勾选 3–5 篇你真正想读的，不用贪多。
              </p>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-[11.5px] text-ink-faint">
                  已选 {draft.selectedIds.length} 篇
                  {atMaxPapers ? ' · 已达上限' : ' · 建议 3–5 篇'}
                </span>
                <button
                  type="button"
                  onClick={() => setManualOpen((v) => !v)}
                  className="text-[12px] text-ink-soft underline decoration-line underline-offset-4 transition hover:text-ink"
                >
                  {manualOpen ? '收起手动录入' : '手动录入一篇'}
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runSearch(draft.query);
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  value={draft.query}
                  onChange={(e) => patch({ query: e.target.value })}
                  placeholder="输入检索关键词"
                  aria-label="检索关键词"
                  className="field"
                />
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="btn btn-primary shrink-0 px-4"
                >
                  {searchLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
                  ) : draft.results.length ? (
                    <>
                      <RefreshIcon className="h-4 w-4" />
                      重新搜索
                    </>
                  ) : (
                    '搜索'
                  )}
                </button>
              </form>

              <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                OpenAlex 对英文关键词更敏感。中文课题可以先用英文关键词搜一次，结果通常更相关。
              </p>

              {manualOpen ? (
                <form onSubmit={addManualPaper} className="card mt-3 space-y-3 p-4">
                  <p className="text-[13px] font-medium">手动录入文献</p>
                  <input
                    required
                    value={manual.title}
                    onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))}
                    placeholder="文献标题（必填）"
                    className="field field-sm"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={manual.authors}
                      onChange={(e) => setManual((m) => ({ ...m, authors: e.target.value }))}
                      placeholder="作者，用逗号分隔"
                      className="field field-sm"
                    />
                    <input
                      value={manual.year}
                      onChange={(e) => setManual((m) => ({ ...m, year: e.target.value }))}
                      placeholder="年份"
                      inputMode="numeric"
                      className="field field-sm"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={manual.journal}
                      onChange={(e) => setManual((m) => ({ ...m, journal: e.target.value }))}
                      placeholder="期刊 / 来源（可选，导出引用用）"
                      className="field field-sm"
                    />
                    <input
                      value={manual.doi}
                      onChange={(e) => setManual((m) => ({ ...m, doi: e.target.value }))}
                      placeholder="DOI（可选）"
                      className="field field-sm"
                    />
                  </div>
                  <textarea
                    value={manual.abstract}
                    onChange={(e) => setManual((m) => ({ ...m, abstract: e.target.value }))}
                    placeholder="摘要（可选，但 AI 解读会更准）"
                    rows={3}
                    className="field field-sm resize-y"
                  />
                  <input
                    value={manual.url}
                    onChange={(e) => setManual((m) => ({ ...m, url: e.target.value }))}
                    placeholder="原文链接（可选）"
                    className="field field-sm"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-primary btn-sm">
                      加入并勾选
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualOpen(false)}
                      className="btn btn-ghost btn-sm"
                    >
                      取消
                    </button>
                  </div>
                </form>
              ) : null}

              {searchError ? (
                <div className="mt-4">
                  <Notice tone="error">
                    {searchError}
                    <span className="mt-1 block text-accent-deep/80">
                      也可以在下方手动录入文献，先把流程走下去。
                    </span>
                  </Notice>
                </div>
              ) : null}

              {searchLoading ? (
                <div className="mt-5 space-y-3" aria-live="polite">
                  <p className="text-[12px] text-ink-faint">正在翻找文献…</p>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-28 animate-pulse rounded-3xl border border-line bg-surface/70"
                    />
                  ))}
                </div>
              ) : null}

              {!searchLoading && draft.results.length ? (
                <div className="mt-5 space-y-3">
                  {draft.results.map((paper) => {
                    const selected = draft.selectedIds.includes(paper.id);
                    return (
                      <article
                        key={paper.id}
                        className={cx(
                          'rounded-3xl border p-4 transition-colors',
                          selected
                            ? 'border-ink/70 bg-surface shadow-card'
                            : 'border-line bg-surface/70'
                        )}
                      >
                        <div className="flex gap-3">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={selected}
                            aria-label={`选择文献：${paper.title}`}
                            onClick={() => togglePaper(paper.id)}
                            className={cx(
                              'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                              selected
                                ? 'border-ink bg-ink text-paper'
                                : 'border-line bg-surface text-transparent hover:border-ink-faint'
                            )}
                          >
                            <CheckIcon className="h-3 w-3" />
                          </button>

                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => togglePaper(paper.id)}
                              className="block w-full text-left"
                            >
                              <h3 className="text-[14.5px] font-semibold leading-snug text-ink">
                                {paper.title}
                              </h3>
                            </button>

                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-faint">
                              <span>{pluralAuthors(paper.authors)}</span>
                              <span>·</span>
                              <span>{paper.year ?? '年份未知'}</span>
                              {paper.citedByCount > 0 ? (
                                <>
                                  <span>·</span>
                                  <span>被引 {paper.citedByCount}</span>
                                </>
                              ) : null}
                              {paper.manual ? (
                                <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9.5px] text-accent-deep">
                                  手动
                                </span>
                              ) : null}
                            </p>

                            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
                              {paper.abstract
                                ? truncate(paper.abstract, 200)
                                : '这篇没有公开摘要，可以点开原文看看。'}
                            </p>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span
                                className={cx(
                                  'text-[10.5px]',
                                  selected ? 'text-ink-soft' : 'text-ink-faint/70'
                                )}
                              >
                                {selected ? '已选中' : '点击勾选'}
                              </span>
                              {paper.url ? (
                                <a
                                  href={paper.url}
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
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}

              {!searchLoading && !draft.results.length && !searchError ? (
                <p className="mt-6 text-center text-[12.5px] leading-relaxed text-ink-faint">
                  输入关键词，先看看领域里最被认可的几篇。
                  <br />
                  选错了也没关系，随时可以回来改。
                </p>
              ) : null}
            </section>
          ) : null}

          {draft.step === 3 ? (
            <section>
              <h1 className="text-[27px] font-semibold leading-tight tracking-tight">
                这些文献，和你的课题有什么关系？
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                {strictMode
                  ? '这一步不调用 AI。请自己写下每篇的三句话解读，并提出 1–2 个方向。'
                  : '让 AI 先读一遍，给每篇三句话，再提三个可切入的方向。你来做最后的判断。'}
              </p>

              {strictMode ? (
                <div className="card mt-5 p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-moss-soft text-moss-deep">
                      <ShieldIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-semibold">严格模式：这一步没有 AI</h2>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                        当前课题选择了「仅任务规划」。AI 不会生成文献解读，不会提出研究方向，也不会生成可复制提示词。
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 rounded-2xl bg-paper/70 px-4 py-3 text-[11.5px] leading-relaxed text-ink-soft">
                    <p>① 自己写每篇的三句话解读（可以留空）</p>
                    <p>② 在下方手动添加 1–2 个方向，再进入第 4 步</p>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                    第 4 步 AI 只会读取你写的方向标题与描述，不会读取文献摘要，也不会新增研究内容。文献检索来自 OpenAlex
                    数据库，不属于生成式 AI。
                  </p>
                </div>
              ) : (
                <>
              <div className="card mt-5 p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-deep">
                    <SparklesIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-semibold">AI 先读一遍</h2>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                      基于选中的 {selectedPapers.length} 篇文献，生成三句话解读与 3 个方向。内容都可以手动修改。
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void generateAnalysis()}
                    disabled={analysisLoading || !selectedPapers.length}
                    className="btn btn-primary btn-sm"
                  >
                    {analysisLoading ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
                        正在读文献…
                      </>
                    ) : hasKey ? (
                      draft.directions.length ? (
                        '重新生成解读与方向'
                      ) : (
                        '让 AI 读这几篇'
                      )
                    ) : (
                      '复制提示词，去别处生成'
                    )}
                  </button>
                  {hasKey ? (
                    <button
                      type="button"
                      onClick={() => setCopyOpen((v) => !v)}
                      className="btn btn-secondary btn-sm"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                      {copyOpen ? '收起复制模式' : '复制提示词'}
                    </button>
                  ) : null}
                </div>
              </div>

              {!hasKey ? (
                <div className="mt-3">
                  <Notice tone="info">
                    还没有配置 API Key，所以先把提示词准备好。复制到 ChatGPT / Claude
                    跑完后，把你喜欢的方向手动加在下面。
                    <Link
                      to="/settings"
                      className="ml-1 underline decoration-line underline-offset-4 hover:text-ink"
                    >
                      去设置
                    </Link>
                    <span className="text-ink-faint">（草稿会自动保留）</span>
                  </Notice>
                </div>
              ) : null}

              {analysisError ? (
                <div className="mt-3">
                  <Notice tone="error">
                    {analysisError}
                    <span className="mt-1 block">已切到复制模式，也可以直接重试。</span>
                  </Notice>
                </div>
              ) : null}

              {copyOpen ? (
                <div className="mt-3 rounded-3xl border border-accent/25 bg-accent-soft/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[13.5px] font-semibold text-ink">可复制提示词</h3>
                    <button type="button" onClick={() => void copyPrompt()} className="btn btn-secondary btn-sm">
                      <CopyIcon className="h-3.5 w-3.5" />
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
                    已包含课题信息与 {selectedPapers.length} 篇文献摘要。贴到任意聊天模型里都行。
                  </p>
                  <textarea
                    readOnly
                    value={buildCopyPrompt(
                      draft.title.trim(),
                      stage,
                      draft.keywords,
                      selectedPapers
                    )}
                    rows={9}
                    aria-label="可复制的提示词"
                    className="mt-3 w-full resize-y rounded-2xl border border-line bg-surface/80 p-3 text-[11.5px] leading-relaxed text-ink-soft outline-none"
                  />
                </div>
              ) : null}
                </>
              )}

              <div className="mt-7">
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="text-[16px] font-semibold">文献解读</h2>
                  <span className="text-[11px] text-ink-faint">
                    {strictMode ? '由你撰写' : '每篇三句话，可修改'}
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedPapers.map((paper: Paper) => (
                    <div key={paper.id} className="card p-5">
                      <h3 className="text-[14px] font-semibold leading-snug text-ink">
                        {paper.title}
                      </h3>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {pluralAuthors(paper.authors)} · {paper.year ?? '年份未知'}
                      </p>

                      {(!hasKey || strictMode) && paper.abstract ? (
                        <p className="mt-2 line-clamp-4 rounded-xl bg-paper/70 px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
                          {paper.abstract}
                        </p>
                      ) : paper.abstract ? (
                        <details className="group mt-2">
                          <summary className="cursor-pointer list-none text-[11px] text-ink-faint underline decoration-line underline-offset-4 hover:text-ink-soft">
                            查看摘要
                          </summary>
                          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
                            {paper.abstract}
                          </p>
                        </details>
                      ) : null}

                      <label className="mt-3 block">
                        <span className="mb-1.5 block text-[10.5px] font-medium tracking-wide text-ink-faint">
                          三句话解读 · 研究问题 / 方法 / 与课题的关系
                        </span>
                        <textarea
                          value={paper.interpretation ?? ''}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              results: d.results.map((p) =>
                                p.id === paper.id
                                  ? { ...p, interpretation: e.target.value }
                                  : p
                              ),
                            }))
                          }
                          rows={3}
                          placeholder={
                            strictMode
                              ? '自己写三句话：研究问题 / 方法 / 与课题的关系。'
                              : '可以等 AI 生成，也可以自己写。'
                          }
                          className="w-full resize-y rounded-2xl border border-line bg-paper/40 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink outline-none transition focus:border-ink-faint/60 focus:bg-surface focus:ring-4 focus:ring-ink/5"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-[16px] font-semibold">可切入的方向</h2>
                    <p className="mt-0.5 text-[11.5px] text-ink-faint">
                      选 1–2 个你愿意真的做下去的。
                    </p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-ink-faint">
                    {activeDirections.length} / 2
                  </span>
                </div>

                {draft.directions.length ? (
                  <div className="space-y-3">
                    {draft.directions.map((direction) => (
                      <div
                        key={direction.id}
                        className={cx(
                          'rounded-3xl border p-4 transition-colors',
                          direction.selected
                            ? 'border-ink/70 bg-surface shadow-card'
                            : 'border-line bg-surface/70'
                        )}
                      >
                        <div className="flex gap-3">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={direction.selected}
                            aria-label={`选择方向：${direction.title || '未命名'}`}
                            onClick={() => toggleDirection(direction.id)}
                            className={cx(
                              'mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                              direction.selected
                                ? 'border-ink bg-ink text-paper'
                                : 'border-line bg-surface text-transparent hover:border-ink-faint'
                            )}
                          >
                            <CheckIcon className="h-3 w-3" />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <input
                                value={direction.title}
                                onChange={(e) =>
                                  updateDirection(direction.id, { title: e.target.value })
                                }
                                placeholder="方向标题"
                                aria-label="方向标题"
                                className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-faint/60"
                              />
                              <button
                                type="button"
                                onClick={() => removeDirection(direction.id)}
                                aria-label="删除方向"
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-faint/70 transition hover:bg-accent-soft hover:text-accent-deep"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <textarea
                              value={direction.description}
                              onChange={(e) =>
                                updateDirection(direction.id, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="两句描述：具体可以做什么？为什么成立？"
                              aria-label="方向描述"
                              rows={2}
                              className="mt-1.5 w-full resize-y bg-transparent text-[12.5px] leading-relaxed text-ink-soft outline-none placeholder:text-ink-faint/60"
                            />

                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="mr-0.5 text-[10.5px] text-ink-faint">可行性</span>
                              {FEASIBILITIES.map((f) => {
                                const active = direction.feasibility === f;
                                return (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={() =>
                                      updateDirection(direction.id, { feasibility: f })
                                    }
                                    className={cx(
                                      'rounded-full px-2.5 py-1 text-[10.5px] transition',
                                      active
                                        ? f === '高'
                                          ? 'bg-moss text-paper'
                                          : f === '中'
                                            ? 'bg-accent text-paper'
                                            : 'bg-ink text-paper'
                                        : 'border border-line text-ink-faint hover:border-ink-faint'
                                    )}
                                  >
                                    {f}
                                  </button>
                                );
                              })}
                              {selectedDirections.length >= 2 &&
                              !direction.selected ? (
                                <span className="ml-1 text-[10px] text-ink-faint">
                                  最多选 2 个
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-line bg-surface/50 px-5 py-7 text-center">
                    <p className="text-[14px] font-medium">还没有方向</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
                      可以让 AI 生成，也可以自己写一个。哪怕只是一句话的想法。
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={addDirection}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-4 py-2 text-[12px] text-ink-soft transition hover:border-ink-faint hover:text-ink"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  手动添加方向
                </button>
              </div>
            </section>
          ) : null}

          {draft.step === 4 ? (
            <section>
              {isExtension && extendProject ? (
                <div className="mb-5 rounded-3xl border border-line bg-surface/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    当前课题
                  </p>
                  <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">
                    {extendProject.title}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="extend-stage"
                      className="text-[11.5px] text-ink-faint"
                    >
                      新阶段
                    </label>
                    <select
                      id="extend-stage"
                      value={draft.stage}
                      onChange={(event) =>
                        patch({ stage: event.target.value as Stage })
                      }
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink outline-none"
                    >
                      {STAGES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10.5px] text-ink-faint">
                      可跳过任意阶段；已有 {extendProject.dailyTasks.length} 块任务会全部保留
                    </span>
                  </div>
                </div>
              ) : null}

              <h1 className="text-[27px] font-semibold leading-tight tracking-tight">
                {isExtension ? '把新阶段，拆成每天的一小块' : '把方向，拆成每天的一小块'}
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                {isExtension
                  ? '只生成新阶段的任务，完成记录、文献和统计都留在同一个课题里。'
                  : strictMode
                    ? '严格模式：AI 只把你的方向拆成 20–45 分钟的行动步骤，不新增研究内容。'
                    : '10–15 个任务，每个 20–45 分钟。先跑起来，再慢慢调整。'}
              </p>

              <div className="mt-4 rounded-2xl bg-surface/60 px-4 py-3 text-[11.5px] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">{stage} · 阶段策略 </span>
                {STAGE_STRATEGY[stage]}
              </div>

              {strictMode ? (
                <div className="mt-2 flex items-start gap-2 rounded-2xl border border-moss/20 bg-moss-soft/60 px-4 py-3 text-[11.5px] leading-relaxed text-moss-deep">
                  <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    当前为严格模式。发送给 AI 的只有课题标题、阶段和你写的方向标题与描述；不会发送文献摘要、解读或研究结论。
                  </span>
                </div>
              ) : null}

              {!draft.tasks.length ? (
                <div className="card mt-4 p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-deep">
                      <CalendarIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-semibold">生成每日任务</h2>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                        {strictMode
                          ? 'AI 只负责把你写好的方向拆成行动步骤。生成后仍可逐条修改；也可以完全不调用 AI，使用阶段模板。'
                          : '从今天开始，每天 1–2 块。生成后每一块都能改标题、日期和完成标准。'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void generateTasks()}
                      disabled={taskLoading}
                      className="btn btn-primary btn-sm"
                    >
                      {taskLoading ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" />
                          正在拆解…
                        </>
                      ) : hasKey ? (
                        <>
                          <SparklesIcon className="h-3.5 w-3.5" />
                          让 AI 拆解成每日任务
                        </>
                      ) : (
                        '用阶段模板生成'
                      )}
                    </button>
                    {hasKey ? (
                      <button
                        type="button"
                        onClick={() => useTemplateTasks()}
                        className="btn btn-secondary btn-sm"
                      >
                        {strictMode ? '完全不调用 AI：用阶段模板' : '直接用阶段模板'}
                      </button>
                    ) : null}
                  </div>
                  {!hasKey ? (
                    <p className="hint">
                      没有配置 API Key，阶段模板同样可以开始，生成后可自由修改。
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-ink-faint">
                    共 {draft.tasks.length} 个任务，可逐条修改
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void generateTasks()}
                      disabled={taskLoading}
                      className="btn btn-secondary btn-sm"
                    >
                      {taskLoading ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-faint/40 border-t-ink" />
                      ) : (
                        <RefreshIcon className="h-3.5 w-3.5" />
                      )}
                      重新生成
                    </button>
                    <button type="button" onClick={addTask} className="btn btn-ghost btn-sm">
                      <PlusIcon className="h-3.5 w-3.5" />
                      添加
                    </button>
                  </div>
                </div>
              )}

              {taskError ? (
                <div className="mt-3">
                  <Notice tone="error">
                    {taskError}
                    <button
                      type="button"
                      onClick={() => useTemplateTasks()}
                      className="ml-2 underline decoration-accent/40 underline-offset-4"
                    >
                      改用阶段模板
                    </button>
                  </Notice>
                </div>
              ) : null}

              {taskNotice ? (
                <div className="mt-3">
                  <Notice tone="ok">{taskNotice}</Notice>
                </div>
              ) : null}

              {draft.tasks.length ? (
                <div className="mt-6 space-y-6">
                  {groupByDate(draft.tasks).map(([date, tasks]) => (
                    <div key={date}>
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="rounded-full bg-ink px-2.5 py-1 text-[10.5px] text-paper">
                          {friendlyDate(date)}
                        </span>
                        <span className="text-[10.5px] text-ink-faint">
                          {tasks.length} 块
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {tasks.map((task) => (
                          <TaskEditor
                            key={task.id}
                            task={task}
                            onChange={(p) => updateTaskField(task.id, p)}
                            onRemove={() => removeTask(task.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addTask}
                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line py-3 text-[12px] text-ink-faint transition hover:border-ink-faint hover:text-ink-soft"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    再加一块任务
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-line/60 bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={goBack} className="btn btn-secondary flex-1">
            {isExtension ? '取消' : draft.step === 1 ? '退出' : '上一步'}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext || busy}
            className="btn btn-primary flex-[1.4]"
          >
            {nextLabel}
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
