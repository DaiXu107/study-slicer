import type { Paper } from '../types';
import { cx, pluralAuthors, truncate } from '../lib/utils';
import {
  BookIcon,
  ExternalLinkIcon,
  QuoteIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
} from './Icons';

interface Props {
  paper: Paper;
  strictMode: boolean;
  interpreting: boolean;
  interpretationError?: string;
  onOpen: () => void;
  onChangeNote: (note: string) => void;
  onDelete: () => void;
  onToggleStar: () => void;
  onToggleIrrelevant: () => void;
  onGenerateInterpretation: () => void;
}

export function LibraryPaperCard({
  paper,
  strictMode,
  interpreting,
  interpretationError,
  onOpen,
  onChangeNote,
  onDelete,
  onToggleStar,
  onToggleIrrelevant,
  onGenerateInterpretation,
}: Props) {
  return (
    <article
      className={cx(
        'rounded-3xl border bg-surface p-4 shadow-card transition-colors',
        paper.irrelevant ? 'border-line/60' : 'border-line'
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`从文献库移除：${paper.title}`}
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-transparent text-ink-faint/70 transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-deep"
        >
          <XIcon className="h-3 w-3" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">
              {paper.title}
            </h3>
            <button
              type="button"
              onClick={onToggleStar}
              aria-pressed={Boolean(paper.selected)}
              aria-label={paper.selected ? '取消核心文献' : '设为核心文献'}
              title={paper.selected ? '取消核心文献' : '设为核心文献'}
              className={cx(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full transition',
                paper.selected
                  ? 'text-sun hover:bg-sun/10'
                  : 'text-ink-faint/70 hover:bg-ink/5 hover:text-ink-soft'
              )}
            >
              <StarIcon filled={Boolean(paper.selected)} className="h-[17px] w-[17px]" />
            </button>
          </div>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
            <span>{pluralAuthors(paper.authors)}</span>
            <span>·</span>
            <span>{paper.year ?? '年份未知'}</span>
            {paper.journal ? (
              <>
                <span>·</span>
                <span className="max-w-[16rem] truncate">{paper.journal}</span>
              </>
            ) : null}
            {paper.citedByCount > 0 ? (
              <>
                <span>·</span>
                <span>被引 {paper.citedByCount}</span>
              </>
            ) : null}
            {!paper.read ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent-deep">
                未读
              </span>
            ) : null}
            {paper.irrelevant ? (
              <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] text-ink-faint">
                不相关
              </span>
            ) : null}
            {paper.manual ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent-deep">
                本地
              </span>
            ) : null}
          </p>

          {paper.abstract ? (
            <p className="mt-2.5 line-clamp-3 text-[12.5px] leading-relaxed text-ink-soft">
              {truncate(paper.abstract, 260)}
            </p>
          ) : null}

          {paper.interpretation ? (
            <div className="mt-3 rounded-2xl bg-accent-soft/70 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-medium tracking-wide text-accent-deep">
                <QuoteIcon className="h-3.5 w-3.5" />
                三句话解读
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                {paper.interpretation}
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10.5px] text-ink-soft transition hover:border-ink-faint/60 hover:text-ink"
            >
              <BookIcon className="h-3 w-3" />
              阅读
            </button>
            {paper.url ? (
              <a
                href={paper.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10.5px] text-ink-soft transition hover:border-ink-faint/60 hover:text-ink"
              >
                <ExternalLinkIcon className="h-3 w-3" />
                原文
              </a>
            ) : null}
            {!paper.interpretation && !strictMode ? (
              <button
                type="button"
                onClick={onGenerateInterpretation}
                disabled={interpreting}
                className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10.5px] text-ink-soft transition hover:border-ink-faint/60 hover:text-ink disabled:opacity-50"
              >
                {interpreting ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-faint/40 border-t-ink" />
                ) : (
                  <SparklesIcon className="h-3 w-3" />
                )}
                {interpreting ? '解读中…' : '三句话解读'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleIrrelevant}
              className={cx(
                'rounded-full border px-2.5 py-1 text-[10.5px] transition',
                paper.irrelevant
                  ? 'border-accent/30 bg-accent-soft text-accent-deep'
                  : 'border-line text-ink-faint hover:border-ink-faint/60 hover:text-ink-soft'
              )}
            >
              {paper.irrelevant ? '恢复相关' : '标记不相关'}
            </button>
          </div>

          {interpretationError ? (
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-accent-deep">
              {interpretationError}
            </p>
          ) : null}

          <p className="mt-3 text-[10.5px] font-medium tracking-wide text-ink-faint">
            我的笔记
          </p>
          <textarea
            value={paper.note ?? ''}
            onChange={(event) => onChangeNote(event.target.value)}
            rows={2}
            placeholder="它和我的课题有什么关系？"
            className="mt-1.5 w-full resize-y rounded-2xl border border-line/80 bg-paper/50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint/60 focus:bg-surface focus:ring-4 focus:ring-ink/5"
          />
        </div>
      </div>
    </article>
  );
}
