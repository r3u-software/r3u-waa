import React from 'react';
import { Stack } from 'expo-router';
import { resolvePalette, WebThemeProvider } from '../../src/web/webTheme';

/**
 * Worker flow: the tab shell plus the pushed screens that hang off it.
 *
 * Reskinned onto the glass system (R3U-WAA-WEB-REDESIGN.md's native
 * follow-up) — fixed Aurora/dark, same as the auth screens, via its own
 * `WebThemeProvider` (this route group's own instance, separate from
 * `(hr)`'s). The native `Stack` header itself is reskinned here rather than
 * hidden per screen: real back-gesture/back-button behavior stays intact,
 * and every pushed screen (`notifications`, `punch`, `cash-advance`,
 * `leave`, `onboarding`, `contract`) gets the dark glass canvas + light
 * header text for free instead of needing a custom header each.
 */
const P = resolvePalette('aurora', 'dark');

export default function WorkerLayout() {
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
        <Stack.Screen name="punch" options={{ title: 'Time punch', presentation: 'modal' }} />
        <Stack.Screen name="cash-advance" options={{ title: 'Cash advance' }} />
        <Stack.Screen name="leave" options={{ title: 'File leave' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Complete your profile' }} />
        <Stack.Screen name="contract" options={{ title: 'Contract' }} />
      </Stack>
    </WebThemeProvider>
  );
}
