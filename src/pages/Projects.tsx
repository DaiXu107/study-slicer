import { Link, useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import {
  ArrowRightIcon,
  ChevronRightIcon,
  LayersIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
} from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { StageBadge } from '../components/StageBadge';
import { formatCreatedAt } from '../lib/date';
import { useApp } from '../store/AppContext';

export function Projects() {
  const { projects, setActiveProject, deleteProject } = useApp();
  const navigate = useNavigate();

  function openProject(id: string) {
    setActiveProject(id);
    navigate('/');
  }

  function handleDelete(id: string, title: string) {
    const ok = window.confirm(
      `删除「${title}」？\n这个课题的文献、方向与打卡记录会一起消失，无法恢复。`
    );
    if (ok) deleteProject(id);
  }

  return (
    <div className="animate-rise">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Projects</p>
          <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight">
            你的课题
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-soft">每个大问题，都能切成今天的一小片。</p>
        </div>
        <Link to="/wizard" className="btn btn-primary btn-sm mt-1 shrink-0">
          <PlusIcon className="h-4 w-4" />
          新课题
        </Link>
      </div>

      {projects.length ? (
        <div className="mt-7 space-y-3">
          {projects.map((project) => {
            const total = project.dailyTasks.length;
            const done = project.dailyTasks.filter((t) => t.done).length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const selectedDirections = project.directions.filter((d) => d.selected).length;

            return (
              <article
                key={project.id}
                className="group relative rounded-3xl border border-line bg-white shadow-card transition-shadow hover:shadow-lift"
              >
                <Link
                  to="/"
                  onClick={() => setActiveProject(project.id)}
                  className="block rounded-3xl p-5 pr-14"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StageBadge stage={project.stage} />
                    {project.aiMode === 'tasks-only' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-moss-soft px-2.5 py-1 text-[10px] font-medium text-moss-deep">
                        <ShieldIcon className="h-3 w-3" />
                        AI 仅规划
                      </span>
                    ) : null}
                    <span className="text-[11px] text-ink-faint">
                      {formatCreatedAt(project.createdAt)} 开始
                    </span>
                  </div>

                  <h2 className="mt-2.5 text-[19px] font-semibold leading-snug tracking-tight text-ink">
                    {project.title}
                  </h2>

                  {project.keywords ? (
                    <p className="mt-1 line-clamp-1 text-[12px] text-ink-faint">
                      {project.keywords}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between text-[11.5px] text-ink-faint">
                    <span>{total ? `${done} / ${total} 块任务` : '还没有每日任务'}</span>
                    <span className="font-display text-[13px] text-ink-soft">
                      {total ? `${pct}%` : '—'}
                    </span>
                  </div>
                  <ProgressBar value={pct} className="mt-2" />

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11.5px] text-ink-faint">
                      {selectedDirections
                        ? `已选 ${selectedDirections} 个研究方向`
                        : `${project.papers.length} 篇文献`}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft">
                      继续
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => handleDelete(project.id, project.title)}
                  aria-label={`删除课题：${project.title}`}
                  className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-ink-faint/70 transition hover:bg-accent-soft hover:text-accent-deep"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={<LayersIcon className="h-6 w-6" />}
            title="这里还空着"
            description="没有关系，空白的下一页最适合开始。把最近让你好奇的那个问题写下来吧。"
            action={
              <Link to="/wizard" className="btn btn-primary">
                创建第一个课题
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            }
          />
        </div>
      )}

      <p className="mt-8 text-center text-[11.5px] leading-relaxed text-ink-faint">
        所有数据保存在这台设备的浏览器里。
        <br />
        清空浏览器数据前，记得先备份重要笔记。
      </p>
    </div>
  );
}
