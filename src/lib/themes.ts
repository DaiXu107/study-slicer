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
    id: 'ocean',
    name: '雪花',
    description: '雪花蓝：清透冰蓝底色，配细碎雪花纹理，安静但不单调。',
    author: 'Study Slicer',
    colorScheme: 'light',
    builtIn: true,
    tokens: {
      paper: '#e6eef5',
      surface: '#f9fcff',
      done: '#dbe8f2',
      ink: '#293845',
      inkSoft: '#5a6b78',
      inkFaint: '#8b9aa5',
      line: '#cfdde8',
      accent: '#6f96b8',
      accentSoft: '#e3eef7',
      accentDeep: '#466c8f',
      moss: '#7ba6a0',
      mossSoft: '#e3f0ee',
      mossDeep: '#4f7974',
      sun: '#d9b878',
      glow: '#f9fcff',
    },
  },
  {
    schema: 'study-slicer-plugin',
    version: 1,
    type: 'theme',
    id: 'forest',
    name: '兰花',
    description: '兰花绿：苔绿底色，点缀兰紫与花瓣纹理，适合长时间写作。',
    author: 'Study Slicer',
    colorScheme: 'light',
    builtIn: true,
    tokens: {
      paper: '#e9eee4',
      surface: '#f9fbf5',
      done: '#dfe8d8',
      ink: '#2f3b32',
      inkSoft: '#5c6a5e',
      inkFaint: '#8b988c',
      line: '#d4decd',
      accent: '#8a6f9f',
      accentSoft: '#eee6f3',
      accentDeep: '#644b78',
      moss: '#7f9b72',
      mossSoft: '#e8f0e1',
      mossDeep: '#547046',
      sun: '#c9a86f',
      glow: '#f9fbf5',
    },
  },
  {
    schema: 'study-slicer-plugin',
    version: 1,
    type: 'theme',
    id: 'lotus',
    name: '糖果',
    description: '糖果粉：草莓粉底，配薄荷绿、柠檬黄与糖果条纹。',
    author: 'Study Slicer',
    colorScheme: 'light',
    builtIn: true,
    tokens: {
      paper: '#fbe9ee',
      surface: '#fff9fb',
      done: '#f6dfe6',
      ink: '#3e2b33',
      inkSoft: '#6e5a62',
      inkFaint: '#a08e97',
      line: '#f0d3dc',
      accent: '#e06a8c',
      accentSoft: '#fde4eb',
      accentDeep: '#b23c60',
      moss: '#84bf9a',
      mossSoft: '#e6f5ea',
      mossDeep: '#578b6a',
      sun: '#f0c052',
      glow: '#fff9fb',
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

function hexToChannels(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channelsToHex(channels: [number, number, number]): string {
  return `#${channels
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** weightA 是 a 所占比例（0–1）。 */
export function mixHex(a: string, b: string, weightA: number): string {
  const weight = Math.max(0, Math.min(1, weightA));
  const ca = hexToChannels(a);
  const cb = hexToChannels(b);
  return channelsToHex([
    ca[0] * weight + cb[0] * (1 - weight),
    ca[1] * weight + cb[1] * (1 - weight),
    ca[2] * weight + cb[2] * (1 - weight),
  ]);
}

export function isDarkHex(hex: string): boolean {
  const [r, g, b] = hexToChannels(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
}

export interface ThemeBaseColors {
  paper: string;
  surface: string;
  ink: string;
  accent: string;
  moss: string;
  sun: string;
}

/** 只选 6 个基准色，其余 9 个 token 自动推导。 */
export function deriveThemeTokens(base: ThemeBaseColors): ThemeTokens {
  const dark = isDarkHex(base.paper);
  const anchor = dark ? '#ffffff' : '#000000';
  return {
    paper: base.paper,
    surface: base.surface,
    done: mixHex(base.moss, base.paper, dark ? 0.16 : 0.07),
    ink: base.ink,
    inkSoft: mixHex(base.ink, base.paper, 0.62),
    inkFaint: mixHex(base.ink, base.paper, 0.42),
    line: mixHex(base.ink, base.paper, dark ? 0.2 : 0.13),
    accent: base.accent,
    accentSoft: mixHex(base.accent, base.surface, dark ? 0.22 : 0.13),
    accentDeep: mixHex(base.accent, anchor, 0.8),
    moss: base.moss,
    mossSoft: mixHex(base.moss, base.surface, dark ? 0.22 : 0.14),
    mossDeep: mixHex(base.moss, anchor, 0.8),
    sun: base.sun,
    glow: base.surface,
  };
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
