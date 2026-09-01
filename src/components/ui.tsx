import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fonts, pillColors, radius, spacing, StatusTone, type } from '../theme';

/* ---------------------------------------------------------------- Pill --- */

export function Pill({ label, tone = 'muted' }: { label: string; tone?: StatusTone }) {
  const c = pillColors[tone];
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <Text style={[s.pillText, { color: c.fg }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/* ------------------------------------------------------------- Section --- */

export function Section({
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
  return (
    <View style={[s.section, style]}>
      <View style={s.sectionHead}>
        <Text style={type.sectionTitle}>{title}</Text>
        {link ? (
          <Pressable onPress={onLinkPress} hitSlop={8}>
            <Text style={type.sectionLink}>{link}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- Card --- */

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.card, style, pressed && { opacity: 0.75 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

/**
 * The mockup's standard list row: a tinted square icon, a title/subtitle
 * stack, and a trailing status pill.
 */
export function ListCard({
  icon,
  iconBg,
  title,
  subtitle,
  tone,
  pillLabel,
  onPress,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  tone?: StatusTone;
  pillLabel?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card onPress={onPress}>
      <View style={s.cardRow}>
        <View style={[s.cardIcon, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={s.cardBody}>
          <Text style={type.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={type.cardSub}>{subtitle}</Text> : null}
          {children}
        </View>
        {pillLabel ? <Pill label={pillLabel} tone={tone} /> : null}
      </View>
    </Card>
  );
}

/* -------------------------------------------------------------- Buttons --- */

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  tone = 'safety',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'safety' | 'ink' | 'ok' | 'warn';
  style?: ViewStyle;
}) {
  const bg =
    tone === 'safety'
      ? colors.safety
      : tone === 'ink'
        ? colors.ink
        : tone === 'ok'
          ? colors.ok
          : colors.warn;
  const fg = tone === 'safety' ? colors.ink : '#FFFFFF';
  const isOff = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      style={({ pressed }) => [
        s.primaryBtn,
        { backgroundColor: bg },
        isOff && { opacity: 0.5 },
        pressed && !isOff && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[s.primaryBtnText, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.secondaryBtn,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={s.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

/** The mockup's paired Decline / Approve row. */
export function ApproveRow({
  onApprove,
  onDecline,
  busy,
}: {
  onApprove: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  return (
    <View style={s.approveRow}>
      <Pressable
        onPress={onDecline}
        disabled={busy}
        style={({ pressed }) => [s.btnDecline, (pressed || busy) && { opacity: 0.6 }]}
      >
        <Text style={s.btnDeclineText}>Decline</Text>
      </Pressable>
      <Pressable
        onPress={onApprove}
        disabled={busy}
        style={({ pressed }) => [s.btnApprove, (pressed || busy) && { opacity: 0.6 }]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={s.btnApproveText}>Approve</Text>
        )}
      </Pressable>
    </View>
  );
}

/* ---------------------------------------------------------------- Input --- */

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[s.input, props.multiline && s.inputMultiline, props.style]}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------- Feedback --- */

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {body ? <Text style={s.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function Loader({ label }: { label?: string }) {
  return (
    <View style={s.loader}>
      <ActivityIndicator color={colors.steel} />
      {label ? <Text style={s.loaderText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={s.errorNote}>
      <Text style={s.errorNoteText}>{message}</Text>
    </View>
  );
}

/* ------------------------------------------------------- Status strip --- */

export interface StatChip {
  value: string | number;
  label: string;
  tone: 'ok' | 'pending' | 'warn';
}

export function StatusStrip({ chips }: { chips: StatChip[] }) {
  return (
    <View style={s.statusStrip}>
      {chips.map((c) => (
        <View key={c.label} style={s.statusChip}>
          <Text
            style={[
              s.statusNum,
              {
                color:
                  c.tone === 'ok' ? colors.ok : c.tone === 'pending' ? colors.safetyDeep : colors.warn,
              },
            ]}
          >
            {c.value}
          </Text>
          <Text style={s.statusLbl}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* --------------------------------------------------------------- Styles --- */

const s = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.4,
  },
  section: { marginBottom: spacing.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 15,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  primaryBtn: {
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 14, fontFamily: fonts.bodyBold },
  secondaryBtn: {
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  secondaryBtnText: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.steel },
  approveRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btnApprove: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: colors.ok,
    alignItems: 'center',
  },
  btnApproveText: { color: '#fff', fontSize: 12, fontFamily: fonts.bodyBold },
  btnDecline: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  btnDeclineText: { color: colors.muted, fontSize: 12, fontFamily: fonts.bodyBold },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14.5,
    color: colors.ink,
    fontFamily: fonts.body,
  },
  inputMultiline: { minHeight: 92, textAlignVertical: 'top' },
  hint: { fontSize: 11.5, color: colors.muted, marginTop: 5, fontFamily: fonts.body },
  empty: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 5,
  },
  emptyTitle: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.ink, textAlign: 'center' },
  emptyBody: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 17,
    fontFamily: fonts.body,
  },
  loader: { paddingVertical: 32, alignItems: 'center', gap: 10 },
  loaderText: { fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  errorNote: {
    backgroundColor: colors.warnBg,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: spacing.lg,
  },
  errorNoteText: { color: colors.warn, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.bodySemi },
  statusStrip: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statusChip: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 12,
  },
  statusNum: { fontFamily: fonts.serif, fontSize: 22, fontWeight: '700', lineHeight: 24 },
  statusLbl: { fontSize: 10.5, color: colors.muted, marginTop: 4, fontFamily: fonts.body },
});
