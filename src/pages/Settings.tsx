import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, ChevronRightIcon } from '../components/Icons';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import { testConnection } from '../lib/llm';
import { cx } from '../lib/utils';
import { useApp } from '../store/AppContext';

type Status = { tone: 'ok' | 'error' | 'info'; text: string } | null;

const AI_MODES: Array<{ value: Settings['aiMode']; title: string; description: string }> = [
  {
    value: 'full',
    title: '完整辅助',
    description: 'AI 可以生成文献三句话解读与研究方向，也可以拆解每日任务。',
  },
  {
    value: 'tasks-only',
    title: '仅任务规划 · 严格',
    description: 'AI 不参与解读与方向生成；第 3 步完全由你完成，只在第 4 步拆解任务。',
  },
];

export function SettingsPage() {
  const { settings, saveSettings } = useApp();
  const [form, setForm] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    saveSettings({
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      aiMode: form.aiMode,
    });
    setSaved(true);
    setStatus({ tone: 'ok', text: '已保存到本机浏览器。' });
    window.setTimeout(() => setSaved(false), 2200);
  }

  async function handleTest() {
    setTesting(true);
    setStatus(null);
    try {
      const reply = await testConnection({
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey.trim(),
        model: form.model.trim(),
        aiMode: form.aiMode,
      });
      setStatus({ tone: 'ok', text: `连接成功，模型回复：${reply}` });
    } catch (err) {
      setStatus({
        tone: 'error',
        text: err instanceof Error ? err.message : '连接失败，请检查配置。',
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="animate-rise">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-2.5 text-[30px] font-semibold leading-tight tracking-tight">设置</h1>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">
        AI 只在你点击生成时工作。没有配置也能用阶段模板。
      </p>

      <Link
        to="/extensions"
        className="mt-5 flex items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-4 shadow-card transition hover:border-ink-faint/60"
      >
        <div>
          <p className="text-[14px] font-semibold">外观与扩展</p>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            换主题、导入主题包、语言包入口
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-ink-soft">
          打开
          <ChevronRightIcon className="h-4 w-4" />
        </span>
      </Link>

      <form onSubmit={handleSave} className="mt-5 space-y-4">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold">AI 参与范围</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                作为新建课题的默认值，向导第 1 步仍可单独调整。
              </p>
            </div>
            <span className="whitespace-nowrap rounded-full bg-paper px-2.5 py-1 text-[10.5px] text-ink-faint">
              内容边界
            </span>
          </div>

          <div role="radiogroup" aria-label="AI 参与范围" className="mt-4 grid gap-2.5">
            {AI_MODES.map((mode) => {
              const active = form.aiMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update('aiMode', mode.value)}
                  className={cx(
                    'w-full rounded-2xl border p-4 text-left transition-colors',
                    active
                      ? 'border-ink/70 bg-surface shadow-card'
                      : 'border-line bg-paper/40 hover:border-ink-faint/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cx(
                        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
                        active
                          ? 'border-ink bg-ink text-paper'
                          : 'border-line bg-surface text-transparent'
                      )}
                    >
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-ink">
                        {mode.title}
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-ink-soft">
                        {mode.description}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="hint">
            严格模式下，第 3 步不会调用任何 AI，也不会生成可复制提示词；第 4 步只读取你写好的方向，不读取文献摘要。已有课题不受影响。
          </p>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold">模型接口</h2>
              <p className="mt-1 text-[12px] text-ink-faint">任意 OpenAI 兼容的 Chat Completions 接口</p>
            </div>
            <span className="whitespace-nowrap rounded-full bg-paper px-2.5 py-1 text-[10.5px] text-ink-faint">
              可选
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="baseUrl" className="label">
                API Base URL
              </label>
              <input
                id="baseUrl"
                type="url"
                value={form.baseUrl}
                onChange={(e) => update('baseUrl', e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="field"
                spellCheck={false}
                autoComplete="off"
              />
              <p className="hint">
                填写到 /v1 为止即可，不要带 /chat/completions。也可以填兼容服务或自建代理地址。
              </p>
            </div>

            <div>
              <label htmlFor="apiKey" className="label">
                API Key
              </label>
              <div className="relative">
                <input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => update('apiKey', e.target.value)}
                  placeholder="sk-…"
                  className="field pr-16"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] text-ink-faint transition hover:text-ink"
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
              <p className="hint">只保存在本机 localStorage，只会发送给你填写的接口地址。</p>
            </div>

            <div>
              <label htmlFor="model" className="label">
                模型名
              </label>
              <input
                id="model"
                type="text"
                list="model-options"
                value={form.model}
                onChange={(e) => update('model', e.target.value)}
                placeholder="gpt-4o-mini"
                className="field"
                spellCheck={false}
                autoComplete="off"
              />
              <datalist id="model-options">
                <option value="gpt-4o-mini" />
                <option value="gpt-4o" />
                <option value="gpt-4.1-mini" />
                <option value="deepseek-chat" />
                <option value="qwen-plus" />
              </datalist>
              <p className="hint">不同服务商命名不同，填对方的模型 ID 即可。</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button type="submit" className="btn btn-primary btn-sm">
              {saved ? '已保存' : '保存设置'}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="btn btn-secondary btn-sm"
            >
              {testing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-faint/40 border-t-ink" />
                  测试中…
                </>
              ) : (
                '测试连接'
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  baseUrl: DEFAULT_SETTINGS.baseUrl,
                  model: DEFAULT_SETTINGS.model,
                }))
              }
              className="btn btn-ghost btn-sm"
            >
              填入默认地址
            </button>
          </div>

          {status ? (
            <div
              role="status"
              className={cx(
                'mt-4 rounded-2xl border px-3.5 py-3 text-[12.5px] leading-relaxed',
                status.tone === 'ok' && 'border-moss/25 bg-moss-soft text-moss-deep',
                status.tone === 'error' && 'border-accent/25 bg-accent-soft text-accent-deep',
                status.tone === 'info' && 'border-line bg-paper text-ink-soft'
              )}
            >
              {status.text}
            </div>
          ) : null}

          <p className="hint mt-4">
            浏览器会直接请求这个地址。若测试提示跨域（CORS）失败，请换用允许浏览器访问的接口或代理。
          </p>
        </section>
      </form>

      <section className="mt-4 rounded-3xl border border-line/70 bg-surface/60 p-5">
        <h2 className="text-[14px] font-semibold">关于你的数据</h2>
        <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            课题、任务、笔记全部存在本机浏览器，没有账号，也不会上传到我们的服务器。
          </li>
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            只有在你点击“生成解读 / 拆解任务”时，选中的文献摘要与课题信息会发送到上方接口。
          </li>
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            换设备或清理浏览器数据后内容会丢失，重要笔记请另外备份。
          </li>
        </ul>
      </section>

      <p className="mt-7 text-center text-[11.5px] text-ink-faint">
        Study Slicer · 一次只做一小片
      </p>
    </div>
  );
}
