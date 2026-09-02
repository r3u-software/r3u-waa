import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';
import { useWebTheme, webOnlyStyle, WebPalette } from './webTheme';

/**
 * Presentational primitives for the HR/Admin + Platform Owner web dashboard —
 * the glass-card/enterprise-shell language from R3U-WAA-WEB-REDESIGN.md.
 * Everything here reads its colors from `useWebTheme()`, never a literal, so
 * every component repaints when the theme or light/dark mode changes.
 */

const FONT_DISPLAY = 'System';
const FONT_MONO = 'Menlo, Consolas, monospace';

/* ---------------------------------------------------------------- Glass --- */

export function GlassCard({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { palette } = useWebTheme();
  const box: ViewStyle = {
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 15,
    padding: 16,
    ...webOnlyStyle({ backdropFilter: 'blur(14px)', boxShadow: '0 10px 30px rgba(0,0,0,0.16)' }),
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [box, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[box, style]}>{children}</View>;
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
      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: hint ? 2 : 12 }}>
        {title}
      </Text>
      {hint ? (
        <Text style={{ fontSize: 11.5, color: palette.muted, marginBottom: 12 }}>{hint}</Text>
      ) : null}
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
  spark,
  style,
}: {
  label: string;
  value: string;
  /** null renders "—" (no comparable prior period), not a false 0% */
  trendPct: number | null;
  direction?: 'up-good' | 'down-good' | 'neutral';
  /** Overrides the auto "+4.2%" text — e.g. "6 hires", "18 requests". */
  trendLabel?: string;
  /** 6-12 relative values for a tiny inline trend line. */
  spark?: number[];
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
    <GlassCard style={style}>
      <Text style={{ fontSize: 11.5, fontWeight: '600', color: palette.muted }}>{label}</Text>
      <Text
        style={{
          fontFamily: FONT_MONO,
          fontVariant: ['tabular-nums'],
          fontSize: 19,
          fontWeight: '700',
          color: palette.text,
          marginTop: 8,
          letterSpacing: -0.2,
        }}
      >
        {value}
      </Text>
      <View
        style={{
          alignSelf: 'flex-start',
          marginTop: 7,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: toneBg,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: toneColor }}>{text}</Text>
      </View>
      {spark && spark.length > 1 ? (
        <View style={{ marginTop: 9, height: 24 }}>
          <Sparkline values={spark} color={tone === 'bad' ? palette.bad : palette.good} />
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? 'transparent' : palette.border,
          backgroundColor: active ? palette.accent : palette.panel,
          ...webOnlyStyle(
            active
              ? { backgroundImage: `linear-gradient(135deg, ${palette.accent}, ${palette.accent2})` }
              : {}
          ),
        } as ViewStyle,
        pressed && !active ? { backgroundColor: palette.hover } : null,
      ]}
    >
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: active ? '#fff' : palette.muted }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- Pill --- */

export type WebPillTone = 'good' | 'bad' | 'info' | 'muted';

export function WebPill({ label, tone = 'muted' }: { label: string; tone?: WebPillTone }) {
  const { palette } = useWebTheme();
  const map: Record<WebPillTone, { fg: string; bg: string }> = {
    good: { fg: palette.good, bg: palette.goodBg },
    bad: { fg: palette.bad, bg: palette.badBg },
    info: { fg: palette.info, bg: palette.infoBg },
    muted: { fg: palette.muted, bg: palette.hover },
  };
  const c = map[tone];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: c.fg }}>{label}</Text>
    </View>
  );
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
    <View style={{ backgroundColor: palette.panelSolid, borderWidth: 1, borderColor: palette.border, borderRadius: 15, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 10, paddingHorizontal: 6 }}>
        {columns.map((c) => (
          <Text
            key={c.key}
            style={{
              flex: c.flex ?? 1,
              width: c.width,
              paddingHorizontal: 8,
              fontSize: 11.5,
              fontWeight: '700',
              color: palette.muted,
              textAlign: c.align ?? 'left',
            }}
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
  const base: ViewStyle = {
    flexDirection: 'row',
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderTopWidth: index === 0 ? 0 : 1,
    borderTopColor: palette.border,
    backgroundColor: index % 2 === 1 ? palette.rowAlt : 'transparent',
  };
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      {...(onPress ? { onPress, style: ({ pressed }: { pressed: boolean }) => [base, pressed && { backgroundColor: palette.hover }] } : { style: base })}
    >
      {columns.map((c) => (
        <View key={c.key} style={{ flex: c.flex ?? 1, width: c.width, paddingHorizontal: 8, justifyContent: 'center' }}>
          {typeof values[c.key] === 'string' || typeof values[c.key] === 'number' ? (
            <Text
              style={{
                fontSize: 12.5,
                color: palette.text,
                textAlign: c.align ?? 'left',
                fontFamily: c.align === 'right' ? FONT_MONO : undefined,
                fontVariant: c.align === 'right' ? ['tabular-nums'] : undefined,
              }}
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
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{title}</Text>
        {link ? (
          <Pressable onPress={onLinkPress} hitSlop={8}>
            <Text style={{ fontSize: 11.5, color: palette.accent, fontWeight: '600' }}>{link}</Text>
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
        <Text style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: palette.accent, fontWeight: '700', marginBottom: 6 }}>
          {eyebrow}
        </Text>
      ) : null}
      <Text style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: '700', color: palette.text }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 13, color: palette.muted, marginTop: 3 }}>{sub}</Text> : null}
    </View>
  );
}

export function paletteText(palette: WebPalette) {
  return { color: palette.text };
}
