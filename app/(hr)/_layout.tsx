import React from 'react';
import { Stack } from 'expo-router';
import { colors, fonts } from '../../src/theme';

/**
 * HR/Admin flow.
 *
 * The tab shell plus exactly one pushed screen: `sites`. The former pushed
 * screens (`settings`, `cash-advances`, `register-supervisor`, `worker/[id]`)
 * and the former tabs moved out here (`payroll-grid`, `roster`,
 * `separations-full`) are intentionally left undeclared and unlinked: expo
 * router still resolves them as routes, but nothing in the UI can reach them,
 * and they would be denied by RLS if it did. See the ORPHANED SCREEN banner at
 * the top of each.
 *
 * `sites` is the deliberate exception, not a crack in that rule. It writes
 * `waa_projects` — a site's name and location, never a pay figure — through
 * real RLS policies scoped to the caller's own company, so it needs no edge
 * function and re-opens none of the payroll surface the addendum closed. It is
 * pushed from Profile rather than added as a sixth tab: it's setup work done
 * once per site, not a daily action worth a permanent tab slot.
 *
 * `analytics` is the second exception (HR-ANALYTICS-ADDENDUM.md): the root
 * guard in app/_layout.tsx sends HR/Admin here on web instead of into
 * `(tabs)`. It goes through its own edge function (`waa-hr-analytics`), not
 * direct table access, same as everything else HR/Admin's full surface needs
 * post-retrofit.
 */
export default function HrLayout() {
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
      <Stack.Screen name="sites" options={{ title: 'Sites' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics', headerShown: false }} />
    </Stack>
  );
}
