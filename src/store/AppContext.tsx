import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_SETTINGS,
  STAGES,
  type DailyTask,
  type Paper,
  type PersistedState,
  type Project,
  type Settings,
  type StageHistoryEntry,
} from '../types';
import { todayStr } from '../lib/date';
import { rolloverProjects } from '../lib/tasks';

const STORAGE_KEY = 'study-slicer:v1';

const EMPTY_STATE: PersistedState = {
  projects: [],
  settings: DEFAULT_SETTINGS,
  activeProjectId: null,
};

function sanitizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Project>;
  if (!p.id || !p.title || !p.stage) return null;
  return {
    id: p.id,
    title: p.title,
    stage: p.stage,
    keywords: p.keywords ?? '',
    createdAt: p.createdAt ?? new Date().toISOString(),
    papers: Array.isArray(p.papers) ? p.papers : [],
    directions: Array.isArray(p.directions) ? p.directions : [],
    aiMode: p.aiMode === 'tasks-only' ? 'tasks-only' : p.aiMode === 'full' ? 'full' : undefined,
    stageHistory: Array.isArray(p.stageHistory)
      ? p.stageHistory.filter(
          (entry): entry is StageHistoryEntry =>
            Boolean(entry) && STAGES.includes(entry.stage)
        )
      : [{ stage: p.stage, startedAt: p.createdAt ?? new Date().toISOString() }],
    dailyTasks: Array.isArray(p.dailyTasks)
      ? p.dailyTasks.map((t) => ({
          ...t,
          description: t.description ?? '',
          criteria: t.criteria ?? '',
          note: t.note ?? '',
          done: Boolean(t.done),
          // 旧任务没有阶段字段，一律归到课题当前阶段
          stage: t.stage && STAGES.includes(t.stage) ? t.stage : p.stage,
          plannedDate: t.plannedDate || undefined,
          rollovers: typeof t.rollovers === 'number' ? t.rollovers : undefined,
        }))
      : [],
  };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const projects = Array.isArray(parsed.projects)
      ? parsed.projects.map(sanitizeProject).filter((p): p is Project => Boolean(p))
      : [];
    const settings: Settings = { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) };
    if (settings.aiMode !== 'full' && settings.aiMode !== 'tasks-only') {
      settings.aiMode = 'full';
    }
    return {
      projects,
      settings,
      activeProjectId:
        parsed.activeProjectId && projects.some((p) => p.id === parsed.activeProjectId)
          ? parsed.activeProjectId
          : projects[0]?.id ?? null,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储空间不足或隐私模式，静默失败，不影响当前会话
  }
}

type ProjectPatch = Partial<Project> | ((project: Project) => Project);

interface AppContextValue {
  projects: Project[];
  settings: Settings;
  activeProjectId: string | null;
  activeProject: Project | undefined;
  createProject: (project: Project) => void;
  updateProject: (projectId: string, patch: ProjectPatch) => void;
  deleteProject: (projectId: string) => void;
  setActiveProject: (projectId: string) => void;
  updateTask: (projectId: string, taskId: string, patch: Partial<DailyTask>) => void;
  updatePaper: (projectId: string, paperId: string, patch: Partial<Paper>) => void;
  rolloverOverdue: () => void;
  saveSettings: (settings: Settings) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const timer = window.setTimeout(() => saveState(state), 250);
    return () => window.clearTimeout(timer);
  }, [state]);

  // 关闭 / 刷新页面时立刻落盘，避免最后几个字没赶上防抖
  useEffect(() => {
    const flush = () => saveState(stateRef.current);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, []);

  const createProject = useCallback((project: Project) => {
    setState((prev) => ({
      ...prev,
      projects: [project, ...prev.projects],
      activeProjectId: project.id,
    }));
  }, []);

  const updateProject = useCallback((projectId: string, patch: ProjectPatch) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => {
        if (project.id !== projectId) return project;
        return typeof patch === 'function' ? patch(project) : { ...project, ...patch };
      }),
    }));
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setState((prev) => {
      const projects = prev.projects.filter((p) => p.id !== projectId);
      const activeProjectId =
        prev.activeProjectId === projectId
          ? projects[0]?.id ?? null
          : prev.activeProjectId;
      return { ...prev, projects, activeProjectId };
    });
  }, []);

  const setActiveProject = useCallback((projectId: string) => {
    setState((prev) => ({ ...prev, activeProjectId: projectId }));
  }, []);

  const updateTask = useCallback(
    (projectId: string, taskId: string, patch: Partial<DailyTask>) => {
      updateProject(projectId, (project) => ({
        ...project,
        dailyTasks: project.dailyTasks.map((task) =>
          task.id === taskId ? { ...task, ...patch } : task
        ),
      }));
    },
    [updateProject]
  );

  const updatePaper = useCallback(
    (projectId: string, paperId: string, patch: Partial<Paper>) => {
      updateProject(projectId, (project) => ({
        ...project,
        papers: project.papers.map((paper) =>
          paper.id === paperId ? { ...paper, ...patch } : paper
        ),
      }));
    },
    [updateProject]
  );

  /** 每天打开应用时，把过期未完成任务顺延到今天，而不是让它们消失 */
  const rolloverOverdue = useCallback(() => {
    setState((prev) => {
      const result = rolloverProjects(prev.projects, todayStr());
      return result.moved ? { ...prev, projects: result.projects } : prev;
    });
  }, []);

  // 启动、切回页面、跨过零点时都检查一次顺延
  useEffect(() => {
    rolloverOverdue();
    const check = () => rolloverOverdue();
    const timer = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [rolloverOverdue]);

  const saveSettings = useCallback((settings: Settings) => {
    setState((prev) => ({ ...prev, settings }));
  }, []);

  const activeProject = useMemo(() => {
    return (
      state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0]
    );
  }, [state.projects, state.activeProjectId]);

  const value = useMemo<AppContextValue>(
    () => ({
      projects: state.projects,
      settings: state.settings,
      activeProjectId: activeProject?.id ?? null,
      activeProject,
      createProject,
      updateProject,
      deleteProject,
      setActiveProject,
      updateTask,
      updatePaper,
      rolloverOverdue,
      saveSettings,
    }),
    [
      state.projects,
      state.settings,
      activeProject,
      createProject,
      updateProject,
      deleteProject,
      setActiveProject,
      updateTask,
      updatePaper,
      rolloverOverdue,
      saveSettings,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用');
  return ctx;
}
