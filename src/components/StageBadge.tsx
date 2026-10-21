import type { Stage } from '../types';
import { cx } from '../lib/utils';

const DOTS: Record<Stage, string> = {
  文献综述: 'bg-[#6d8fa8]',
  理论框架: 'bg-accent',
  方法论设计: 'bg-[#9a7d4f]',
  数据收集: 'bg-moss',
  分析: 'bg-[#6d7fae]',
  写作: 'bg-[#a06d8a]',
};

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-line/70 bg-paper px-2.5 py-1 text-[11px] font-medium tracking-wide text-ink-soft',
        className
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', DOTS[stage] ?? 'bg-ink-faint')} />
      {stage}
    </span>
  );
}
