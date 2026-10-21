import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ACTIVE_THEME_KEY,
  BUILT_IN_THEMES,
  BUILT_IN_THEME_IDS,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  loadActiveThemeId,
  loadCustomThemes,
  type ThemePack,
} from '../lib/themes';

interface ThemeContextValue {
  themes: ThemePack[];
  customThemes: ThemePack[];
  activeTheme: ThemePack;
  setActiveTheme: (id: string) => void;
  installTheme: (theme: ThemePack) => void;
  removeTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [customThemes, setCustomThemes] = useState<ThemePack[]>(loadCustomThemes);
  const [activeId, setActiveId] = useState<string>(loadActiveThemeId);

  const themes = useMemo(
    () => [...BUILT_IN_THEMES, ...customThemes],
    [customThemes]
  );
  const activeTheme = themes.find((theme) => theme.id === activeId) ?? DEFAULT_THEME;

  const setActiveThemeId = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_THEME_KEY, id);
    } catch {
      // 忽略存储不可用
    }
  }, []);

  const setActiveTheme = useCallback(
    (id: string) => {
      if (!themes.some((theme) => theme.id === id)) return;
      setActiveThemeId(id);
    },
    [themes, setActiveThemeId]
  );

  const installTheme = useCallback(
    (theme: ThemePack) => {
      setCustomThemes((previous) => [
        ...previous.filter((item) => item.id !== theme.id),
        { ...theme, builtIn: false },
      ]);
      // 新主题在同一轮渲染后进入 themes，这里直接记录 active id
      setActiveThemeId(theme.id);
    },
    [setActiveThemeId]
  );

  const removeTheme = useCallback(
    (id: string) => {
      if (BUILT_IN_THEME_IDS.has(id)) return;
      setCustomThemes((previous) => previous.filter((theme) => theme.id !== id));
      if (activeId === id) setActiveThemeId(DEFAULT_THEME.id);
    },
    [activeId, setActiveThemeId]
  );

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(customThemes));
    } catch {
      // 忽略存储不可用
    }
  }, [customThemes]);

  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (!themes.some((theme) => theme.id === activeId)) {
      setActiveThemeId(DEFAULT_THEME.id);
    }
  }, [themes, activeId, setActiveThemeId]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themes,
      customThemes,
      activeTheme,
      setActiveTheme,
      installTheme,
      removeTheme,
    }),
    [themes, customThemes, activeTheme, setActiveTheme, installTheme, removeTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return context;
}
