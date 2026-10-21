import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { BookIcon, ExternalLinkIcon, QuoteIcon } from '../components/Icons';
import type { Paper } from '../types';
import { pluralAuthors, truncate } from '../lib/utils';
import { useApp } from '../store/AppContext';

function PaperCard({
  paper,
  onChangeNote,
}: {
  paper: Paper;
  onChangeNote: (note: string) => void;
}) {
  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15.5px] font-semibold leading-snug text-ink">{paper.title}</h3>
        {paper.url ? (
          <a
            href={paper.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="打开原文"
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition hover:border-ink-faint/60 hover:text-ink"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-faint">
        <span>{pluralAuthors(paper.authors)}</span>
        <span>·</span>
        <span>{paper.year ?? '年份未知'}</span>
        {paper.citedByCount > 0 ? (
          <>
            <span>·</span>
            <span>被引 {paper.citedByCount}</span>
          </>
        ) : null}
        {paper.selected ? (
          <span className="rounded-full bg-moss-soft px-2 py-0.5 text-[10px] text-moss-deep">
            核心
          </span>
        ) : null}
        {paper.manual ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent-deep">
            手动录入
          </span>
        ) : null}
      </p>

      {paper.abstract ? (
        <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-ink-soft">
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

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[10.5px] font-medium tracking-wide text-ink-faint">
          我的笔记
        </span>
        <textarea
          value={paper.note ?? ''}
          onChange={(e) => onChangeNote(e.target.value)}
          rows={2}
          placeholder="它和我的课题有什么关系？"
          className="w-full resize-y rounded-2xl border border-line/80 bg-paper/50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint/60 focus:bg-white focus:ring-4 focus:ring-ink/5"
        />
      </label>
    </article>
  );
}

export function Library() {
  const { projects, updatePaper } = useApp();
  const withPapers = projects.filter((p) => p.papers.length > 0);
  const total = withPapers.reduce((sum, p) => sum + p.papers.length, 0);

  return (
    <div className="animate-rise">
      <p className="eyebrow">Library</p>
      <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight">文献库</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">
        {total ? `${total} 篇已拉取文献，笔记会自动保存。` : '读过的，值得留下来。'}
      </p>

      {withPapers.length ? (
        <div className="mt-7 space-y-8">
          {withPapers.map((project) => (
            <section key={project.id}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="min-w-0 truncate text-[13px] font-medium text-ink-soft">
                  {project.title}
                </h2>
                <span className="shrink-0 text-[11px] text-ink-faint">
                  {project.papers.length} 篇
                </span>
              </div>
              <div className="space-y-3">
                {project.papers.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    onChangeNote={(note) => updatePaper(project.id, paper.id, { note })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={<BookIcon className="h-6 w-6" />}
            title="文献库还空着"
            description="在课题向导里勾选的文献，会自动收进这里。也可以先收藏一篇今天读到的文章。"
            action={
              <Link to="/wizard" className="btn btn-primary">
                去检索文献
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
