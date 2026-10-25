import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { STAGES, type Project, type Stage } from '../types';
import { nextStageOf, stageIndex, stageStats, withStage } from '../lib/tasks';
import { useApp } from '../store/AppContext';
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, XIcon } from './Icons';
import { cx } from '../lib/utils';

interface Props {
  project: Project;
  /** 是否显示课题标题（在项目列表 / 今日页多课题时使用） */
  showTitle?: boolean;
}

/**
 * 阶段进度与「继续下一阶段」入口。
 * 选中任意阶段后，可以直接去规划任务，也可以只切换阶段。
 */
export function StageProgress({ project, showTitle }: Props) {
  const { updateProject } = useApp();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [target, setTarget] = useState<Stage>(project.stage);

  const currentIndex = stageIndex(project.stage);
  const next = nextStageOf(project.stage);

  function openPicker(initial?: Stage) {
    setTarget(initial ?? next ?? project.stage);
    setPickerOpen(true);
  }

  function planStage(stage: Stage) {
    setPickerOpen(false);
    navigate(
      `/wizard?extend=${encodeURIComponent(project.id)}&stage=${encodeURIComponent(stage)}`
    );
  }

  function switchOnly(stage: Stage) {
    updateProject(project.id, (p) => withStage(p, stage));
    setPickerOpen(false);
  }

  return (
    <>
      <div className="rounded-2xl border border-line/80 bg-surface/70 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {showTitle ? (
                <p className="min-w-0 truncate text-[12.5px] font-medium text-ink">
                  {project.title}
                </p>
              ) : null}
              <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[10px] text-paper">
                {project.stage}
              </span>
              <span className="shrink-0 text-[10.5px] text-ink-faint">
                阶段 {currentIndex + 1} / {STAGES.length}
              </span>
            </div>
            <div className="mt-2.5 flex gap-1" aria-hidden>
              {STAGES.map((stage, index) => (
                <span
                  key={stage}
                  title={stage}
                  className={cx(
                    'h-1.5 flex-1 rounded-full',
                    index < currentIndex
                      ? 'bg-moss'
                      : index === currentIndex
                        ? 'bg-ink'
                        : 'bg-line'
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => openPicker()}
              className="rounded-full px-2.5 py-2 text-[11.5px] text-ink-faint transition hover:bg-ink/5 hover:text-ink-soft"
            >
              跳过 / 切换
            </button>
            {next ? (
              <button
                type="button"
                onClick={() => planStage(next)}
                className="btn btn-primary btn-sm"
                title={`进入「${next}」并规划任务`}
              >
                下一阶段
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openPicker()}
                className="btn btn-secondary btn-sm"
              >
                最后阶段
              </button>
            )}
          </div>
        </div>
        {next ? (
          <p className="mt-2 text-[10.5px] text-ink-faint">
            下一步：{next} · 点击即可规划该阶段任务，也可以跳过
          </p>
        ) : (
          <p className="mt-2 text-[10.5px] text-ink-faint">
            已在最后一个阶段，可以回到任意阶段补任务。
          </p>
        )}
      </div>

      {pickerOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="选择课题阶段"
              className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/30 p-4 backdrop-blur-sm sm:items-center"
              onClick={() => setPickerOpen(false)}
            >
          <div
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-lift"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">STAGE</p>
                <h2 className="mt-1 text-[19px] font-semibold tracking-tight">
                  推进「{project.title}」
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                  可以直接进入下一阶段，也可以跳过一些阶段。所有阶段的打卡都算在同一个课题里。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="关闭"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition hover:bg-ink/5 hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {STAGES.map((stage, index) => {
                const stats = stageStats(project, stage);
                const isCurrent = stage === project.stage;
                const active = stage === target;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setTarget(stage)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition',
                      active
                        ? 'border-ink bg-ink/[0.04]'
                        : 'border-line bg-surface hover:border-ink-faint/60'
                    )}
                  >
                    <span
                      className={cx(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-medium',
                        index < currentIndex
                          ? 'bg-moss-soft text-moss-deep'
                          : index === currentIndex
                            ? 'bg-ink text-paper'
                            : 'bg-paper text-ink-faint'
                      )}
                    >
                      {index < currentIndex ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-ink">{stage}</span>
                        {isCurrent ? (
                          <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9.5px] text-accent-deep">
                            当前
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-ink-faint">
                        {stats.total
                          ? `${stats.done} / ${stats.total} 块任务完成`
                          : '这个阶段还没有任务'}
                      </span>
                    </span>
                    {active ? (
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => planStage(target)}
                className="btn btn-primary flex-1"
              >
                {target === project.stage ? '继续添加任务' : `规划「${target}」任务`}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              {target !== project.stage ? (
                <button
                  type="button"
                  onClick={() => switchOnly(target)}
                  className="btn btn-secondary"
                >
                  只切换阶段
                </button>
              ) : null}
            </div>
            <p className="mt-2.5 text-center text-[10.5px] text-ink-faint">
              「只切换阶段」不会生成任务，之后随时可以回来补。
            </p>
          </div>
        </div>,
            document.body
          )
        : null}
    </>
  );
}
