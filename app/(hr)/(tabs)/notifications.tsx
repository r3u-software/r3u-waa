import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useHrAdmin } from '../../../src/lib/session';
import { useNotifications } from '../../../src/lib/useNotifications';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import { EmptyState, Loader, Pill } from '../../../src/components/ui';
import { colors, fonts, radius, spacing, type } from '../../../src/theme';
import { relativeStamp } from '../../../src/lib/format';

/**
 * HR/Admin's notification tray, as a tab rather than a pushed route.
 *
 * Worker and Supervisor reach the shared `/notifications` screen from the
 * TopBar bell; HR/Admin's mobile surface is small enough that the tray earns a
 * permanent slot next to the three actions. `waa_notifications` is one of the
 * few tables HR/Admin still has a direct grant on — scoped by
 * `recipient_type = 'hr_admin' AND recipient_id = waa_current_hr_admin_id()`,
 * so it carries no other role's rows and no pay figures.
 */
export default function HrNotifications() {
  const hrAdmin = useHrAdmin();
  const { items, loading, unreadCount, markRead, markAllRead, reload } = useNotifications(
    hrAdmin.id,
    'hr_admin'
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Notifications" />
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
            body="New cash advance requests and separation tags land here as they happen."
          />
        ) : (
          items.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => !n.is_read && markRead(n.id)}
              style={({ pressed }) => [s.row, !n.is_read && s.rowUnread, pressed && { opacity: 0.75 }]}
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
    </View>
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
