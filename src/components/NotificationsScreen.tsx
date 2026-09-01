import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSession } from '../lib/session';
import { useNotifications } from '../lib/useNotifications';
import type { RecipientType } from '../lib/types';
import { ScreenBody } from './Screen';
import { EmptyState, Loader, Pill } from './ui';
import { colors, fonts, radius, spacing, type } from '../theme';
import { relativeStamp } from '../lib/format';

/**
 * Shared notification tray for Worker and Supervisor — rows arrive over
 * Realtime from database triggers. Tapping an unread row marks it read.
 *
 * This screen is mounted once per role group (`app/(worker)/notifications.tsx`
 * and `app/(supervisor)/notifications.tsx`) rather than as a single top-level
 * `/notifications` route: the root guard in `app/_layout.tsx` only treats
 * `(worker)`/`(supervisor)`/`(hr)` as valid first segments for a signed-in
 * user, so a route outside every group got bounced straight back to the role
 * home. Living inside the group keeps `segments[0]` correct and gives the
 * screen the group Stack's header (with a back button) for free.
 *
 * HR/Admin has its own tray as a tab (`app/(hr)/(tabs)/notifications.tsx`).
 */
export function NotificationsScreen() {
  const { role, worker, supervisor, hrAdmin } = useSession();
  const principal =
    role === 'worker' ? worker : role === 'supervisor' ? supervisor : hrAdmin;
  // See the same narrowing in `Screen.tsx`: `recipient_type` has no Platform
  // Owner value, and that role never mounts this tray.
  const recipientType: RecipientType =
    role === 'supervisor' ? 'supervisor' : role === 'hr_admin' ? 'hr_admin' : 'worker';
  const { items, loading, unreadCount, markRead, markAllRead, reload } = useNotifications(
    principal?.id,
    recipientType
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <View style={s.head}>
          <Text style={type.sectionTitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
          {unreadCount > 0 ? (
            <Pressable onPress={markAllRead} hitSlop={8}>
              <Text style={type.sectionLink}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        {loading && items.length === 0 ? (
          <Loader label="Loading notifications" />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            body="Approvals, declines and site notices will land here as they happen."
          />
        ) : (
          items.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => !n.is_read && markRead(n.id)}
              style={({ pressed }) => [
                s.row,
                !n.is_read && s.rowUnread,
                pressed && { opacity: 0.75 },
              ]}
            >
              <View style={s.rowTop}>
                <Text style={[s.message, !n.is_read && s.messageUnread]}>{n.message}</Text>
                {!n.is_read ? <Pill label="New" tone="pending" /> : null}
              </View>
              <Text style={s.stamp}>{relativeStamp(n.created_at)}</Text>
            </Pressable>
          ))
        )}
      </ScreenBody>
    </>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: colors.safety },
  rowTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  message: { flex: 1, fontSize: 13, color: colors.ink, lineHeight: 18, fontFamily: fonts.body },
  messageUnread: { fontFamily: fonts.bodySemi },
  stamp: { fontSize: 11.5, color: colors.muted, fontFamily: fonts.body },
});
