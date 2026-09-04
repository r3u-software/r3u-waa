import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useWebTheme, webOnlyStyle, WEB_THEMES, WebModePref, WebPalette } from './webTheme';
import { MonitorIcon, MoonIcon, SunIcon } from '../components/icons';
import { initialsOf } from '../lib/format';
import { SignedImage } from '../components/SignedImage';
import type { WaaBucket } from '../lib/types';
import { BODY, DISPLAY, MONO, SP, T } from './nexusType';

/**
 * Presentational primitives for the HR/Admin + Platform Owner web dashboard —
 * the glass-card/enterprise-shell language from R3U-WAA-WEB-REDESIGN.md.
 * Everything here reads its colors from `useWebTheme()`, never a literal, so
 * every component repaints when the theme or light/dark mode changes.
 *
 * Type, density and control sizing come from `nexusType.ts` — the real
 * values out of `nexus-hris.html`, not approximations. The first pass at
 * that migration only restyled chrome (nav accent bar, popovers, sticky
 * headers) and left these primitives on the old mobile-ish scale: system
 * fonts, 14px-tall full-width buttons, airy card padding. Fair feedback that
 * it didn't read as the reference at all; this is the actual port.
 */

const FONT_DISPLAY = DISPLAY.bold;
const FONT_MONO = MONO.medium;

/* ---------------------------------------------------------------- Glass --- */

export function GlassCard({
  children,
  style,
  onPress,
  padding,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  /** nexus's `.card-b` is `15px 17px` — asymmetric, tighter than the 16px
   * square this used before. Callers that need the flush/no-padding variant
   * (a table inside a card) pass zeroes. */
  padding?: { y: number; x: number };
}) {
  const { palette, mode } = useWebTheme();
  const outer: ViewStyle = {
    borderRadius: SP.radius,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    ...webOnlyStyle({ boxShadow: '0 10px 40px -12px rgba(0,0,0,0.45)' }),
  };
  const inner: ViewStyle = {
    backgroundColor: palette.panel,
    paddingVertical: padding ? padding.y : SP.cardPadY,
    paddingHorizontal: padding ? padding.x : SP.cardPadX,
  };
  const content = (
    <BlurView intensity={mode === 'dark' ? 34 : 50} tint={mode} style={inner}>
      {children}
    </BlurView>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [outer, style, pressed && { opacity: 0.85 }]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[outer, style]}>{content}</View>;
}

export function GlassPanel({
  title,
  hint,
  children,
  style,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { palette } = useWebTheme();
  return (
    <GlassCard style={StyleSheet.flatten([{ padding: 18 }, style]) as ViewStyle}>
      <Text style={[T.cardTitle, { color: palette.text, marginBottom: hint ? 2 : 12 }]}>{title}</Text>
      {hint ? <Text style={[T.cardHint, { color: palette.muted, marginBottom: 12 }]}>{hint}</Text> : null}
      {children}
    </GlassCard>
  );
}

/* ------------------------------------------------------------- Metric card --- */

export function MetricCard({
  label,
  value,
  trendPct,
  direction = 'neutral',
  trendLabel,
  trendNote,
  spark,
  icon,
  iconBg,
  style,
}: {
  label: string;
  value: string;
  /** null renders "—" (no comparable prior period), not a false 0% */
  trendPct: number | null;
  direction?: 'up-good' | 'down-good' | 'neutral';
  /** Overrides the auto "+4.2%" text — e.g. "6 hires", "18 requests". */
  trendLabel?: string;
  /** Muted text after the trend figure — nexus's "vs last quarter". */
  trendNote?: string;
  /** 6-12 relative values for a tiny inline trend line. */
  spark?: number[];
  /** nexus's `.kpi .ic` — a small glyph in a tinted rounded square. */
  icon?: React.ReactNode;
  iconBg?: string;
  style?: ViewStyle;
}) {
  const { palette } = useWebTheme();
  const hasTrend = trendPct !== null;
  const positive = hasTrend && trendPct! >= 0;
  let tone: 'good' | 'bad' | 'muted' = 'muted';
  if (hasTrend && direction !== 'neutral') {
    const good = direction === 'up-good' ? positive : !positive;
    tone = good ? 'good' : 'bad';
  }
  const toneColor = tone === 'good' ? palette.good : tone === 'bad' ? palette.bad : palette.muted;
  const toneBg = tone === 'good' ? palette.goodBg : tone === 'bad' ? palette.badBg : 'transparent';
  const text =
    trendLabel ?? (hasTrend ? `${positive ? '↑' : '↓'} ${Math.abs(trendPct!).toFixed(1)}%` : '—');

  return (
    <GlassCard style={style} padding={{ y: SP.cardPadY, x: SP.cardPadX }}>
      {/* nexus's `.kpi`: a tinted icon square, then the uppercase micro-label,
          then the figure in Outfit 800 at 23px — not a mono number under a
          sentence-case label, which is what this used to be. */}
      {icon ? (
        <View
          style={{
            width: 35,
            height: 35,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconBg ?? palette.hover,
            marginBottom: 10,
          }}
        >
          {icon}
        </View>
      ) : null}
      <Text style={[T.microLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[T.kpiValue, { color: palette.text, marginTop: 3 }]}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
        <Text style={[T.kpiTrend, { color: tone === 'muted' ? palette.muted : toneColor, fontFamily: tone === 'muted' ? BODY.medium : BODY.bold }]}>
          {text}
        </Text>
        {trendNote ? <Text style={[T.kpiTrend, { color: palette.muted }]}>{trendNote}</Text> : null}
      </View>
      {spark && spark.length > 1 ? (
        <View style={{ marginTop: 9, height: 24, opacity: 0.45 }}>
          <Sparkline values={spark} color={tone === 'bad' ? palette.bad : palette.accent2} />
        </View>
      ) : null}
    </GlassCard>
  );
}

/* -------------------------------------------------------------- Charts --- */

export function Sparkline({ values, color, height = 24 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) return null;
  const w = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / span) * height;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

/** Area line chart with a faint grid and an emphasized last point. */
export function AreaChart({
  values,
  height = 150,
}: {
  values: number[];
  height?: number;
}) {
  const { palette } = useWebTheme();
  if (values.length < 2) return null;
  const w = 400;
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - ((v - min) / span) * (height - 10) - 5;
    return { x, y };
  });
  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPoints = `0,${height} ${linePoints} ${w},${height}`;
  const last = coords[coords.length - 1];
  const gridY = [0.15, 0.4, 0.65, 0.9].map((f) => height * f);

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.accent} stopOpacity={0.32} />
          <Stop offset="1" stopColor={palette.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {gridY.map((y) => (
        <Line key={y} x1={0} y1={y} x2={w} y2={y} stroke={palette.border} strokeWidth={1} />
      ))}
      <Polygon points={areaPoints} fill="url(#areaFill)" />
      <Polyline points={linePoints} fill="none" stroke={palette.accent} strokeWidth={2.5} />
      <Circle cx={last.x} cy={last.y} r={4.5} fill={palette.accent2} />
    </Svg>
  );
}

/* -------------------------------------------------------------- Buttons --- */
/* Replaces `ui.tsx`'s PrimaryButton/SecondaryButton (default orange
 * `colors.safety`) everywhere on the glass shell — that orange is the native
 * paper app's brand color, correct there, and a jarring leftover here. */

/**
 * Button sizing, straight from nexus-hris.html's `.btn` scale:
 * default `9.5px 16px` / 12.5px text, `.btn-sm` `5.5px 11px` / 11.5px,
 * `.btn-xs` `4px 9px` / 10.5px. All three are inline-sized — the reference
 * has no full-width button anywhere on a dashboard screen.
 *
 * `block` keeps the old full-width behaviour available, and stays the
 * default on purpose: these same primitives are shared with the native
 * Worker/Supervisor screens, where a full-width 44pt-tall tap target is the
 * correct call and a 24px-tall inline pill is not. Web dashboard screens
 * pass `size="sm"` (and no `block`) to get the reference's real density.
 */
export type GlassBtnSize = 'md' | 'sm' | 'xs';

const BTN_METRICS: Record<GlassBtnSize, { py: number; px: number; radius: number; text: TextStyle }> = {
  md: { py: 9.5, px: 16, radius: SP.radiusSm, text: T.btn },
  sm: { py: 5.5, px: 11, radius: 9, text: T.btnSm },
  xs: { py: 4, px: 9, radius: 8, text: T.btnXs },
};

/** The chunky full-width form button the native screens still want. */
const BLOCK_METRICS: { py: number; px: number; radius: number; text: TextStyle } = {
  py: 13,
  px: 16,
  radius: SP.radiusSm,
  text: { fontFamily: BODY.bold, fontSize: 14 },
};

export function GlassButton({
  label,
  onPress,
  disabled,
  loading,
  tone = 'accent',
  size = 'md',
  block = true,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** 'accent' is the brand gradient (the default, for the primary action on
   * a screen). 'good'/'warn' are solid semantic colors — an affirming action
   * (mark paid) or a destructive one (decline) shouldn't wear the same
   * gradient as "Save settings" does. */
  tone?: 'accent' | 'good' | 'warn';
  size?: GlassBtnSize;
  /** Full-width (default, for native forms) vs. inline (dashboard toolbars). */
  block?: boolean;
  style?: ViewStyle;
}) {
  const { palette } = useWebTheme();
  const isOff = disabled || loading;
  const m = block ? BLOCK_METRICS : BTN_METRICS[size];
  const grad: [string, string] =
    tone === 'good' ? [palette.good, palette.good] : tone === 'warn' ? [palette.bad, palette.bad] : [palette.accent, palette.accent2];
  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      style={({ pressed }) => [
        { borderRadius: m.radius, overflow: 'hidden' } as ViewStyle,
        !block && ({ alignSelf: 'flex-start' } as ViewStyle),
        isOff && { opacity: 0.55 },
        pressed && !isOff && { opacity: 0.88 },
        style,
      ]}
    >
      <ExpoLinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingVertical: m.py, paddingHorizontal: m.px, alignItems: 'center', justifyContent: 'center' }}
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[m.text, { color: '#fff' }]}>{label}</Text>}
      </ExpoLinearGradient>
    </Pressable>
  );
}

export function GlassOutlineButton({
  label,
  onPress,
  disabled,
  size = 'md',
  block = true,
  tone,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: GlassBtnSize;
  block?: boolean;
  /** nexus's `.btn-d` / `.btn-ok` — a tinted ghost button for a destructive
   * or affirming action that shouldn't carry the full gradient. */
  tone?: 'bad' | 'good';
  style?: ViewStyle;
}) {
  const { palette } = useWebTheme();
  const m = block ? BLOCK_METRICS : BTN_METRICS[size];
  const fg = tone === 'bad' ? palette.bad : tone === 'good' ? palette.good : palette.text;
  const bg = tone === 'bad' ? palette.badBg : tone === 'good' ? palette.goodBg : palette.panel;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingVertical: m.py,
          paddingHorizontal: m.px,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: m.radius,
          borderWidth: 1,
          borderColor: tone ? 'transparent' : palette.border,
          backgroundColor: bg,
        } as ViewStyle,
        !block && ({ alignSelf: 'flex-start' } as ViewStyle),
        disabled && { opacity: 0.55 },
        pressed && !disabled && { backgroundColor: palette.hover },
        style,
      ]}
    >
      <Text style={[m.text, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const s2 = StyleSheet.create({
  btnFill: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  authRoot: { flex: 1 },
  authContent: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: 22, paddingBottom: 60 },
  authBrandMark: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  authBrandMarkText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  authCard: { borderRadius: 22, padding: 22, borderWidth: 1, overflow: 'hidden' },
  glowA: { position: 'absolute', top: -140, left: -120, width: 340, height: 340, borderRadius: 999, opacity: 0.22 },
  glowB: { position: 'absolute', top: 60, right: -140, width: 300, height: 300, borderRadius: 999, opacity: 0.14 },
});

/* ---------------------------------------------------------------- Field --- */

export function GlassField({
  label,
  hint,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; hint?: string }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[T.fieldLabel, { color: palette.muted, marginBottom: 6 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.muted}
        {...props}
        style={[
          T.input,
          {
            backgroundColor: palette.hover,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 11,
            paddingHorizontal: 13,
            paddingVertical: 11,
            color: palette.text,
          },
          props.style,
        ]}
      />
      {hint ? <Text style={[T.cardHint, { color: palette.muted, marginTop: 6 }]}>{hint}</Text> : null}
    </View>
  );
}

/* ---------------------------------------------------------------- Error --- */

export function GlassErrorBanner({ message }: { message: string }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ backgroundColor: palette.badBg, borderRadius: 12, padding: 12, marginBottom: 14 }}>
      <Text style={{ color: palette.bad, fontSize: 12.5, lineHeight: 18, fontWeight: '600' }}>{message}</Text>
    </View>
  );
}

/** Full-screen gradient + glow background, used by every native Worker
 * screen (R3U-WAA-WEB-REDESIGN.md's native follow-up) — the same ambient
 * treatment as `AuthShell`, just without its centered auth-card layout,
 * since these are full scrollable content screens. */
export function GlassScreen({ children }: { children: React.ReactNode }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ExpoLinearGradient
        colors={[palette.bg, palette.bg2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill as ViewStyle}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -120, left: -100, width: 280, height: 280, borderRadius: 999, backgroundColor: palette.accent, opacity: 0.18 }}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 40, right: -120, width: 260, height: 260, borderRadius: 999, backgroundColor: palette.accent2, opacity: 0.12 }}
      />
      {children}
    </View>
  );
}

/** `GlassScreen` + the standard pull-to-refresh, safe-area-aware ScrollView
 * every top-level tab screen needs — Supervisor's Home/Roster/Team/Approvals
 * all share this exact shell (mirrors the pattern Worker's own tabs already
 * had, just not previously factored out since only one screen needed it at
 * the time). */
export function GlassPullScreen({
  children,
  loading,
  onRefresh,
}: {
  children: React.ReactNode;
  loading: boolean;
  onRefresh: () => void;
}) {
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();
  return (
    <GlassScreen>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.muted} />}
      >
        {children}
      </ScrollView>
    </GlassScreen>
  );
}

/** Icon + title/subtitle + status pill, tappable — the native equivalent of
 * `ui.tsx`'s `ListCard`, for activity feeds (punches, cash advances, leave
 * requests) on the glass canvas. */
export function GlassListRow({
  icon,
  title,
  subtitle,
  tone,
  pillLabel,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tone?: WebPillTone;
  pillLabel?: string;
  onPress?: () => void;
}) {
  const { palette } = useWebTheme();
  return (
    <GlassCard onPress={onPress} style={{ marginBottom: 9, padding: 13 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.hover, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 11.5, color: palette.muted, lineHeight: 16 }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {pillLabel ? <WebPill label={pillLabel} tone={tone} /> : null}
      </View>
    </GlassCard>
  );
}

/** Gradient-initials avatar + name (+ optional subtitle) — the "who" cell
 * every worker/supervisor-listing table or row needs. Originally local to
 * `(hr)/roster.tsx`; promoted here once Supervisor's own Roster/Team/Home
 * screens needed the exact same cell. */
export function WorkerCell({
  name,
  sub,
  photoBucket,
  photoPath,
}: {
  name: string;
  sub?: string;
  /** Pass both only once the subject is actually approved — callers decide
   * that (`status === 'complete'`), not this component. Omit either to fall
   * back to the gradient-initials mark, same as before. */
  photoBucket?: WaaBucket;
  photoPath?: string | null;
}) {
  const { palette } = useWebTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {photoBucket && photoPath ? (
        <SignedImage bucket={photoBucket} path={photoPath} size={30} radius={9} />
      ) : (
        <ExpoLinearGradient
          colors={[palette.accent, palette.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{initialsOf(name || '?')}</Text>
        </ExpoLinearGradient>
      )}
      <View style={{ minWidth: 0 }}>
        <Text style={[T.cellName, { color: palette.text }]} numberOfLines={1}>
          {name}
        </Text>
        {sub ? (
          <Text style={[T.cellSub, { color: palette.muted }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Label / big value / note panel — the login-code callout on
 * complete-profile.tsx, the dashboard-URL callout on blocked-use-web.tsx. */
export function GlassCallout({ label, value, note }: { label: string; value: string; note?: string }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ backgroundColor: palette.hover, borderRadius: 13, padding: 14, marginBottom: 16 }}>
      <Text style={{ fontSize: 10, letterSpacing: 1, color: palette.muted, fontWeight: '700', marginBottom: 5 }}>
        {label}
      </Text>
      <Text selectable style={{ fontSize: 19, color: palette.accent2, fontWeight: '700', letterSpacing: 1 }}>
        {value}
      </Text>
      {note ? <Text style={{ fontSize: 11, color: palette.muted, lineHeight: 16, marginTop: 7 }}>{note}</Text> : null}
    </View>
  );
}

/** Small centered note under the form — "New here? Ask your…", "This is the
 * only screen available until…", etc. */
export function GlassFootnote({ children }: { children: React.ReactNode }) {
  const { palette } = useWebTheme();
  return (
    <Text style={{ fontSize: 11.5, color: palette.muted, textAlign: 'center', marginTop: 16, lineHeight: 17 }}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------ Auth shell --- */
/* Shared full-screen chrome for login / change-password / complete-profile /
 * blocked-use-web: gradient background, two soft accent glow blobs, a
 * gradient brand mark, and a blurred glass card. Each of those screens is
 * wrapped in its own `WebThemeProvider` (fixed to Aurora/dark — there is no
 * session yet at that point, so no per-user theme choice to read) and
 * renders through this one implementation instead of four copies of the
 * same styling. */

export function AuthShell({
  eyebrow,
  title,
  tagline,
  brandGlyph,
  children,
}: {
  eyebrow: string;
  title: string;
  tagline: string;
  brandGlyph?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s2.authRoot, { backgroundColor: palette.bg }]}>
      <ExpoLinearGradient colors={[palette.bg, palette.bg2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill as ViewStyle} />
      <View pointerEvents="none" style={[s2.glowA, { backgroundColor: palette.accent }]} />
      <View pointerEvents="none" style={[s2.glowB, { backgroundColor: palette.accent2 }]} />

      <View style={[s2.authContent, { paddingTop: insets.top + 48 }]}>
        <ExpoLinearGradient colors={[palette.accent, palette.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s2.authBrandMark}>
          {brandGlyph ?? <Text style={s2.authBrandMarkText}>R3</Text>}
        </ExpoLinearGradient>
        <Text style={{ fontSize: 11, letterSpacing: 1.6, color: palette.muted, fontWeight: '700', textAlign: 'center' }}>
          {eyebrow}
        </Text>
        <Text style={{ fontSize: 26, fontWeight: '700', color: palette.text, textAlign: 'center', marginTop: 4 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12.5, color: palette.muted, textAlign: 'center', marginTop: 6, marginBottom: 26, lineHeight: 18, paddingHorizontal: 8 }}>
          {tagline}
        </Text>

        <View style={[s2.authCard, { borderColor: palette.border, backgroundColor: palette.panel }]}>{children}</View>
      </View>
    </View>
  );
}

/** Light / Dark / System, one pill with three segments — the platform-wide
 * appearance control BRAND-SYSTEM.md's Global experience list calls for.
 * `compact` (icons only, no label) is what fits the web dashboard's top bar;
 * the full labeled form is what the native Worker/Supervisor Profile screens
 * use in their "Appearance" section, since there's no top bar there to put
 * it in. Either way it edits the same `modePref` in `useWebTheme()`, so a
 * choice made on one surface is the choice read back on every other. */
export function ModeSwitcher({ compact = false }: { compact?: boolean }) {
  const { modePref, setModePref, palette } = useWebTheme();
  const options: { id: WebModePref; label: string; Icon: typeof SunIcon }[] = [
    { id: 'light', label: 'Light', Icon: SunIcon },
    { id: 'dark', label: 'Dark', Icon: MoonIcon },
    { id: 'system', label: 'System', Icon: MonitorIcon },
  ];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: palette.hover, borderRadius: 999, padding: 3, gap: 2 }}>
      {options.map(({ id, label, Icon }) => {
        const active = modePref === id;
        return (
          <Pressable
            key={id}
            onPress={() => setModePref(id)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: compact ? 9 : 13,
                paddingVertical: compact ? 6 : 8,
                borderRadius: 999,
                backgroundColor: active ? palette.panelSolid : 'transparent',
              },
              pressed && !active && { opacity: 0.6 },
            ]}
          >
            <Icon color={active ? palette.text : palette.muted} size={compact ? 13 : 14} />
            {!compact ? (
              <Text style={{ fontSize: 12, fontWeight: '600', color: active ? palette.text : palette.muted }}>
                {label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The ten BRAND-SYSTEM.md accent themes as tappable swatches. Real
 * `ExpoLinearGradient` per swatch rather than the `webOnlyStyle`
 * CSS-`backgroundImage` trick WebShell's original inline version used — that
 * renders nothing on native (`webOnlyStyle` returns `{}` off web), and this
 * is now shared with the native Worker/Supervisor Profile screens' own
 * Appearance section, so the swatches have to actually paint there too. */
export function ColorThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { themeId, setThemeId, palette } = useWebTheme();
  const size = compact ? 18 : 28;
  return (
    <View style={{ flexDirection: 'row', flexWrap: compact ? 'nowrap' : 'wrap', gap: compact ? 7 : 11, alignItems: 'center' }}>
      {WEB_THEMES.map((t) => {
        const on = t.id === themeId;
        return (
          <Pressable
            key={t.id}
            onPress={() => setThemeId(t.id)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
          >
            <ExpoLinearGradient
              colors={[t.accent, t.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: on ? 2.5 : 0,
                borderColor: palette.text,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------------------------------------- Chips --- */

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { palette } = useWebTheme();
  if (active) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        style={({ pressed }) => [{ borderRadius: 999, overflow: 'hidden' }, pressed && { opacity: 0.85 }]}
      >
        <ExpoLinearGradient
          colors={[palette.accent, palette.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ paddingHorizontal: 12, paddingVertical: 4.5 }}
        >
          <Text style={{ fontFamily: BODY.semibold, fontSize: 11, color: '#fff' }}>{label}</Text>
        </ExpoLinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
      style={({ pressed }) => [
        {
          paddingHorizontal: 12,
          paddingVertical: 4.5,
          borderRadius: SP.radiusPill,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.hover,
        } as ViewStyle,
        pressed ? { borderColor: palette.accent2 } : null,
      ]}
    >
      <Text style={{ fontFamily: BODY.semibold, fontSize: 11, color: palette.muted }}>{label}</Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Pill --- */

/** nexus's `.tag` variants: `t-ok`/`t-bad`/`t-warn`/`t-blue`/`t-violet`/
 * `t-mut`/`t-brand`. 'warn' and 'brand' are new here — the old four-tone set
 * had to flatten "pending" and "needs attention" into the same blue or red,
 * which is exactly the kind of thing that makes a status column read as
 * noise instead of information. */
export type WebPillTone = 'good' | 'bad' | 'warn' | 'info' | 'muted' | 'brand';

export function WebPill({ label, tone = 'muted' }: { label: string; tone?: WebPillTone }) {
  const { palette } = useWebTheme();
  const map: Record<WebPillTone, { fg: string; bg: string }> = {
    good: { fg: palette.good, bg: palette.goodBg },
    bad: { fg: palette.bad, bg: palette.badBg },
    warn: { fg: palette.warn, bg: palette.warnBg },
    info: { fg: palette.info, bg: palette.infoBg },
    muted: { fg: palette.muted, bg: palette.hover },
    brand: { fg: palette.accent2, bg: palette.accentBg },
  };
  const c = map[tone];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: SP.radiusPill, backgroundColor: c.bg }}>
      <Text style={[T.tag, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** Maps `theme.ts`'s `StatusTone` ('ok'/'pending'/'warn'/'muted' — the
 * paper-app vocabulary, still what every query/format helper returns) onto
 * `WebPillTone` for glass screens that reuse that same status logic. */
export function webToneFor(statusTone: 'ok' | 'pending' | 'warn' | 'muted'): WebPillTone {
  if (statusTone === 'ok') return 'good';
  if (statusTone === 'pending') return 'info';
  if (statusTone === 'warn') return 'bad';
  return 'muted';
}

/* ------------------------------------------------------------ Data table --- */
/* RN has no <table>; every screen in this app already fakes tabular layout
 * with flex rows (see HrDashboardNav, StatusStrip), so this follows the same
 * convention rather than reaching for raw DOM tags react-native-web can't
 * carry back to native. */

export function DataTable({
  columns,
  children,
}: {
  columns: { key: string; label: string; width?: number; align?: 'left' | 'right'; flex?: number }[];
  children: React.ReactNode;
}) {
  const { palette } = useWebTheme();
  return (
    <View style={{ backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, borderRadius: SP.radius, overflow: 'hidden' }}>
      <View
        style={[
          {
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            paddingVertical: SP.thPadY,
            backgroundColor: palette.bg2,
          },
          webOnlyStyle({ position: 'sticky', top: 0, zIndex: 2 }),
        ]}
      >
        {columns.map((c) => (
          <Text
            key={c.key}
            style={[
              T.th,
              {
                flex: c.flex ?? 1,
                width: c.width,
                paddingHorizontal: SP.cellPadX,
                color: palette.muted2,
                textAlign: c.align ?? 'left',
              },
            ]}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {children}
    </View>
  );
}

export function DataRow({
  columns,
  values,
  onPress,
  index = 0,
}: {
  columns: { key: string; width?: number; align?: 'left' | 'right'; flex?: number }[];
  values: Record<string, React.ReactNode>;
  onPress?: () => void;
  index?: number;
}) {
  const { palette } = useWebTheme();
  // nexus's `td`: 10px/14px padding, a hairline between every row, and no
  // zebra striping — the hover tint is what distinguishes rows, which reads
  // far cleaner at this density than alternating backgrounds did.
  const base: ViewStyle = {
    flexDirection: 'row',
    paddingVertical: SP.cellPadY,
    borderTopWidth: index === 0 ? 0 : 1,
    borderTopColor: palette.border,
  };
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      {...(onPress ? { onPress, style: ({ pressed }: { pressed: boolean }) => [base, pressed && { backgroundColor: palette.hover }] } : { style: base })}
    >
      {columns.map((c) => (
        <View
          key={c.key}
          style={{
            flex: c.flex ?? 1,
            width: c.width,
            paddingHorizontal: SP.cellPadX,
            justifyContent: 'center',
            alignItems: c.align === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          {typeof values[c.key] === 'string' || typeof values[c.key] === 'number' ? (
            <Text
              style={[
                c.align === 'right' ? T.figure : T.cell,
                { color: palette.text, textAlign: c.align ?? 'left' },
              ]}
            >
              {values[c.key]}
            </Text>
          ) : (
            values[c.key]
          )}
        </View>
      ))}
    </Wrap>
  );
}

/** `ui.tsx`'s `Section` paints its title in `colors.ink` — correct on the
 * paper background it was built for, invisible on this canvas's dark glass.
 * Same shape, theme-aware title/link, for every web screen that used to
 * nest content under `Section`. */
export function WebSection({
  title,
  link,
  onLinkPress,
  children,
  style,
}: {
  title: string;
  link?: string;
  onLinkPress?: () => void;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { palette } = useWebTheme();
  return (
    <View style={[{ marginBottom: 22 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={[T.cardTitle, { color: palette.text }]}>{title}</Text>
        {link ? (
          <Pressable onPress={onLinkPress} hitSlop={8}>
            <Text style={[T.bodySm, { color: palette.accent2, fontFamily: BODY.semibold }]}>{link}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* --------------------------------------------------------- Page header --- */

export function WebPageHeader({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      {eyebrow ? (
        <Text style={[T.microLabel, { color: palette.accent2, marginBottom: 6 }]}>{eyebrow}</Text>
      ) : null}
      <Text style={{ fontFamily: DISPLAY.bold, fontSize: 21, letterSpacing: -0.5, color: palette.text }}>{title}</Text>
      {sub ? <Text style={[T.bodySm, { color: palette.muted, marginTop: 3, lineHeight: 17 }]}>{sub}</Text> : null}
    </View>
  );
}

export function paletteText(palette: WebPalette) {
  return { color: palette.text };
}
