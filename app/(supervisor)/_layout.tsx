import React from 'react';
import { Stack } from 'expo-router';
import { colors, fonts } from '../../src/theme';

/** Supervisor flow: the tab shell plus pushed detail/registration screens. */
export default function SupervisorLayout() {
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
