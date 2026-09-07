import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Web-only theme engine for the HR/Admin + Platform Owner dashboards, and
 * (via the same `useWebTheme()` shared with Worker/Supervisor's native
 * screens since the "Native Worker app reskin" pass) the whole app's glass
 * surface. Everything in `src/web/` renders on every platform now, not just
 * `Platform.OS === 'web'`; this file does not touch `src/theme.ts`, which
 * stays exactly as-is for whatever paper-theme remnants still reference it.
 *
 * Three named themes (2026-09-07), replacing the original ten-swatch-plus-
 * separate-light/dark/system-toggle system. That system let a user combine
 * any of ten accent pairs with any of three light/dark modes — thirty
 * combinations, most of them never actually designed or looked at. These
 * three are each a single, fully considered visual identity — a real
 * background treatment, ambient glow, and glass character per theme, not
 * just an accent-color swap over one shared light/dark pair — chosen from a
 * twenty-direction design-exploration pass and narrowed to three finalists,
 * per the user's own explicit pick. Picking a theme now picks its mode too:
 * there is no separate light/dark control layered on top, because these
 * aren't "a dark version and a light version of the same look" — Aurora is
 * dark by identity, Sunrise and Frost are light by identity, the way a
 * physical product finish is one thing, not a base finish plus a tint you
 * apply after.
 */

export interface WebThemeDef {
  id: string;
  label: string;
  tagline: string;
  accent: string;
  accent2: string;
  /** The mode this identity is built for — not independently choosable. */
  mode: WebMode;
}

export const WEB_THEMES: WebThemeDef[] = [
  { id: 'aurora', label: 'Aurora', tagline: 'Deep glass, violet → teal', accent: '#7C6FF0', accent2: '#33D9C4', mode: 'dark' },
  { id: 'sunrise', label: 'Sunrise', tagline: 'Airy, coral → violet mesh', accent: '#FF7A59', accent2: '#8A5CF6', mode: 'light' },
  { id: 'frost', label: 'Frost', tagline: 'Cool, ice-blue glass', accent: '#2F8FFF', accent2: '#A78BFA', mode: 'light' },
];

const DEFAULT_THEME_ID = 'aurora';

/** The paint mode a theme is built for. */
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
  /** nexus's `--warn` / `.t-warn` — amber, distinct from `bad`'s red. */
  warn: string;
  warnBg: string;
  info: string;
  infoBg: string;
  /** Tint of the live accent, for `.t-brand`-style pills and icon chips. */
  accentBg: string;
  /** The CSS `background` value for the app-level ambient glow — a radial
   * mesh of soft color blobs for the light themes, a tighter violet/teal
   * glow for Aurora. `webOnlyStyle`d by callers same as any other CSS-only
   * value; native ignores it. */
  ambient: string;
}

function themeById(id: string): WebThemeDef {
  return WEB_THEMES.find((t) => t.id === id) ?? WEB_THEMES[0];
}

/** `#RRGGBB` -> `rgba(r,g,b,a)`. Every accent above is 6-digit hex. */
function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Each theme resolves fully on its own — not "pick a light/dark base, then
 * layer an accent on top" the way the old ten-swatch system worked. Aurora,
 * Sunrise and Frost each specify their own bg/panel/border/ambient, matching
 * the three-direction proposal exactly (same hex values that were actually
 * shown and picked, not re-derived).
 */
export function resolvePalette(themeId: string): WebPalette {
  const t = themeById(themeId);
  const { accent, accent2, mode } = t;
  const dark = mode === 'dark';

  if (t.id === 'sunrise') {
    return {
      accent, accent2,
      bg: '#FCFBFA', bg2: '#FFFFFF',
      panel: 'rgba(255,255,255,0.72)', panelSolid: '#FFFFFF',
      border: 'rgba(36,31,46,0.08)',
      text: '#241F2E', muted: '#847C93', muted2: '#A79FB3',
      hover: 'rgba(36,31,46,0.05)', rowAlt: 'rgba(36,31,46,0.03)',
      good: '#0FA36B', goodBg: 'rgba(15,163,107,0.12)',
      bad: '#C23B3B', badBg: 'rgba(194,59,59,0.1)',
      warn: '#B45309', warnBg: 'rgba(180,83,9,0.1)',
      info: '#1D6FE0', infoBg: 'rgba(29,111,224,0.1)',
      accentBg: hexAlpha(accent2, 0.14),
      ambient: 'radial-gradient(900px 620px at 8% -10%, rgba(255,217,184,.55), transparent 60%), radial-gradient(820px 540px at 100% 8%, rgba(217,207,255,.5), transparent 60%), radial-gradient(700px 460px at 35% 112%, rgba(199,232,255,.45), transparent 60%)',
    };
  }
  if (t.id === 'frost') {
    return {
      accent, accent2,
      bg: '#EEF3F8', bg2: '#F5F8FB',
      panel: 'rgba(255,255,255,0.68)', panelSolid: '#FFFFFF',
      border: 'rgba(27,39,51,0.08)',
      text: '#1B2733', muted: '#7C8AA0', muted2: '#A3AFC2',
      hover: 'rgba(27,39,51,0.05)', rowAlt: 'rgba(27,39,51,0.028)',
      good: '#0B7DBF', goodBg: 'rgba(11,125,191,0.1)',
      bad: '#C23B3B', badBg: 'rgba(194,59,59,0.1)',
      warn: '#9A5B0C', warnBg: 'rgba(154,91,12,0.1)',
      info: '#1D6FE0', infoBg: 'rgba(29,111,224,0.1)',
      accentBg: hexAlpha(accent2, 0.14),
      ambient: 'radial-gradient(1000px 620px at 100% -10%, rgba(167,139,250,.18), transparent 60%)',
    };
  }
  // Aurora (also the fallback for an unrecognized id).
  return {
    accent, accent2,
    bg: '#0A0D16', bg2: '#12101E',
    panel: 'rgba(255,255,255,0.05)', panelSolid: '#171325',
    border: 'rgba(255,255,255,0.09)',
    text: '#ECEEF7', muted: '#8892B5', muted2: '#5B617F',
    hover: 'rgba(255,255,255,0.07)', rowAlt: 'rgba(255,255,255,0.03)',
    good: '#3FE0B5', goodBg: 'rgba(63,224,181,0.15)',
    bad: '#FF6B6B', badBg: 'rgba(255,107,107,0.16)',
    warn: '#FBBF71', warnBg: 'rgba(251,191,113,0.14)',
    info: '#4FA2FF', infoBg: 'rgba(79,162,255,0.16)',
    accentBg: hexAlpha(accent2, 0.16),
    ambient: 'radial-gradient(1100px 560px at 6% -12%, rgba(124,111,240,.22), transparent 60%), radial-gradient(950px 520px at 106% 8%, rgba(51,217,196,.16), transparent 55%)',
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

/**
 * `AsyncStorage` rather than `window.localStorage` directly: it already ships
 * as the Supabase session's own storage adapter (`src/lib/supabase.ts`) and
 * resolves on every platform this app runs on.
 */
const STORAGE_KEY = 'r3u-waa-web-theme';

interface StoredPrefs {
  themeId: string;
}

const DEFAULT_PREFS: StoredPrefs = { themeId: DEFAULT_THEME_ID };

async function loadStored(): Promise<StoredPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    // Back-compat: the old ten-swatch system stored ids like 'graphite' or
    // 'royalpurple' that no longer exist. Anything not one of the three
    // current ids falls back to the default rather than resolving to
    // Aurora's palette under someone else's old, now-meaningless label.
    const themeId =
      typeof parsed.themeId === 'string' && WEB_THEMES.some((t) => t.id === parsed.themeId)
        ? parsed.themeId
        : DEFAULT_THEME_ID;
    return { themeId };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface WebThemeState {
  themeId: string;
  /** Derived from the selected theme's own identity — Aurora is always
   * 'dark', Sunrise and Frost are always 'light'. Not independently set. */
  mode: WebMode;
  palette: WebPalette;
  themes: WebThemeDef[];
  setThemeId: (id: string) => void;
}

const WebThemeCtx = createContext<WebThemeState | null>(null);

export function WebThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);

  // AsyncStorage is inherently async (even its web shim), so the stored pick
  // arrives one tick after first paint — same brief default-then-settle
  // already accepted elsewhere in this app (e.g. the splash/loading screens)
  // rather than blocking first render on it.
  useEffect(() => {
    let active = true;
    loadStored().then((prefs) => {
      if (!active) return;
      setThemeIdState(prefs.themeId);
    });
    return () => {
      active = false;
    };
  }, []);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ themeId: id })).catch(() => {
      // Private-browsing, storage-full, or no-op native backends — the
      // switcher still works for this session, it just won't be remembered.
    });
  }, []);

  const palette = useMemo(() => resolvePalette(themeId), [themeId]);
  const mode: WebMode = themeById(themeId).mode;

  const value = useMemo(
    () => ({ themeId, mode, palette, themes: WEB_THEMES, setThemeId }),
    [themeId, mode, palette, setThemeId]
  );

  return <WebThemeCtx.Provider value={value}>{children}</WebThemeCtx.Provider>;
}

export function useWebTheme(): WebThemeState {
  const ctx = useContext(WebThemeCtx);
  if (!ctx) throw new Error('useWebTheme called outside WebThemeProvider');
  return ctx;
}
