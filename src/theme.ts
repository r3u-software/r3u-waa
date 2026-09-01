import { Platform, TextStyle } from 'react-native';

/**
 * Design tokens lifted verbatim from the `:root` block of
 * design-reference/attendance-app-mockup.html. Do not invent new colors —
 * if a screen needs a shade that isn't here, it probably belongs to one of
 * these roles already.
 */
export const colors = {
  ink: '#1C1B18',
  paper: '#F6F4EF',
  steel: '#3A4750',
  safety: '#F2A93B',
  safetyDeep: '#C97E1A',
  ok: '#3E7C55',
  okBg: '#E8F1EA',
  warn: '#B4483C',
  warnBg: '#F7E6E3',
  pendingBg: '#FBF0DD',
  line: '#DEDACF',
  card: '#FFFFFF',
  muted: '#7A7568',
  /** Muted-on-dark, used inside the ink-colored punch card. */
  mutedOnDark: '#B9B5A8',
  /** Neutral chip background (the mockup's `.pill.muted`). */
  neutralBg: '#EFEDE6',
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  hero: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
} as const;

/**
 * The mockup pairs Georgia (serif) for brand/greeting/numerals with Inter
 * for body copy. Inter is loaded at runtime via @expo-google-fonts/inter;
 * `serif` resolves to Georgia on iOS and Noto Serif on Android.
 */
export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) as string,
  body: 'Inter_400Regular',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Shared text styles that recur across both role flows. */
export const type = {
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.muted,
    fontFamily: fonts.bodyBold,
  } as TextStyle,
  greet: {
    fontFamily: fonts.serif,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colors.ink,
  } as TextStyle,
  subgreet: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.body,
  } as TextStyle,
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  } as TextStyle,
  sectionLink: {
    fontSize: 11.5,
    color: colors.steel,
    fontFamily: fonts.bodySemi,
  } as TextStyle,
  cardTitle: {
    fontSize: 13.5,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  } as TextStyle,
  cardSub: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    fontFamily: fonts.body,
  } as TextStyle,
  body: {
    fontSize: 13,
    color: colors.ink,
    fontFamily: fonts.body,
  } as TextStyle,
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    fontFamily: fonts.bodyBold,
  } as TextStyle,
} as const;

/** Status -> pill visual mapping, shared by every list in the app. */
export type StatusTone = 'ok' | 'pending' | 'warn' | 'muted';

export function toneForStatus(status: string): StatusTone {
  switch (status) {
    case 'approved':
    case 'complete':
    case 'active':
    case 'paid':
    case 'settled':
      return 'ok';
    case 'pending':
    case 'draft':
    case 'reviewed':
    case 'finalized':
    case 'paid_out':
      return 'pending';
    case 'declined':
    case 'incomplete':
    case 'terminated':
    case 'awol':
    case 'resigned':
      return 'warn';
    default:
      return 'muted';
  }
}

export const pillColors: Record<StatusTone, { bg: string; fg: string }> = {
  ok: { bg: colors.okBg, fg: colors.ok },
  pending: { bg: colors.pendingBg, fg: colors.safetyDeep },
  warn: { bg: colors.warnBg, fg: colors.warn },
  muted: { bg: colors.neutralBg, fg: colors.muted },
};
