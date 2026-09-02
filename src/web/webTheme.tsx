import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Web-only theme engine for the HR/Admin + Platform Owner dashboards —
 * R3U-WAA-WEB-REDESIGN.md. Everything in `src/web/` renders exclusively on
 * `Platform.OS === 'web'` (the root guard in app/_layout.tsx never lets
 * HR/Admin or Platform Owner reach native), so this is additive: it does not
 * touch `src/theme.ts`, which stays exactly as-is for the Worker/Supervisor
 * native "paper" surfaces.
 *
 * The ten named themes are `BRAND-SYSTEM.md`'s exact list — "Built-in color
 * themes... Aurora, Graphite, Ocean, Emerald, Royal Purple, Crimson,
 * Midnight, Carbon, Sapphire, Sunset". Do not add or rename entries without
 * updating that file first.
 */

export interface WebThemeDef {
  id: string;
  label: string;
  accent: string;
  accent2: string;
}

export const WEB_THEMES: WebThemeDef[] = [
  { id: 'aurora', label: 'Aurora', accent: '#6C5CE7', accent2: '#00D9C0' },
  { id: 'graphite', label: 'Graphite', accent: '#64748B', accent2: '#B8C1CE' },
  { id: 'ocean', label: 'Ocean', accent: '#2F8FFF', accent2: '#00D4FF' },
  { id: 'emerald', label: 'Emerald', accent: '#10B981', accent2: '#5CE0A8' },
  { id: 'royalpurple', label: 'Royal purple', accent: '#7C3AED', accent2: '#C084FC' },
  { id: 'crimson', label: 'Crimson', accent: '#E0384D', accent2: '#FF8A8A' },
  { id: 'midnight', label: 'Midnight', accent: '#4F5BE0', accent2: '#8CA0FF' },
  { id: 'carbon', label: 'Carbon', accent: '#787885', accent2: '#B4B4C0' },
  { id: 'sapphire', label: 'Sapphire', accent: '#1D6FE0', accent2: '#4FC8F7' },
  { id: 'sunset', label: 'Sunset', accent: '#F2762E', accent2: '#F5658F' },
];

const DEFAULT_THEME_ID = 'aurora';

export type WebMode = 'light' | 'dark';

/** Everything a component needs to paint itself; never a raw hex literal. */
export interface WebPalette {
  accent: string;
  accent2: string;
  bg: string;
  bg2: string;
  panel: string;
  panelSolid: string;
  border: string;
  text: string;
  muted: string;
  muted2: string;
  hover: string;
  rowAlt: string;
  good: string;
  goodBg: string;
  bad: string;
  badBg: string;
  info: string;
  infoBg: string;
}

function themeById(id: string): WebThemeDef {
  return WEB_THEMES.find((t) => t.id === id) ?? WEB_THEMES[0];
}

export function resolvePalette(themeId: string, mode: WebMode): WebPalette {
  const { accent, accent2 } = themeById(themeId);
  const dark = mode === 'dark';
  return {
    accent,
    accent2,
    bg: dark ? '#0B0E16' : '#EEF1FA',
    bg2: dark ? '#0E1220' : '#E7EBF7',
    panel: dark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.82)',
    panelSolid: dark ? '#141926' : '#FFFFFF',
    border: dark ? 'rgba(255,255,255,0.10)' : 'rgba(18,24,60,0.12)',
    text: dark ? '#EAEEFB' : '#151A30',
    muted: dark ? '#98A2C0' : '#5C6684',
    muted2: dark ? '#68729A' : '#8791AC',
    hover: dark ? 'rgba(255,255,255,0.07)' : 'rgba(20,30,90,0.05)',
    rowAlt: dark ? 'rgba(255,255,255,0.03)' : 'rgba(20,30,90,0.028)',
    good: dark ? '#3FC27E' : '#1F8A54',
    goodBg: dark ? 'rgba(63,194,126,0.16)' : 'rgba(31,138,84,0.12)',
    bad: dark ? '#FF6B6B' : '#C23B3B',
    badBg: dark ? 'rgba(255,107,107,0.16)' : 'rgba(194,59,59,0.1)',
    info: dark ? '#4FA2FF' : '#1D6FE0',
    infoBg: dark ? 'rgba(79,162,255,0.16)' : 'rgba(29,111,224,0.1)',
  };
}

/** `backgroundImage` etc. aren't in RN's ViewStyle, but react-native-web
 * forwards unrecognised style keys straight through to the DOM node — the
 * standard way this app can use plain CSS (blur, gradients) without a new
 * dependency. Always gate with `Platform.OS === 'web'`; these components
 * never render anywhere else, but the guard keeps the type-cast honest. */
export function webOnlyStyle(style: Record<string, unknown>): object {
  return Platform.OS === 'web' ? style : {};
}

/* ------------------------------------------------------------- Context --- */

const STORAGE_KEY = 'r3u-waa-web-theme';

function loadStored(): { themeId: string; mode: WebMode } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { themeId: DEFAULT_THEME_ID, mode: 'dark' };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { themeId: DEFAULT_THEME_ID, mode: 'dark' };
    const parsed = JSON.parse(raw);
    return {
      themeId: typeof parsed.themeId === 'string' ? parsed.themeId : DEFAULT_THEME_ID,
      mode: parsed.mode === 'light' ? 'light' : 'dark',
    };
  } catch {
    return { themeId: DEFAULT_THEME_ID, mode: 'dark' };
  }
}

interface WebThemeState {
  themeId: string;
  mode: WebMode;
  palette: WebPalette;
  themes: WebThemeDef[];
  setThemeId: (id: string) => void;
  setMode: (m: WebMode) => void;
}

const WebThemeCtx = createContext<WebThemeState | null>(null);

export function WebThemeProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(loadStored, []);
  const [themeId, setThemeIdState] = useState(initial.themeId);
  const [mode, setModeState] = useState<WebMode>(initial.mode);

  const persist = useCallback((next: { themeId: string; mode: WebMode }) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private-browsing or storage-full — the switcher still works for
        // this session, it just won't be remembered next visit.
      }
    }
  }, []);

  const setThemeId = useCallback(
    (id: string) => {
      setThemeIdState(id);
      persist({ themeId: id, mode });
    },
    [mode, persist]
  );
  const setMode = useCallback(
    (m: WebMode) => {
      setModeState(m);
      persist({ themeId, mode: m });
    },
    [themeId, persist]
  );

  const palette = useMemo(() => resolvePalette(themeId, mode), [themeId, mode]);

  const value = useMemo(
    () => ({ themeId, mode, palette, themes: WEB_THEMES, setThemeId, setMode }),
    [themeId, mode, palette, setThemeId, setMode]
  );

  return <WebThemeCtx.Provider value={value}>{children}</WebThemeCtx.Provider>;
}

export function useWebTheme(): WebThemeState {
  const ctx = useContext(WebThemeCtx);
  if (!ctx) throw new Error('useWebTheme called outside WebThemeProvider');
  return ctx;
}
