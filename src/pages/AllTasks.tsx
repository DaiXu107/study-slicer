import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import type { DailyTask, Project } from '../types';
import { EmptyState } from '../components/EmptyState';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  GripIcon,
  LayersIcon,
  PlusIcon,
} from '../components/Icons';
import {
  addDays,
  formatDateCN,
  formatTimeCN,
  friendlyDate,
  todayStr,
  weekdayCN,
} from '../lib/date';
import { isRolledOverToday, planDates } from '../lib/tasks';
import { cx } from '../lib/utils';
import { useApp } from '../store/AppContext';

interface Entry {
  project: Project;
  task: DailyTask;
}

interface DragState {
  projectId: string;
  taskId: string;
  title: string;
  x: number;
  y: number;
  targetDate: string | null;
}

function dateFromPoint(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y) as HTMLElement | null;
  const holder = element?.closest<HTMLElement>('[data-drop-date]');
  return holder?.dataset.dropDate ?? null;
}

function DragHandle({
  onStart,
  label,
}: {
  onStart: (x: number, y: number) => void;
  label: string;
}) {
  const timer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function clear() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    origin.current = { x: event.clientX, y: event.clientY };
    clear();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if ('vibrate' in navigator) navigator.vibrate?.(12);
      onStart(event.clientX, event.clientY);
    }, 260);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!timer.current) return;
    if (
      Math.abs(event.clientX - origin.current.x) > 9 ||
      Math.abs(event.clientY - origin.current.y) > 9
    ) {
      clear();
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clear}
      onPointerCancel={clear}
      onContextMenu={(event) => event.preventDefault()}
      className="mt-0.5 grid h-8 w-7 shrink-0 touch-none select-none place-items-center rounded-lg text-ink-faint/60 transition hover:bg-ink/5 hover:text-ink-soft active:bg-ink/10"
    >
      <GripIcon className="h-4 w-4" />
    </button>
  );
}

function TaskRow({
  entry,
  onToggle,
  onMove,
  onStartDrag,
  showProject,
}: {
  entry: Entry;
  onToggle: () => void;
  onMove: (date: string) => void;
  onStartDrag: (x: number, y: number) => void;
  showProject: boolean;
}) {
  const { task, project } = entry;
  const rolled = isRolledOverToday(task);

  return (
    <article
      className={cx(
        'flex gap-3 rounded-2xl border px-3.5 py-3 transition-colors',
        task.done ? 'border-moss/20 bg-done' : 'border-line bg-surface shadow-card'
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `取消完成：${task.title}` : `完成：${task.title}`}
        onClick={onToggle}
        className={cx(
          'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all',
          task.done
            ? 'border-moss bg-moss text-paper'
            : 'border-line bg-surface text-transparent hover:border-ink-faint active:scale-90'
        )}
      >
        <CheckIcon className={cx('h-3.5 w-3.5', task.done && 'animate-pop')} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <h3
              className={cx(
                'text-[14.5px] font-semibold leading-snug',
                task.done ? 'text-ink-faint line-through decoration-1' : 'text-ink'
              )}
            >
              {task.title || '未命名任务'}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-ink-faint">
              {showProject ? (
                <span className="max-w-[15rem] truncate rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-deep">
                  {project.title}
                </span>
              ) : null}
              {task.stage ? (
                <span className="rounded-full border border-line px-1.5 py-0.5">
                  {task.stage}
                </span>
              ) : null}
              {typeof task.minutes === 'number' ? (
                <span className="inline-flex items-center gap-0.5">
                  <ClockIcon className="h-3 w-3" />
                  {task.minutes} 分钟
                </span>
              ) : null}
              {task.done && task.completedAt ? (
                <span className="text-moss-deep">
                  {formatTimeCN(task.completedAt)} 完成
                </span>
              ) : null}
              <label
                className="relative inline-flex cursor-pointer items-center gap-0.5 rounded-full border border-line px-1.5 py-0.5 transition hover:border-ink-faint hover:text-ink-soft"
                title="选择日期改期"
              >
                <CalendarIcon className="h-3 w-3" />
                改期
                <input
                  type="date"
                  value={task.date}
                  onChange={(event) =>
                    event.target.value && onMove(event.target.value)
                  }
                  aria-label={`修改「${task.title || '未命名任务'}」的日期`}
                  style={{ minHeight: 0 }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>

          <DragHandle
            label={`长按拖动任务：${task.title || '未命名任务'}`}
            onStart={onStartDrag}
          />
        </div>

        {task.description ? (
          <p
            className={cx(
              'mt-1 line-clamp-2 text-[12px] leading-relaxed',
              task.done ? 'text-ink-faint/80' : 'text-ink-soft'
            )}
          >
            {task.description}
          </p>
        ) : null}

        {rolled && task.plannedDate ? (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-soft/70 px-2 py-0.5 text-[10px] text-accent-deep">
            顺延自 {formatDateCN(task.plannedDate)}
            {task.rollovers && task.rollovers > 1 ? ` · 第 ${task.rollovers} 次` : ''}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function AllTasks() {
  const { projects, setActiveProject, updateTask, rolloverOverdue } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hideDone, setHideDone] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const today = todayStr();
  const projectParam = searchParams.get('project');
  const scope =
    projectParam && projects.some((project) => project.id === projectParam)
      ? projectParam
      : 'all';

  const entries = useMemo(() => {
    const selected =
      scope === 'all' ? projects : projects.filter((project) => project.id === scope);
    return selected.flatMap((project) =>
      project.dailyTasks.map((task) => ({ project, task }))
    );
  }, [projects, scope]);

  const visibleEntries = useMemo(
    () => (hideDone ? entries.filter((entry) => !entry.task.done) : entries),
    [entries, hideDone]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of visibleEntries) {
      const list = map.get(entry.task.date) ?? [];
      list.push(entry);
      map.set(entry.task.date, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, list]) => [
        date,
        [...list].sort(
          (a, b) => Number(a.task.done) - Number(b.task.done)
        ),
      ]) as Array<[string, Entry[]]>;
  }, [visibleEntries]);

  const dateCounts = useMemo(() => {
    const map = new Map<string, { total: number; pending: number }>();
    for (const entry of entries) {
      const current = map.get(entry.task.date) ?? { total: 0, pending: 0 };
      current.total += 1;
      if (!entry.task.done) current.pending += 1;
      map.set(entry.task.date, current);
    }
    return map;
  }, [entries]);

  const dateStrip = useMemo(
    () => planDates(entries.map((entry) => entry.task.date), today, 3, 14),
    [entries, today]
  );

  const quickDates = useMemo(
    () => Array.from({ length: 8 }, (_, index) => addDays(today, index - 1)),
    [today]
  );

  const total = entries.length;
  const pending = entries.filter((entry) => !entry.task.done).length;
  const overdue = entries.filter(
    (entry) => !entry.task.done && entry.task.date < today
  );

  const dragging = drag !== null;
  dragRef.current = drag;

  useEffect(() => {
    if (!dragging) return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    function move(event: PointerEvent) {
      event.preventDefault();
      const current = dragRef.current;
      if (!current) return;
      const next: DragState = {
        ...current,
        x: event.clientX,
        y: event.clientY,
        targetDate: dateFromPoint(event.clientX, event.clientY),
      };
      dragRef.current = next;
      setDrag(next);
    }

    function finish() {
      const current = dragRef.current;
      if (current?.targetDate) {
        updateTask(current.projectId, current.taskId, { date: current.targetDate });
        setToast(current.targetDate);
        setFocusDate(null);
      }
      dragRef.current = null;
      setDrag(null);
    }

    function cancel() {
      dragRef.current = null;
      setDrag(null);
    }

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [dragging, updateTask]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function chooseScope(id: string) {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('project');
    else next.set('project', id);
    setSearchParams(next, { replace: true });
    if (id !== 'all') setActiveProject(id);
  }

  function startDrag(project: Project, task: DailyTask, x: number, y: number) {
    const info: DragState = {
      projectId: project.id,
      taskId: task.id,
      title: task.title || '未命名任务',
      x,
      y,
      targetDate: dateFromPoint(x, y),
    };
    dragRef.current = info;
    setDrag(info);
  }

  function toggle(projectId: string, task: DailyTask) {
    const next = !task.done;
    updateTask(projectId, task.id, {
      done: next,
      completedAt: next ? new Date().toISOString() : undefined,
    });
  }

  function jumpTo(date: string) {
    const element = document.getElementById(`day-${date}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setFocusDate(date);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (!projects.length) {
    return (
      <div className="animate-rise">
        <p className="eyebrow">Plan</p>
        <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight">
          所有任务
        </h1>
        <div className="mt-8">
          <EmptyState
            icon={<LayersIcon className="h-6 w-6" />}
            title="还没有课题"
            description="先创建一个课题，任务会按天汇总到这里，跨课题一起看。"
            action={
              <Link to="/wizard" className="btn btn-primary">
                开始拆解课题
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Plan</p>
          <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight">
            所有任务
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            所有课题的任务都在这里。长按任务右侧的手柄，拖到任意一天。
          </p>
        </div>
        <Link
          to="/wizard"
          aria-label="新建课题"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition hover:border-ink-faint/60 active:scale-95"
        >
          <PlusIcon className="h-5 w-5" />
        </Link>
      </div>

      {projects.length > 1 ? (
        <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <button
            type="button"
            onClick={() => chooseScope('all')}
            className={cx('chip', scope === 'all' && 'chip-active')}
          >
            全部课题
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => chooseScope(project.id)}
              className={cx('chip max-w-[65vw]', scope === project.id && 'chip-active')}
            >
              <span className="truncate">{project.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-faint">
        <span>
          共 {total} 块 · 待完成 {pending} 块
          {overdue.length ? ` · ${overdue.length} 块过期` : ''}
        </span>
        <div className="flex items-center gap-1.5">
          {overdue.length ? (
            <button
              type="button"
              onClick={rolloverOverdue}
              className="rounded-full border border-accent/30 px-2.5 py-1 text-[10.5px] text-accent-deep transition hover:bg-accent-soft"
            >
              全部顺延到今天
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setHideDone((value) => !value)}
            className={cx(
              'rounded-full border px-2.5 py-1 text-[10.5px] transition',
              hideDone
                ? 'border-ink bg-ink text-paper'
                : 'border-line bg-surface text-ink-soft hover:border-ink-faint'
            )}
          >
            {hideDone ? '显示已完成' : '隐藏已完成'}
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-30 -mx-5 mt-3 border-b border-line/60 bg-paper/95 px-5 py-2 backdrop-blur-md">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {dateStrip.map((date) => {
            const count = dateCounts.get(date);
            const isToday = date === today;
            const isOver = drag?.targetDate === date;
            return (
              <button
                key={date}
                type="button"
                data-drop-date={date}
                onClick={() => jumpTo(date)}
                className={cx(
                  'relative flex w-[52px] shrink-0 flex-col items-center rounded-2xl border px-1 py-1.5 transition',
                  isToday
                    ? 'border-ink bg-ink text-paper'
                    : count?.pending
                      ? 'border-line bg-surface text-ink-soft hover:border-ink-faint'
                      : 'border-transparent bg-surface/50 text-ink-faint hover:border-line',
                  isOver && 'scale-105 border-accent bg-accent-soft text-accent-deep'
                )}
              >
                <span className="text-[9.5px] opacity-70">
                  {weekdayCN(date).replace('周', '')}
                </span>
                <span className="mt-0.5 text-[14px] font-semibold leading-none">
                  {Number(date.slice(8, 10))}
                </span>
                <span
                  className={cx(
                    'mt-1 flex h-3 items-center text-[8.5px]',
                    isToday ? 'text-paper/80' : 'text-ink-faint'
                  )}
                >
                  {count
                    ? count.pending
                      ? `${count.pending} 块`
                      : '✓'
                    : '·'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[10.5px] text-ink-faint">
        日期条上的数字 = 待完成任务数。拖动时把任务放到日期条上也可以改期。
      </p>

      {focusDate && !groups.some(([date]) => date === focusDate) ? (
        <section
          data-drop-date={focusDate}
          className="mt-5 rounded-3xl border border-dashed border-line bg-surface/60 px-5 py-6 text-center"
        >
          <p className="text-[14px] font-medium text-ink">{friendlyDate(focusDate)}</p>
          <p className="mt-1.5 text-[12px] text-ink-soft">
            这天还没有任务。长按其他任务的手柄，拖到这里即可。
          </p>
          <button
            type="button"
            onClick={() => setFocusDate(null)}
            className="mt-3 text-[11.5px] text-ink-faint underline decoration-line underline-offset-4"
          >
            收起
          </button>
        </section>
      ) : null}

      {groups.length ? (
        <div className="mt-5 space-y-7">
          {groups.map(([date, list]) => {
            const dayDone = list.filter((entry) => entry.task.done).length;
            const isOver = drag?.targetDate === date;
            return (
              <section
                key={date}
                id={`day-${date}`}
                data-drop-date={date}
                className={cx(
                  'scroll-mt-24 rounded-3xl transition-colors',
                  isOver && 'bg-accent-soft/60 ring-2 ring-accent/40'
                )}
              >
                <div className="mb-2.5 flex flex-wrap items-center gap-2 px-1">
                  <h2 className="text-[13px] font-semibold tracking-wide text-ink">
                    {friendlyDate(date)}
                  </h2>
                  {date === today ? (
                    <span className="rounded-full bg-ink px-2 py-0.5 text-[9.5px] text-paper">
                      今天
                    </span>
                  ) : null}
                  <span className="text-[10.5px] text-ink-faint">
                    {dayDone} / {list.length} 完成
                  </span>
                  {isOver ? (
                    <span className="text-[10.5px] font-medium text-accent-deep">
                      松手移到这天
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2.5">
                  {list.map((entry) => (
                    <TaskRow
                      key={entry.task.id}
                      entry={entry}
                      showProject={scope === 'all'}
                      onToggle={() => toggle(entry.project.id, entry.task)}
                      onMove={(date) =>
                        updateTask(entry.project.id, entry.task.id, { date })
                      }
                      onStartDrag={(x, y) =>
                        startDrag(entry.project, entry.task, x, y)
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            compact
            icon={<CalendarIcon className="h-4 w-4" />}
            title={hideDone ? '没有未完成任务' : '还没有任务'}
            description="去课题里生成任务，或者从其他日期拖一块过来。"
          />
        </div>
      )}

      {drag
        ? createPortal(
            <>
          <div
            className="pointer-events-none fixed z-[80] w-60 -translate-x-1/2 -translate-y-1/2 rotate-1 rounded-2xl border border-ink/10 bg-surface px-3.5 py-2.5 shadow-lift"
            style={{ left: drag.x, top: drag.y }}
          >
            <p className="truncate text-[12.5px] font-semibold text-ink">{drag.title}</p>
            <p className="mt-0.5 text-[10px] text-ink-faint">
              {drag.targetDate
                ? `松手移到 ${formatDateCN(drag.targetDate)}`
                : '拖到日期条或任意一天'}
            </p>
          </div>

          <div className="fixed inset-x-0 bottom-[86px] z-[70] px-4">
            <div className="mx-auto max-w-lg rounded-3xl border border-ink/10 bg-surface/95 p-2.5 shadow-lift backdrop-blur-md">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {quickDates.map((date) => {
                  const isOver = drag.targetDate === date;
                  return (
                    <div
                      key={date}
                      data-drop-date={date}
                      className={cx(
                        'flex min-w-[62px] shrink-0 flex-col items-center rounded-2xl border px-2 py-1.5',
                        isOver
                          ? 'border-accent bg-accent-soft text-accent-deep'
                          : 'border-line bg-surface text-ink-soft'
                      )}
                    >
                      <span className="text-[9px] opacity-70">
                        {date === today ? '今天' : weekdayCN(date).replace('周', '')}
                      </span>
                      <span className="text-[13px] font-semibold leading-tight">
                        {Number(date.slice(5, 7))}/{Number(date.slice(8, 10))}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1.5 text-center text-[9.5px] text-ink-faint">
                拖到某一天松手，或拖到上方日期条 / 某天的任务区
              </p>
            </div>
          </div>
            </>,
            document.body
          )
        : null}

      {toast
        ? createPortal(
            <div className="fixed bottom-24 left-1/2 z-[75] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[11.5px] text-paper shadow-lift">
              已移到 {friendlyDate(toast)}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
