import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: Props) {
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-start gap-2 rounded-3xl border border-dashed border-line bg-surface/50 px-5 py-6'
          : 'flex flex-col items-center gap-4 rounded-4xl border border-dashed border-line bg-surface/60 px-7 py-14 text-center'
      }
    >
      {icon ? (
        <div
          className={
            compact
              ? 'grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-deep'
              : 'grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-deep'
          }
        >
          {icon}
        </div>
      ) : null}
      <div className={compact ? '' : 'space-y-2'}>
        <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-soft">{description}</p>
      </div>
      {action ? <div className={compact ? 'pt-1' : 'pt-2'}>{action}</div> : null}
    </div>
  );
}
