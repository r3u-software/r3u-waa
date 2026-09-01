import React from 'react';
import Tabs from 'expo-router/js-tabs';
import { TabBar } from '../../../src/components/TabBar';
import {
  BellIcon,
  CashIcon,
  ExitIcon,
  UploadIcon,
  UserIcon,
} from '../../../src/components/icons';

/**
 * HR/Admin's entire mobile navigation: the three emergency-approval actions
 * from HR-ADMIN-MOBILE-ACCESS-ADDENDUM.md, a notifications tray, and their own
 * profile.
 *
 * What is deliberately NOT here: the full payroll grid, payroll settings, the
 * org roster, supervisor registration, and worker detail/editing. Those are the
 * office-desk surface and belong to the web dashboard. Their screens still
 * exist under `(hr)/` — `payroll-grid.tsx`, `settings.tsx`, `roster.tsx`,
 * `register-supervisor.tsx`, `cash-advances.tsx`, `separations-full.tsx`,
 * `worker/[id].tsx` — carrying an ORPHANED SCREEN banner, unreferenced by any
 * tab or link, and would fail against RLS anyway now that HR/Admin's
 * direct-table grants are revoked.
 *
 * Adding any of them back to this tab bar re-opens the exact gap the addendum
 * closes. If HR/Admin needs something more on mobile, it gets a new narrow edge
 * function first, not a broader table grant.
 */
export default function HrTabs() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Advances', tabBarIcon: ({ color }) => <CashIcon color={color} /> }}
      />
      <Tabs.Screen
        name="separations"
        options={{ title: 'Separations', tabBarIcon: ({ color }) => <ExitIcon color={color} /> }}
      />
      <Tabs.Screen
        name="payslip-proofs"
        options={{ title: 'Proofs', tabBarIcon: ({ color }) => <UploadIcon color={color} /> }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: 'Alerts', tabBarIcon: ({ color }) => <BellIcon color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserIcon color={color} /> }}
      />
    </Tabs>
  );
}
