import type { Settings } from '../types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

/** 兼容用户把完整 /chat/completions 地址粘进来的情况 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
}

/**
 * 调用任意 OpenAI 兼容的 Chat Completions 接口。
 * 注意：浏览器直连需要该服务允许 CORS。
 */
export async function chatComplete(
  settings: Settings,
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error('还没有填写 API Key');
  }
  if (!settings.model.trim()) {
    throw new Error('还没有填写模型名');
  }

  const base = normalizeBaseUrl(settings.baseUrl);
  if (!/^https?:\/\//i.test(base)) {
    throw new Error('API Base URL 需要以 http:// 或 https:// 开头');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 90000);

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.model.trim(),
        messages,
        temperature: options.temperature ?? 0.4,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
    });
  } catch (err) {
    window.clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('接口等待超时了，可以稍后重试。');
    }
    throw new Error('连不上这个 API 地址，请检查 Base URL、网络或跨域设置。');
  }
  window.clearTimeout(timer);

  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } | string };
      if (typeof parsed.error === 'string') detail = parsed.error;
      else if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // 保留原始文本
    }
    throw new Error(`接口返回 ${res.status}：${detail || '未知错误'}`);
  }

  let data: {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('接口返回的内容不是 JSON，请确认这是 OpenAI 兼容接口。');
  }

  if (data.error?.message) throw new Error(data.error.message);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('接口没有返回内容，换一个模型试试。');
  return content;
}

/** 从可能带 markdown 包裹的回复里提取第一个 JSON 对象 / 数组 */
export function parseLooseJSON<T>(raw: string): T {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  let start = -1;
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart;
  else start = arrStart;

  if (start < 0) throw new Error('AI 返回的内容里没有找到 JSON。');

  const opener = text[start];
  const closer = opener === '{' ? '}' : ']';
  const end = text.lastIndexOf(closer);
  if (end <= start) throw new Error('AI 返回的 JSON 不完整。');

  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new Error('AI 返回的 JSON 格式有误，请重试一次。');
  }
}

/** 设置页的“测试连接” */
export async function testConnection(settings: Settings): Promise<string> {
  const reply = await chatComplete(
    settings,
    [
      { role: 'system', content: '你是一个连接测试助手，只回复两个字符：OK' },
      { role: 'user', content: '测试连接' },
    ],
    { temperature: 0, maxTokens: 10, timeoutMs: 30000 }
  );
  return reply.trim().slice(0, 40) || 'OK';
}
