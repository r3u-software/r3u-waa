import React from 'react';
import { Stack } from 'expo-router';
import { colors, fonts } from '../../src/theme';

/** Worker flow: the tab shell plus the pushed screens that hang off it. */
export default function WorkerLayout() {
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
      <Stack.Screen name="punch" options={{ title: 'Time punch', presentation: 'modal' }} />
      <Stack.Screen name="cash-advance" options={{ title: 'Cash advance' }} />
      <Stack.Screen name="leave" options={{ title: 'File leave' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Complete your profile' }} />
      <Stack.Screen name="contract" options={{ title: 'Contract' }} />
    </Stack>
  );
}
