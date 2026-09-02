import React from 'react';
import { Stack } from 'expo-router';
import { colors, fonts } from '../../src/theme';
import { WebThemeProvider } from '../../src/web/webTheme';

/**
 * Platform Owner flow — a single screen, deliberately.
 *
 * This is an internal operations surface, not a dashboard: three actions
 * (onboard a company, reset an HR/Admin's password, suspend or reactivate a
 * company) stacked on one page. It gets no tab bar because there is nothing to
 * tab between. It does now render inside `WebShell` (R3U-WAA-WEB-REDESIGN.md)
 * for the same glass chrome HR/Admin gets, so it needs its own
 * `WebThemeProvider` — this route group is entirely separate from `(hr)`'s.
 */
export default function PlatformOwnerLayout() {
  return (
    <WebThemeProvider>
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
    </WebThemeProvider>
  );
}
