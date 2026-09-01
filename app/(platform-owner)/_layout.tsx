import React from 'react';
import { Stack } from 'expo-router';
import { colors, fonts } from '../../src/theme';

/**
 * Platform Owner flow — a single screen, deliberately.
 *
 * This is an internal operations surface, not a dashboard: three actions
 * (onboard a company, reset an HR/Admin's password, suspend or reactivate a
 * company) stacked on one page. It gets no tab bar because there is nothing to
 * tab between, and no TopBar because Platform Owner has no notification tray —
 * `waa_notifications.recipient_type` covers worker/supervisor/hr_admin only.
 */
export default function PlatformOwnerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
