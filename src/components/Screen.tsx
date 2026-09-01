import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';
import { BellIcon, SiteIcon } from './icons';
import { useSession } from '../lib/session';
import { useNotifications } from '../lib/useNotifications';
import type { RecipientType } from '../lib/types';
import { initialsOf } from '../lib/format';

/**
 * The persistent top bar from the mockup: brand mark + "R3U Site Suite /
 * <label>", a notification bell with an unread dot, and the user's initials
 * avatar. Rendered by every tab screen so the chrome never shifts.
 */
export function TopBar({ label }: { label: string }) {
  const insets = useSafeAreaInsets();
  const { role, worker, supervisor, hrAdmin } = useSession();
  const principal =
    role === 'worker' ? worker : role === 'supervisor' ? supervisor : hrAdmin;
  // `waa_notifications.recipient_type` only covers the three company-scoped
  // roles — there is no Platform Owner tray, and that role's screen does not
  // render this bar at all. Narrowed explicitly rather than passing `role`
  // straight through, which would widen the argument to a value the column
  // cannot hold.
  const recipientType: RecipientType =
    role === 'supervisor' ? 'supervisor' : role === 'hr_admin' ? 'hr_admin' : 'worker';
  const { unreadCount } = useNotifications(principal?.id, recipientType);
  const name = principal?.full_name;

  return (
    <View style={[s.topbar, { paddingTop: insets.top + 16 }]}>
      <View style={s.brandRow}>
        <View style={s.brandMark}>
          <SiteIcon size={18} color={colors.safety} />
        </View>
        <View>
          <Text style={s.co}>R3U Site Suite</Text>
          <Text style={s.name}>{label}</Text>
        </View>
      </View>
      <View style={s.topbarRight}>
        <Pressable
          style={s.bell}
          onPress={() =>
            // Every role's tray lives inside that role's own route group so the
            // root guard in app/_layout.tsx keeps segments[0] pointing at the
            // active group (a bare /notifications route gets bounced back to the
            // role home). HR/Admin's is a tab; Worker/Supervisor's is a pushed
            // screen sharing one implementation.
            router.push(
              role === 'hr_admin'
                ? '/(hr)/(tabs)/notifications'
                : role === 'supervisor'
                  ? '/(supervisor)/notifications'
                  : '/(worker)/notifications'
            )
          }
          hitSlop={6}
          accessibilityLabel={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        >
          <BellIcon size={17} color={colors.ink} />
          {unreadCount > 0 ? <View style={s.dot} /> : null}
        </Pressable>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initialsOf(name)}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Standard scrolling body with the mockup's paper background and generous
 * bottom padding so content clears the tab bar.
 */
export function ScreenBody({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      style={s.body}
      contentContainerStyle={s.bodyContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.steel}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/** Page header used on non-tab (pushed) screens. */
export function PageHeader({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.greet}>{title}</Text>
      {sub ? <Text style={s.subgreet}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  topbar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  co: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.muted,
    fontFamily: fonts.bodyBold,
  },
  name: {
    fontFamily: fonts.serif,
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 22,
  },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warn,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 13 },
  body: { flex: 1, backgroundColor: colors.paper },
  bodyContent: { padding: spacing.xl, paddingBottom: 40 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.muted,
    fontFamily: fonts.bodyBold,
    marginBottom: 6,
  },
  greet: {
    fontFamily: fonts.serif,
    fontSize: 23,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  subgreet: { fontSize: 13, color: colors.muted, fontFamily: fonts.body },
});
