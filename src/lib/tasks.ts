import { STAGES, type DailyTask, type Project, type Stage } from '../types';
import { addDays, todayStr } from './date';

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function nextStageOf(stage: Stage): Stage | null {
  const index = stageIndex(stage);
  return index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1] : null;
}

export function previousStageOf(stage: Stage): Stage | null {
  const index = stageIndex(stage);
  return index > 0 ? STAGES[index - 1] : null;
}

/** 把任务顺延到今天；保留最初的原定日期，方便回看。 */
export function rolloverTasks(
  tasks: DailyTask[],
  today = todayStr()
): { tasks: DailyTask[]; moved: number } {
  let moved = 0;
  const next = tasks.map((task) => {
    if (task.done || task.date >= today) return task;
    moved += 1;
    return {
      ...task,
      plannedDate: task.plannedDate ?? task.date,
      rollovers: (task.rollovers ?? 0) + 1,
      date: today,
    };
  });
  return { tasks: moved ? next : tasks, moved };
}

/** 顺延一个课题里所有过期未完成任务 */
export function rolloverProject(
  project: Project,
  today = todayStr()
): { project: Project; moved: number } {
  const { tasks, moved } = rolloverTasks(project.dailyTasks, today);
  return { project: moved ? { ...project, dailyTasks: tasks } : project, moved };
}

/** 顺延所有课题，返回新数组与顺延数量 */
export function rolloverProjects(
  projects: Project[],
  today = todayStr()
): { projects: Project[]; moved: number } {
  let moved = 0;
  const next = projects.map((project) => {
    const result = rolloverProject(project, today);
    moved += result.moved;
    return result.project;
  });
  return { projects: moved ? next : projects, moved };
}

/**
 * 切换课题阶段，并写入阶段流转记录。
 * 同一课题的所有阶段任务始终共用 project.dailyTasks，统计不会分裂。
 */
export function withStage(
  project: Project,
  next: Stage,
  at = new Date().toISOString()
): Project {
  if (project.stage === next) return project;

  const history =
    project.stageHistory?.length
      ? [...project.stageHistory]
      : [{ stage: project.stage, startedAt: project.createdAt }];
  const last = history[history.length - 1];

  if (last.stage === project.stage && !last.endedAt) {
    history[history.length - 1] = { ...last, endedAt: at };
  } else {
    history.push({ stage: project.stage, startedAt: project.createdAt, endedAt: at });
  }
  history.push({ stage: next, startedAt: at });

  return { ...project, stage: next, stageHistory: history };
}

/** 统计某个阶段的任务完成情况（用于阶段选择器） */
export function stageStats(project: Project, stage: Stage): { done: number; total: number } {
  const list = project.dailyTasks.filter((task) => (task.stage ?? project.stage) === stage);
  return { total: list.length, done: list.filter((task) => task.done).length };
}

/** 今日应显示的任务：今天 + 已经被顺延到今天的过期任务 */
export function isRolledOverToday(task: DailyTask, today = todayStr()): boolean {
  return Boolean(task.plannedDate && task.plannedDate < today && task.date === today);
}

/** 未来 14 天 + 已存在的任务日期，供日期条和拖动目标使用 */
export function planDates(
  taskDates: string[],
  today = todayStr(),
  pastDays = 7,
  futureDays = 21
): string[] {
  const set = new Set<string>();
  for (let i = -pastDays; i <= futureDays; i += 1) set.add(addDays(today, i));
  for (const date of taskDates) set.add(date);
  return Array.from(set).sort();
}
