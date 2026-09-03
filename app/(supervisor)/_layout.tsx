import React from 'react';
import { Stack } from 'expo-router';
import { useWebTheme, WebThemeProvider } from '../../src/web/webTheme';

/**
 * Supervisor flow: the tab shell plus pushed detail/registration screens.
 *
 * `WebThemeProvider` mounted here (its own instance, separate from `(worker)`
 * and `(hr)`'s) for the same reason `(worker)/_layout.tsx` needed it: the
 * shared `TabBar` component now reads `useWebTheme()` unconditionally, so
 * every route group that renders it must provide the context or it throws.
 * Supervisor's own screen *content* (`(tabs)/roster`, `(tabs)/team`,
 * `worker/[id]`, `register-worker`) is still not part of the glass reskin and
 * renders in the original paper theme underneath — called out explicitly,
 * not a silent gap. `(tabs)/profile` is the one exception: it got an
 * "Appearance" section wired to this same context so Supervisor can actually
 * reach the theme/mode picker, same as Worker can.
 *
 * `SupervisorStack` is split out so it can call `useWebTheme()` itself — only
 * valid *inside* `WebThemeProvider`, so it can't happen in the component that
 * renders the provider. Palette used to be a frozen
 * `resolvePalette('aurora','dark')` constant; now it reacts live to whatever
 * was actually picked.
 */
export default function SupervisorLayout() {
  return (
    <WebThemeProvider>
      <SupervisorStack />
    </WebThemeProvider>
  );
}

function SupervisorStack() {
  const { palette: P } = useWebTheme();
  return (
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
  );
}
