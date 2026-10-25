import type { DailyTask } from '../types';
import { formatDateCN, formatTimeCN, friendlyDate, todayStr } from '../lib/date';
import { isRolledOverToday } from '../lib/tasks';
import { cx } from '../lib/utils';
import { CheckIcon, ClockIcon, NoteIcon } from './Icons';

interface Props {
  task: DailyTask;
  onToggle: () => void;
  onPatch: (patch: Partial<DailyTask>) => void;
  showDate?: boolean;
  /** 多课题混合显示时，标出任务属于哪个课题 */
  projectTitle?: string;
}

export function TaskCard({ task, onToggle, onPatch, showDate, projectTitle }: Props) {
  const rolled = isRolledOverToday(task);

  return (
    <article
      className={cx(
        'rounded-3xl border p-5 transition-colors duration-300',
        task.done
          ? 'border-moss/25 bg-done'
          : 'border-line bg-surface shadow-card'
      )}
    >
      <div className="flex gap-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.done ? `取消完成：${task.title}` : `完成：${task.title}`}
          onClick={onToggle}
          className={cx(
            'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200',
            task.done
              ? 'border-moss bg-moss text-paper'
              : 'border-line bg-surface text-transparent hover:border-ink-faint active:scale-90'
          )}
        >
          <CheckIcon className={cx('h-4 w-4', task.done && 'animate-pop')} />
        </button>

        <div className="min-w-0 flex-1">
          {showDate ? (
            <p className="mb-1 text-[11px] font-medium tracking-wide text-accent-deep">
              {friendlyDate(task.date)}
            </p>
          ) : null}

          {projectTitle ? (
            <span className="mb-1.5 inline-flex max-w-full truncate rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-deep">
              {projectTitle}
            </span>
          ) : null}

          {rolled && task.plannedDate ? (
            <p className="mb-1 text-[10.5px] text-accent-deep">
              顺延自 {formatDateCN(task.plannedDate)}
              {task.rollovers && task.rollovers > 1 ? ` · 第 ${task.rollovers} 次` : ''}
            </p>
          ) : null}

          <h3
            className={cx(
              'text-[17px] font-semibold leading-snug transition-colors',
              task.done ? 'text-ink-faint line-through decoration-1' : 'text-ink'
            )}
          >
            {task.title || '未命名任务'}
          </h3>

          {task.description ? (
            <p
              className={cx(
                'mt-1.5 text-[13.5px] leading-relaxed',
                task.done ? 'text-ink-faint/80' : 'text-ink-soft'
              )}
            >
              {task.description}
            </p>
          ) : null}

          {task.criteria ? (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-paper/80 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink-soft">
              <CheckIcon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-moss-deep" />
              <span>
                <span className="text-ink-faint">完成标准：</span>
                {task.criteria}
              </span>
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-faint">
            {typeof task.minutes === 'number' ? (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5" />约 {task.minutes} 分钟
              </span>
            ) : null}
            {task.done && task.completedAt ? (
              <span className="text-moss-deep">{formatTimeCN(task.completedAt)} 完成</span>
            ) : null}
          </div>

          <label className="mt-3 flex items-center gap-2 border-b border-line/70 pb-1.5 focus-within:border-ink-faint">
            <NoteIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
            <input
              value={task.note}
              onChange={(e) => onPatch({ note: e.target.value })}
              placeholder="写一句笔记，留给明天的自己…"
              aria-label="任务笔记"
              className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-faint/70 focus:outline-none"
            />
          </label>
        </div>
      </div>
    </article>
  );
}
