import React from 'react';
import { Stack } from 'expo-router';
import { colors, fonts } from '../../src/theme';
import { WebThemeProvider } from '../../src/web/webTheme';

/**
 * HR/Admin flow.
 *
 * HR-DASHBOARD-RELOCATION-PROPOSAL.md's Stage C linked `payroll-grid`,
 * `roster`, `cash-advances`, `separations-full` and `settings` into
 * `HrDashboardNav`'s (now `WebShell`'s) nav — the "intentionally undeclared
 * and unlinked" state this comment used to describe is stale as of that
 * stage. All six of the full dashboard's top-level screens render their own
 * complete chrome (`WebShell`, R3U-WAA-WEB-REDESIGN.md) and so are declared
 * here with `headerShown: false`, the same as `analytics` already was —
 * without that, expo-router's default Stack header (a bare filename as
 * title, a back button to nowhere useful) would double up above it.
 *
 * `worker/[id]` and `register-supervisor` stay genuinely pushed screens —
 * reached from Roster with a real back target, not top-level nav
 * destinations — so they keep the native Stack header and are left out of
 * this list on purpose. `sites` is the same kind of pushed screen.
 *
 * `WebThemeProvider` wraps the whole group once here rather than per-screen:
 * every screen inside reads the same chosen theme/mode, and it never reaches
 * Worker/Supervisor's native tabs, which sit in their own route groups
 * outside this layout.
 */
export default function HrLayout() {
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sites" options={{ title: 'Sites' }} />
        <Stack.Screen name="analytics" options={{ headerShown: false }} />
        <Stack.Screen name="payroll-grid" options={{ headerShown: false }} />
        <Stack.Screen name="roster" options={{ headerShown: false }} />
        <Stack.Screen name="cash-advances" options={{ headerShown: false }} />
        <Stack.Screen name="separations-full" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </WebThemeProvider>
  );
}
