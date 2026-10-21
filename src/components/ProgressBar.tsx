import { cx } from '../lib/utils';

interface Props {
  value: number;
  className?: string;
  tone?: 'ink' | 'moss';
}

export function ProgressBar({ value, className, tone = 'ink' }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full bg-line/80', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx(
          'h-full rounded-full transition-all duration-500 ease-out',
          tone === 'moss' || pct >= 100 ? 'bg-moss' : 'bg-ink'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
