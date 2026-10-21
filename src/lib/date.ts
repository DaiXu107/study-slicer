import type { DailyTask } from '../types';

export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 本地时区的 YYYY-MM-DD */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function formatDateCN(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function weekdayCN(dateStr: string): string {
  return WEEKDAYS[parseDateStr(dateStr).getDay()];
}

/** “10月21日 · 周二”；今天 / 明天 / 昨天会加前缀 */
export function friendlyDate(dateStr: string, reference = todayStr()): string {
  const base = `${formatDateCN(dateStr)} · ${weekdayCN(dateStr)}`;
  if (dateStr === reference) return `今天 · ${base}`;
  if (dateStr === addDays(reference, 1)) return `明天 · ${base}`;
  if (dateStr === addDays(reference, -1)) return `昨天 · ${base}`;
  return base;
}

export function formatTimeCN(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

/** 本周（周一至周日）的任务完成率 */
export function weekStats(tasks: DailyTask[]): { done: number; total: number; rate: number | null } {
  const now = new Date();
  const day = now.getDay(); // 0 = 周日
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + offsetToMonday);
  const start = toDateStr(monday);
  const end = addDays(start, 6);

  const inWeek = tasks.filter((t) => t.date >= start && t.date <= end);
  const done = inWeek.filter((t) => t.done).length;
  return {
    done,
    total: inWeek.length,
    rate: inWeek.length ? Math.round((done / inWeek.length) * 100) : null,
  };
}

/**
 * 连续打卡天数。
 * 完成过的日期集合，以今天（今天还没完成则从昨天）为起点向前数。
 */
export function calcStreak(tasks: DailyTask[]): number {
  const days = new Set<string>();
  for (const t of tasks) {
    if (!t.done) continue;
    if (t.completedAt) {
      const d = new Date(t.completedAt);
      if (!Number.isNaN(d.getTime())) days.add(toDateStr(d));
    } else {
      days.add(t.date);
    }
  }
  if (days.size === 0) return 0;

  let cursor = todayStr();
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function sortTasksByDate(tasks: DailyTask[]): DailyTask[] {
  return [...tasks].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function groupByDate(tasks: DailyTask[]): Array<[string, DailyTask[]]> {
  const map = new Map<string, DailyTask[]>();
  for (const t of sortTasksByDate(tasks)) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return Array.from(map.entries());
}
