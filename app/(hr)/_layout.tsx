import React from 'react';
import { Stack } from 'expo-router';
import { resolvePalette, WebThemeProvider } from '../../src/web/webTheme';

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
 * destinations — so they keep the native Stack header (now reskinned to
 * match, R3U-WAA-WEB-REDESIGN.md's follow-up) rather than `WebShell`'s full
 * sidebar chrome. `sites` is the same kind of pushed screen.
 *
 * `WebThemeProvider` wraps the whole group once here rather than per-screen:
 * every screen inside reads the same chosen theme/mode, and it never reaches
 * Worker/Supervisor's native tabs, which sit in their own route groups
 * outside this layout. The Stack header itself uses a fixed
 * `resolvePalette('aurora','dark')` rather than `useWebTheme()` — this
 * component renders the `WebThemeProvider` itself, so its own
 * `screenOptions` can't yet read from it.
 */
const P = resolvePalette('aurora', 'dark');

export default function HrLayout() {
  return (
    <WebThemeProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: P.panelSolid },
          headerTitleStyle: { fontWeight: '700', fontSize: 16, color: P.text },
          headerTintColor: P.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: P.bg },
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
