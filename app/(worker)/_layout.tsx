import React from 'react';
import { Stack } from 'expo-router';
import { useWebTheme, WebThemeProvider } from '../../src/web/webTheme';

/**
 * Worker flow: the tab shell plus the pushed screens that hang off it.
 *
 * Reskinned onto the glass system (R3U-WAA-WEB-REDESIGN.md's native
 * follow-up) via its own `WebThemeProvider` (this route group's own
 * instance, separate from `(hr)`'s). The native `Stack` header itself is
 * reskinned here rather than hidden per screen: real back-gesture/back-button
 * behavior stays intact, and every pushed screen (`notifications`, `punch`,
 * `cash-advance`, `leave`, `onboarding`, `contract`) gets the glass canvas +
 * matching header text for free instead of needing a custom header each.
 *
 * `WorkerStack` is split out from `WorkerLayout` so it can call
 * `useWebTheme()` itself — that only works *inside* `WebThemeProvider`, so it
 * cannot happen in the same component that renders the provider. Palette used
 * to be a frozen `resolvePalette('aurora','dark')` constant computed once at
 * module load; now it reacts live to whatever theme/mode the worker actually
 * picked (in Profile's "Appearance" section), same as the rest of this
 * group's screens already did.
 */
export default function WorkerLayout() {
  return (
    <WebThemeProvider>
      <WorkerStack />
    </WebThemeProvider>
  );
}

function WorkerStack() {
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
      <Stack.Screen name="punch" options={{ title: 'Time punch', presentation: 'modal' }} />
      <Stack.Screen name="cash-advance" options={{ title: 'Cash advance' }} />
      <Stack.Screen name="leave" options={{ title: 'File leave' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Complete your profile' }} />
      <Stack.Screen name="contract" options={{ title: 'Contract' }} />
    </Stack>
  );
}
