import type { Stage } from '../types';
import { cx } from '../lib/utils';

const STYLES: Record<Stage, string> = {
  文献综述: 'bg-[#edf1f4] text-[#40596b]',
  理论框架: 'bg-accent-soft text-accent-deep',
  方法论设计: 'bg-[#f2eee6] text-[#6b5a3e]',
  数据收集: 'bg-moss-soft text-moss-deep',
  分析: 'bg-[#eceff7] text-[#455a8a]',
  写作: 'bg-[#f6edf2] text-[#85506a]',
};

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide',
        STYLES[stage] ?? 'bg-line/50 text-ink-soft',
        className
      )}
    >
      {stage}
    </span>
  );
}
