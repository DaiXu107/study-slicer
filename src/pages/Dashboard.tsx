import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Confetti } from '../components/Confetti';
import { EmptyState } from '../components/EmptyState';
import {
  ArrowRightIcon,
  PlusIcon,
  ShieldIcon,
  SparklesIcon,
  SunIcon,
} from '../components/Icons';
import { StageBadge } from '../components/StageBadge';
import { TaskCard } from '../components/TaskCard';
import type { DailyTask } from '../types';
import {
  addDays,
  calcStreak,
  formatDateCN,
  todayStr,
  weekStats,
  weekdayCN,
} from '../lib/date';
import { cx } from '../lib/utils';
import { useApp } from '../store/AppContext';

function Stat({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-[11px] tracking-wider text-ink-faint">{label}</p>
      <p className="mt-1.5 font-display text-[26px] leading-none text-ink">
        {value}
        {unit ? <span className="ml-1 text-[12px] text-ink-soft">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-1.5 text-[10.5px] text-ink-faint">{sub}</p> : <div className="mt-1.5 h-[14px]" />}
    </div>
  );
}

export function Dashboard() {
  const { projects, activeProject, setActiveProject, updateTask } = useApp();
  const [burst, setBurst] = useState(0);

  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const tasks = activeProject?.dailyTasks ?? [];
  const todays = tasks.filter((t) => t.date === today);
  const tomorrowTasks = tasks.filter((t) => t.date === tomorrow);
  const overdue = tasks
    .filter((t) => t.date < today && !t.done)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const doneToday = todays.filter((t) => t.done).length;
  const week = weekStats(tasks);
  const streak = calcStreak(tasks);
  const allDone = todays.length > 0 && doneToday === todays.length;

  function toggleTask(task: DailyTask) {
    if (!activeProject) return;
    const next = !task.done;
    updateTask(activeProject.id, task.id, {
      done: next,
      completedAt: next ? new Date().toISOString() : undefined,
    });
    if (next) setBurst((n) => n + 1);
  }

  if (!activeProject) {
    return (
      <div className="animate-rise">
        <p className="eyebrow">
          {formatDateCN(today)} · {weekdayCN(today)}
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.15] tracking-tight">
          把大课题，
          <br />
          切成今天的一小片。
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
          不用一次想清楚全部。先选一个课题，读几篇文献，然后今天只做一小块。
        </p>

        <div className="mt-8">
          <EmptyState
            icon={<SunIcon className="h-6 w-6" />}
            title="还没有课题"
            description="从一句你真正想弄明白的问题开始。哪怕还很粗糙，也没关系。"
            action={
              <Link to="/wizard" className="btn btn-primary">
                开始拆解课题
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            }
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ['01', '设定课题', '标题 + 当前阶段'],
            ['02', '选文献与方向', 'AI 帮读，你来判断'],
            ['03', '每天一小块', '45 分钟内可完成'],
          ].map(([num, title, desc]) => (
            <div key={num} className="rounded-2xl border border-line/70 bg-white/60 px-4 py-3">
              <p className="font-display text-[12px] text-accent">{num}</p>
              <p className="mt-1 text-[13.5px] font-medium">{title}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <Confetti burst={burst} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {formatDateCN(today)} · {weekdayCN(today)}
          </p>
          <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight">
            {allDone ? '今天做完啦。' : '今天也向前一点。'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] text-ink-soft">{activeProject.title}</span>
            <StageBadge stage={activeProject.stage} />
            {activeProject.aiMode === 'tasks-only' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-moss-soft px-2 py-0.5 text-[10px] font-medium text-moss-deep">
                <ShieldIcon className="h-3 w-3" />
                AI 仅规划
              </span>
            ) : null}
          </div>
        </div>
        <Link
          to="/wizard"
          aria-label="新建课题"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-ink-faint/60 active:scale-95"
        >
          <PlusIcon className="h-5 w-5" />
        </Link>
      </div>

      {projects.length > 1 ? (
        <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveProject(p.id)}
              className={cx('chip max-w-[70vw]', p.id === activeProject.id && 'chip-active')}
            >
              <span className="truncate">{p.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-3 divide-x divide-line rounded-3xl border border-line bg-white shadow-card">
        <Stat
          label="今日"
          value={todays.length ? `${doneToday}/${todays.length}` : '—'}
          sub={todays.length ? '块任务' : '留白'}
        />
        <Stat label="连续" value={String(streak)} unit="天" sub={streak > 0 ? '保持节奏' : '从今天开始'} />
        <Stat
          label="本周"
          value={week.rate === null ? '—' : `${week.rate}%`}
          sub={week.total ? `${week.done}/${week.total} 块` : '本周暂无任务'}
        />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-[19px] font-semibold tracking-tight">今日切片</h2>
          {todays.length ? (
            <span className="text-[12px] text-ink-faint">
              {doneToday} / {todays.length} 完成
            </span>
          ) : null}
        </div>

        {todays.length ? (
          <div className="space-y-3">
            {todays.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task)}
                onPatch={(patch) => updateTask(activeProject.id, task.id, patch)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            icon={<SunIcon className="h-4 w-4" />}
            title="今天没有安排"
            description="休息，或者补上之前没做完的一小块。都算前进。"
          />
        )}

        {allDone ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-moss-deep">
            <SparklesIcon className="h-4 w-4" />
            今天可以安心收工了。剩下的明天再说。
          </p>
        ) : null}
      </section>

      {!todays.length && overdue.length ? (
        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-[13px] font-medium tracking-wide text-ink-soft">可以补的</h2>
            <span className="text-[11px] text-ink-faint">补一块也算数</span>
          </div>
          <div className="space-y-3">
            {overdue.slice(0, 4).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                showDate
                onToggle={() => toggleTask(task)}
                onPatch={(patch) => updateTask(activeProject.id, task.id, patch)}
              />
            ))}
          </div>
          {overdue.length > 4 ? (
            <p className="mt-3 text-center text-[11.5px] text-ink-faint">
              还有 {overdue.length - 4} 块没补，不急。
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8 pb-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[13px] font-medium tracking-wide text-ink-soft">明日预告</h2>
          <span className="text-[11px] text-ink-faint">提前知道，就不慌</span>
        </div>
        <div className="rounded-3xl border border-dashed border-line bg-white/50 px-5 py-4">
          {tomorrowTasks.length ? (
            <ul className="space-y-2.5">
              {tomorrowTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2.5 text-[13.5px] text-ink-soft">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                  <span className="min-w-0 flex-1">{t.title}</span>
                  {typeof t.minutes === 'number' ? (
                    <span className="shrink-0 text-[11px] text-ink-faint">{t.minutes} 分钟</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-ink-faint">
              明天也空着。留给大脑一点白，也是一种安排。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
