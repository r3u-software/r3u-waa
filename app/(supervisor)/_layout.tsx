import React from 'react';
import { Stack } from 'expo-router';
import { resolvePalette, WebThemeProvider } from '../../src/web/webTheme';

/**
 * Supervisor flow: the tab shell plus pushed detail/registration screens.
 *
 * `WebThemeProvider` mounted here (its own instance, separate from `(worker)`
 * and `(hr)`'s) for the same reason `(worker)/_layout.tsx` needed it: the
 * shared `TabBar` component now reads `useWebTheme()` unconditionally, so
 * every route group that renders it must provide the context or it throws.
 * The Stack header/canvas are reskinned to match; Supervisor's own screen
 * *content* (`(tabs)/*`, `worker/[id]`, `register-worker`) is not part of
 * this pass and still renders in the original paper theme underneath —
 * called out explicitly, not a silent gap.
 */
const P = resolvePalette('aurora', 'dark');

export default function SupervisorLayout() {
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
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen
          name="register-worker"
          options={{ title: 'Register worker', presentation: 'modal' }}
        />
        <Stack.Screen name="worker/[id]" options={{ title: 'Worker' }} />
      </Stack>
    </WebThemeProvider>
  );
}
