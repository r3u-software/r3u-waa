import React from 'react';
import Tabs from 'expo-router/js-tabs';
import { TabBar } from '../../../src/components/TabBar';
import {
  ApprovalsIcon,
  ClockIcon,
  HomeIcon,
  TeamIcon,
  UserIcon,
} from '../../../src/components/icons';

/**
 * Supervisor bottom navigation: Home / Approvals / Team / Roster / Profile.
 *
 * "Team" is the payroll-facing view — the hours, leave days and flags that
 * feed a payroll run, scoped to this supervisor's own active workers.
 * "Roster" stays what it always was: the people-management list, with
 * registration and per-worker detail.
 */
export default function SupervisorTabs() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="approvals"
        options={{ title: 'Approvals', tabBarIcon: ({ color }) => <ApprovalsIcon color={color} /> }}
      />
      <Tabs.Screen
        name="team"
        options={{ title: 'Team', tabBarIcon: ({ color }) => <ClockIcon color={color} /> }}
      />
      <Tabs.Screen
        name="roster"
        options={{ title: 'Roster', tabBarIcon: ({ color }) => <TeamIcon color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserIcon color={color} /> }}
      />
    </Tabs>
  );
}
