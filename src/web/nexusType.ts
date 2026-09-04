/**
 * The type + density system from `nexus-hris.html`, as real values.
 *
 * The first reskin pass against that reference only moved chrome around and
 * left the actual design language alone — same fonts, same airy mobile
 * spacing, same full-width buttons — which is why it didn't read as the
 * reference at all. This module is the missing half: the exact families,
 * sizes, weights, letter-spacings and paddings nexus-hris.html uses, in one
 * place, so every primitive in `webUi.tsx` can stop inventing its own.
 *
 * Families map to the `@expo-google-fonts` names loaded in `app/_layout.tsx`
 * — RN needs the concrete per-weight family name (`Outfit_700Bold`), not a
 * family + `fontWeight` pair, which silently does nothing on native for a
 * custom font.
 */

/** Display — headings, KPI figures, the brand wordmark. nexus: 'Outfit'. */
export const DISPLAY = {
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extrabold: 'Outfit_800ExtraBold',
} as const;

/** Body / UI text. nexus: 'Inter', 13.5px base. */
export const BODY = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Tabular figures — money, hours, counts. nexus: 'JetBrains Mono'. */
export const MONO = {
  medium: 'JetBrainsMono_500Medium',
  bold: 'JetBrainsMono_700Bold',
} as const;

/**
 * nexus's own type scale, lifted from its stylesheet rather than re-guessed.
 * The small uppercase labels (`.kpi .lb`, `th`, `label`) all share the same
 * 9.5–10px / 800 / 1.3px-tracking treatment — that tight, wide-tracked
 * micro-label is a big part of why the reference reads as "enterprise
 * dashboard" and the original screens didn't.
 */
export const T = {
  /** `.kpi .vl` — the big number on a metric card. */
  kpiValue: { fontFamily: DISPLAY.extrabold, fontSize: 23, letterSpacing: -0.6, lineHeight: 26 },
  /** `.kpi .lb` — uppercase micro-label above it. */
  microLabel: { fontFamily: BODY.bold, fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase' as const },
  /** `.kpi .tr` — the trend line under it. */
  kpiTrend: { fontFamily: BODY.medium, fontSize: 10.5 },
  /** `.card-h h3` — card titles. */
  cardTitle: { fontFamily: DISPLAY.bold, fontSize: 14, letterSpacing: -0.2 },
  /** `.card-h .hint` — the muted note beside a card title. */
  cardHint: { fontFamily: BODY.regular, fontSize: 10.5 },
  /** `.topbar h1` — page title. */
  pageTitle: { fontFamily: DISPLAY.bold, fontSize: 17.5, letterSpacing: -0.3 },
  /** `.topbar .crumb` — breadcrumb under it. */
  crumb: { fontFamily: BODY.regular, fontSize: 10.5 },
  /** `td` — table body cell. */
  cell: { fontFamily: BODY.regular, fontSize: 12.4 },
  /** `th` — table header cell. */
  th: { fontFamily: BODY.bold, fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase' as const },
  /** `.tname b` — the name in an avatar+name cell. */
  cellName: { fontFamily: BODY.semibold, fontSize: 12.5, lineHeight: 15.5 },
  /** `.tname small` — the subtitle under it. */
  cellSub: { fontFamily: BODY.regular, fontSize: 10 },
  /** `.btn` — default button label. */
  btn: { fontFamily: BODY.semibold, fontSize: 12.5 },
  btnSm: { fontFamily: BODY.semibold, fontSize: 11.5 },
  btnXs: { fontFamily: BODY.semibold, fontSize: 10.5 },
  /** `.tag` — status pill. */
  tag: { fontFamily: BODY.bold, fontSize: 10, letterSpacing: 0.2 },
  /** `body` — the 13.5px base everything else sits against. */
  body: { fontFamily: BODY.regular, fontSize: 13.5 },
  bodySm: { fontFamily: BODY.regular, fontSize: 11.5 },
  /** `label` — form field label. */
  fieldLabel: { fontFamily: BODY.bold, fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  /** `input` — form field text. */
  input: { fontFamily: BODY.regular, fontSize: 12.5 },
  /** Monospaced figure inside a table or a KV row. */
  figure: { fontFamily: MONO.medium, fontSize: 12, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  figureStrong: { fontFamily: MONO.bold, fontSize: 12, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
} as const;

/** nexus's spacing/radius constants — `--radius:18px`, 14px grid gap, and
 * the `15px 17px` card padding that sets the whole layout's density. */
export const SP = {
  radius: 18,
  radiusSm: 12,
  radiusPill: 999,
  gap: 14,
  cardPadY: 15,
  cardPadX: 17,
  /** `td` padding — the single biggest lever on how dense a table reads. */
  cellPadY: 10,
  cellPadX: 14,
  thPadY: 11,
} as const;
