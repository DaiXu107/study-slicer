export const THEME_TOKEN_KEYS = [
  'paper',
  'surface',
  'done',
  'ink',
  'inkSoft',
  'inkFaint',
  'line',
  'accent',
  'accentSoft',
  'accentDeep',
  'moss',
  'mossSoft',
  'mossDeep',
  'sun',
  'glow',
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
export type ThemeTokens = Record<ThemeTokenKey, string>;
export type ThemeColorScheme = 'light' | 'dark';

export interface ThemePack {
  schema: 'study-slicer-plugin';
  version: 1;
  type: 'theme';
  id: string;
  name: string;
  description?: string;
  author?: string;
  colorScheme: ThemeColorScheme;
  tokens: ThemeTokens;
  builtIn?: boolean;
}

export const THEME_STORAGE_KEY = 'study-slicer:themes:v1';
export const ACTIVE_THEME_KEY = 'study-slicer:theme:v1';

const THEME_VARS: Record<ThemeTokenKey, string> = {
  paper: '--c-paper',
  surface: '--c-surface',
  done: '--c-done',
  ink: '--c-ink',
  inkSoft: '--c-ink-soft',
  inkFaint: '--c-ink-faint',
  line: '--c-line',
  accent: '--c-accent',
  accentSoft: '--c-accent-soft',
  accentDeep: '--c-accent-deep',
  moss: '--c-moss',
  mossSoft: '--c-moss-soft',
  mossDeep: '--c-moss-deep',
  sun: '--c-sun',
  glow: '--c-glow',
};

export const BUILT_IN_THEMES: ThemePack[] = [
  {
    schema: 'study-slicer-plugin',
    version: 1,
    type: 'theme',
    id: 'paper',
    name: '纸感',
    description: '默认主题：暖纸底色、深蓝文字与一点暖橙。',
    author: 'Study Slicer',
    colorScheme: 'light',
    builtIn: true,
    tokens: {
      paper: '#f8f6f1',
      surface: '#ffffff',
      done: '#f3f6f1',
      ink: '#1c2b3a',
      inkSoft: '#536473',
      inkFaint: '#8b98a4',
      line: '#e8e3d8',
      accent: '#df7a3e',
      accentSoft: '#fbeee3',
      accentDeep: '#bf5d27',
      moss: '#6f9b78',
      mossSoft: '#edf4ee',
      mossDeep: '#527a5b',
      sun: '#f0c46a',
      glow: '#ffffff',
    },
  },
  {
    schema: 'study-slicer-plugin',
    version: 1,
    type: 'theme',
    id: 'midnight',
    name: '午夜',
    description: '低亮度深色主题，适合夜间阅读与打卡。',
    author: 'Study Slicer',
    colorScheme: 'dark',
    builtIn: true,
    tokens: {
      paper: '#0f1720',
      surface: '#18232d',
      done: '#1b2a22',
      ink: '#e9eef3',
      inkSoft: '#b3c0cb',
      inkFaint: '#7f8e9b',
      line: '#2d3b47',
      accent: '#f09a5f',
      accentSoft: '#33251c',
      accentDeep: '#ffb27a',
      moss: '#86b08e',
      mossSoft: '#1e2a22',
      mossDeep: '#a9d3b0',
      sun: '#e6c06a',
      glow: '#22303c',
    },
  },
  {
    schema: 'study-slicer-plugin',
    version: 1,
    type: 'theme',
    id: 'ocean',
    name: '海盐',
    description: '清爽的蓝绿色调，长时间阅读更安静。',
    author: 'Study Slicer',
    colorScheme: 'light',
    builtIn: true,
    tokens: {
      paper: '#f2f7f8',
      surface: '#ffffff',
      done: '#edf6f4',
      ink: '#16323a',
      inkSoft: '#4a6570',
      inkFaint: '#869ca5',
      line: '#d9e7ea',
      accent: '#2f8f9d',
      accentSoft: '#e1f2f4',
      accentDeep: '#1e6670',
      moss: '#6f9b78',
      mossSoft: '#edf4ee',
      mossDeep: '#527a5b',
      sun: '#e8b95e',
      glow: '#ffffff',
    },
  },
  {
    schema: 'study-slicer-plugin',
    version: 1,
    type: 'theme',
    id: 'forest',
    name: '森野',
    description: '柔和的草木底色，适合长时间写作。',
    author: 'Study Slicer',
    colorScheme: 'light',
    builtIn: true,
    tokens: {
      paper: '#f4f6ef',
      surface: '#ffffff',
      done: '#eef3e8',
      ink: '#243326',
      inkSoft: '#566456',
      inkFaint: '#8c978a',
      line: '#dfe5d6',
      accent: '#b06b3c',
      accentSoft: '#f6e9dd',
      accentDeep: '#8f5128',
      moss: '#5f8c68',
      mossSoft: '#e8f0e5',
      mossDeep: '#436a4b',
      sun: '#dcb75e',
      glow: '#ffffff',
    },
  },
];

export const BUILT_IN_THEME_IDS = new Set(BUILT_IN_THEMES.map((theme) => theme.id));
export const DEFAULT_THEME = BUILT_IN_THEMES[0];

function cleanLabel(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

export function hexToRgbTriplet(hex: string): string {
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

export interface ThemeParseResult {
  theme?: ThemePack;
  error?: string;
}

/** 只接受声明式 token，不允许任何脚本或 CSS 片段。 */
export function parseThemePack(raw: unknown): ThemeParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: '主题包必须是一个 JSON 对象。' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== 'study-slicer-plugin') {
    return { error: '缺少 schema: "study-slicer-plugin"。' };
  }
  if (obj.version !== 1) {
    return { error: '只支持 version: 1。' };
  }
  if (obj.type !== 'theme') {
    return { error: 'type 必须是 "theme"。' };
  }

  const id = typeof obj.id === 'string' ? obj.id.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) {
    return { error: 'id 只能用小写字母、数字和连字符，长度 2–41。' };
  }
  if (BUILT_IN_THEME_IDS.has(id)) {
    return { error: 'id 与内置主题冲突，请换一个名字。' };
  }

  const name = cleanLabel(obj.name, 40);
  if (!name) return { error: 'name 必填，最多 40 字。' };

  const rawTokens = obj.tokens;
  if (!rawTokens || typeof rawTokens !== 'object' || Array.isArray(rawTokens)) {
    return { error: '缺少 tokens 对象。' };
  }

  const tokens = {} as ThemeTokens;
  for (const key of THEME_TOKEN_KEYS) {
    const value = (rawTokens as Record<string, unknown>)[key];
    if (!isHex(value)) {
      return { error: `tokens.${key} 必须是 #RRGGBB 格式的颜色。` };
    }
    tokens[key] = value.trim();
  }

  const description = cleanLabel(obj.description, 200);
  const author = cleanLabel(obj.author, 60);

  return {
    theme: {
      schema: 'study-slicer-plugin',
      version: 1,
      type: 'theme',
      id,
      name,
      ...(description ? { description } : {}),
      ...(author ? { author } : {}),
      colorScheme: obj.colorScheme === 'dark' ? 'dark' : 'light',
      tokens,
      builtIn: false,
    },
  };
}

export function applyTheme(theme: ThemePack): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const key of THEME_TOKEN_KEYS) {
    root.style.setProperty(THEME_VARS[key], hexToRgbTriplet(theme.tokens[key]));
  }
  root.style.colorScheme = theme.colorScheme;
  root.dataset.theme = theme.id;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.tokens.paper);
}

export function themeTemplateJSON(): string {
  const base = BUILT_IN_THEMES[0];
  return JSON.stringify(
    {
      schema: 'study-slicer-plugin',
      version: 1,
      type: 'theme',
      id: 'my-theme',
      name: '我的主题',
      author: '你的名字',
      description: '在纸感主题的基础上改出来的自定义配色。',
      colorScheme: 'light',
      tokens: { ...base.tokens },
    },
    null,
    2
  );
}

export function loadCustomThemes(): ThemePack[] {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => parseThemePack(item).theme)
      .filter((theme): theme is ThemePack => Boolean(theme));
  } catch {
    return [];
  }
}

export function loadActiveThemeId(): string {
  try {
    return localStorage.getItem(ACTIVE_THEME_KEY) || DEFAULT_THEME.id;
  } catch {
    return DEFAULT_THEME.id;
  }
}
