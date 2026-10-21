export type Stage =
  | '文献综述'
  | '理论框架'
  | '方法论设计'
  | '数据收集'
  | '分析'
  | '写作';

export const STAGES: Stage[] = [
  '文献综述',
  '理论框架',
  '方法论设计',
  '数据收集',
  '分析',
  '写作',
];

export type Feasibility = '高' | '中' | '低';

/**
 * full：AI 可生成文献解读与研究方向
 * tasks-only：严格模式，AI 不参与内容创作，只在第 4 步拆解用户写好的方向
 */
export type AiMode = 'full' | 'tasks-only';

export interface Paper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  year: number | null;
  url: string;
  citedByCount: number;
  /** 期刊 / 来源名称，用于生成参考文献 */
  journal?: string;
  /** 裸 DOI，不带 https://doi.org/ 前缀 */
  doi?: string;
  volume?: string;
  issue?: string;
  /** 起止页码，例如 45-67 */
  pages?: string;
  /** AI 或用户写下的三句话解读 */
  interpretation?: string;
  /** 阅读笔记 */
  note?: string;
  /** 是否是用户手动录入 */
  manual?: boolean;
  /** 是否是用户在向导里勾选的核心文献 */
  selected?: boolean;
}

export interface Direction {
  id: string;
  title: string;
  description: string;
  feasibility: Feasibility;
  selected: boolean;
}

export interface DailyTask {
  id: string;
  /** YYYY-MM-DD（本地时区） */
  date: string;
  title: string;
  description: string;
  /** 完成标准，一句话说清“做到什么算完成” */
  criteria: string;
  /** 预计分钟数，建议 ≤ 45 */
  minutes?: number;
  linkedDirectionId?: string;
  done: boolean;
  /** ISO 时间戳 */
  completedAt?: string;
  note: string;
}

export interface Project {
  id: string;
  title: string;
  stage: Stage;
  keywords?: string;
  createdAt: string;
  papers: Paper[];
  directions: Direction[];
  dailyTasks: DailyTask[];
  /** 创建课题时使用的 AI 参与范围，用于事后追溯 */
  aiMode?: AiMode;
}

export interface Settings {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 下一次新建课题使用的 AI 参与范围 */
  aiMode: AiMode;
}

export interface PersistedState {
  projects: Project[];
  settings: Settings;
  activeProjectId: string | null;
}

export interface WizardDraft {
  step: number;
  title: string;
  stage: Stage | '';
  keywords: string;
  query: string;
  results: Paper[];
  selectedIds: string[];
  directions: Direction[];
  tasks: DailyTask[];
  /** 本次向导固定的 AI 参与范围 */
  aiMode?: AiMode;
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  aiMode: 'full',
};
