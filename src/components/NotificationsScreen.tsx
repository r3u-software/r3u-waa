import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSession } from '../lib/session';
import { useNotifications } from '../lib/useNotifications';
import type { RecipientType } from '../lib/types';
import { EmptyState } from './ui';
import { useWebTheme } from '../web/webTheme';
import { GlassScreen, WebPill } from '../web/webUi';
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
 * screen the group Stack's header (with a back button) for free — which is
 * also why there's no manual safe-area top padding below: the Stack header
 * already reserves that space, same as every other pushed glass screen
 * (`punch.tsx`, `cash-advance.tsx`, `leave.tsx`).
 *
 * HR/Admin has its own tray as a tab (`app/(hr)/(tabs)/notifications.tsx`,
 * its own web screen, untouched by this pass).
 *
 * Reskinned onto the glass system alongside the rest of Supervisor's own
 * screens — Worker already reads its own theme context from its own
 * `WebThemeProvider` (`(worker)/_layout.tsx`), so this needed no branching
 * to work correctly for both groups; whichever group's Stack renders this
 * screen, `useWebTheme()` picks up that group's own provider.
 */
export function NotificationsScreen() {
  const { role, worker, supervisor, hrAdmin } = useSession();
  const { palette } = useWebTheme();
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
      <GlassScreen>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.muted} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
          {unreadCount > 0 ? (
            <Pressable onPress={markAllRead} hitSlop={8}>
              <Text style={{ fontSize: 12.5, color: palette.accent2, fontWeight: '700' }}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        {loading && items.length === 0 ? (
          <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 24 }}>Loading…</Text>
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
                {
                  backgroundColor: palette.panel,
                  borderWidth: 1,
                  borderColor: n.is_read ? palette.border : palette.accent2,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                  gap: 6,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: palette.text,
                    lineHeight: 18,
                    fontWeight: n.is_read ? '400' : '700',
                  }}
                >
                  {n.message}
                </Text>
                {!n.is_read ? <WebPill label="New" tone="info" /> : null}
              </View>
              <Text style={{ fontSize: 11.5, color: palette.muted }}>{relativeStamp(n.created_at)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
      </GlassScreen>
    </>
  );
}
