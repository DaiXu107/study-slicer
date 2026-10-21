import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  TrashIcon,
  UploadIcon,
} from '../components/Icons';
import { parseThemePack, themeTemplateJSON, type ThemePack } from '../lib/themes';
import { cx } from '../lib/utils';
import { useTheme } from '../store/ThemeContext';

type Status = { tone: 'ok' | 'error' | 'info'; text: string } | null;

const LOCALE_TEMPLATE = JSON.stringify(
  {
    schema: 'study-slicer-plugin',
    version: 1,
    type: 'locale',
    id: 'en',
    name: 'English',
    locale: 'en',
    messages: {
      'nav.today': 'Today',
      'nav.projects': 'Projects',
      'nav.library': 'Library',
      'nav.settings': 'Settings',
    },
  },
  null,
  2
);

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function ThemeCard({
  theme,
  active,
  onApply,
  onRemove,
}: {
  theme: ThemePack;
  active: boolean;
  onApply: () => void;
  onRemove?: () => void;
}) {
  const swatches = [
    theme.tokens.paper,
    theme.tokens.surface,
    theme.tokens.ink,
    theme.tokens.accent,
    theme.tokens.moss,
    theme.tokens.done,
  ];

  return (
    <div
      className={cx(
        'flex flex-col rounded-3xl border p-4 transition-colors',
        active ? 'border-ink/70 bg-surface shadow-card' : 'border-line bg-surface/60'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-1.5">
          {swatches.map((color, index) => (
            <span
              key={`${color}-${index}`}
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {theme.builtIn ? (
            <span className="rounded-full bg-paper px-2 py-0.5 text-[9.5px] text-ink-faint">
              内置
            </span>
          ) : (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[9.5px] text-accent-deep">
              自定义
            </span>
          )}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`删除主题：${theme.name}`}
              className="grid h-6 w-6 place-items-center rounded-full text-ink-faint/70 transition hover:bg-accent-soft hover:text-accent-deep"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex-1">
        <h3 className="text-[15px] font-semibold text-ink">{theme.name}</h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
          {theme.description || '一个自定义主题。'}
        </p>
        <p className="mt-1.5 text-[10px] text-ink-faint">
          {theme.author || '匿名'} · {theme.colorScheme === 'dark' ? '深色' : '浅色'}
        </p>
      </div>

      <button
        type="button"
        onClick={onApply}
        disabled={active}
        className={cx(
          'mt-3 inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-[11.5px] transition',
          active
            ? 'border-line bg-paper text-ink-faint'
            : 'border-line bg-surface text-ink-soft hover:border-ink-faint/60 hover:text-ink'
        )}
      >
        {active ? (
          <>
            <CheckIcon className="h-3.5 w-3.5" />
            使用中
          </>
        ) : (
          '应用这个主题'
        )}
      </button>
    </div>
  );
}

export function Extensions() {
  const {
    themes,
    customThemes,
    activeTheme,
    setActiveTheme,
    installTheme,
    removeTheme,
  } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 64 * 1024) {
      setStatus({ tone: 'error', text: '主题包不能超过 64 KB。' });
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setStatus({ tone: 'error', text: '这个文件不是合法的 JSON。' });
      return;
    }

    const result = parseThemePack(raw);
    if (!result.theme) {
      setStatus({ tone: 'error', text: result.error || '主题包格式不正确。' });
      return;
    }

    if (
      customThemes.some((theme) => theme.id === result.theme?.id) &&
      !window.confirm(`已经有一个 id 为「${result.theme.id}」的自定义主题，覆盖它吗？`)
    ) {
      return;
    }

    installTheme(result.theme);
    setStatus({
      tone: 'ok',
      text: `已导入并应用「${result.theme.name}」。它只保存在你的浏览器里。`,
    });
  }

  function handleRemove(theme: ThemePack) {
    if (!window.confirm(`删除自定义主题「${theme.name}」？`)) return;
    removeTheme(theme.id);
    setStatus({ tone: 'info', text: `已删除「${theme.name}」。` });
  }

  return (
    <div className="animate-rise">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        返回设置
      </Link>

      <p className="eyebrow mt-5">Extensions</p>
      <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight">
        外观与扩展
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
        换一套配色，或者导入别人做的主题。扩展只在本机生效，不执行脚本。
      </p>

      <section className="card mt-7 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold">主题</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
              当前：{activeTheme.name}。主题只覆盖颜色 token，不改代码。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn btn-secondary btn-sm"
            >
              <UploadIcon className="h-3.5 w-3.5" />
              导入主题包
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText('study-slicer-theme-template.json', themeTemplateJSON())
              }
              className="btn btn-ghost btn-sm"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              模板
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void handleFile(event)}
            />
          </div>
        </div>

        {status ? (
          <div
            role="status"
            className={cx(
              'mt-4 rounded-2xl border px-3.5 py-3 text-[12px] leading-relaxed',
              status.tone === 'ok' && 'border-moss/25 bg-moss-soft text-moss-deep',
              status.tone === 'error' &&
                'border-accent/25 bg-accent-soft text-accent-deep',
              status.tone === 'info' && 'border-line bg-paper text-ink-soft'
            )}
          >
            {status.text}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              active={activeTheme.id === theme.id}
              onApply={() => {
                setActiveTheme(theme.id);
                setStatus({ tone: 'info', text: `已切换到「${theme.name}」。` });
              }}
              onRemove={
                theme.builtIn ? undefined : () => handleRemove(theme)
              }
            />
          ))}
        </div>

        <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
          自定义主题 id：{customThemes.length ? customThemes.map((t) => t.id).join('、') : '还没有'}
        </p>
      </section>

      <section className="card mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold">语言包</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">
              当前界面：简体中文
            </p>
          </div>
          <span className="rounded-full bg-paper px-2.5 py-1 text-[10px] text-ink-faint">
            格式已预留 · 下一阶段启用
          </span>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">
          完整语言切换需要把全部界面文案抽成 key。插件格式与入口已经定好，你可以先按模板准备翻译；等 i18n
          覆盖完成后，同一份语言包即可直接导入。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadText('study-slicer-locale-template.json', LOCALE_TEMPLATE)}
            className="btn btn-secondary btn-sm"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            语言包模板
          </button>
          <a
            href="https://github.com/DaiXu107/study-slicer/blob/main/docs/PLUGINS.md"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[12px] text-ink-soft underline decoration-line underline-offset-4 transition hover:text-ink"
          >
            格式文档
          </a>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-line/70 bg-surface/60 p-5">
        <h2 className="text-[14px] font-semibold">扩展安全</h2>
        <ul className="mt-2.5 space-y-2 text-[11.5px] leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            主题包只允许 15 个颜色 token（#RRGGBB），格式不对会拒绝导入。
          </li>
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            不执行 JavaScript、不注入 CSS 片段、不联网；主题只在你的浏览器里生效。
          </li>
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            API Key、课题、文献和笔记不会提供给扩展。
          </li>
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            自定义主题随时可以删除；删除当前主题会自动回到「纸感」。
          </li>
        </ul>
      </section>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-faint">
        想贡献主题？把 JSON 放到插件的 `plugins/themes/` 里，或直接在 Issue 里贴出来。
      </p>
    </div>
  );
}
