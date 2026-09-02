import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing } from '../theme';

/**
 * The lightweight nav connecting HR/Admin's full-dashboard web screens —
 * HR-DASHBOARD-RELOCATION-PROPOSAL.md, Stage A. Before this, each of the 6
 * un-orphaned screens was an island: reachable only by a direct URL, with no
 * link back to any of the others (payroll-grid.tsx already linked out to
 * cash-advances.tsx and settings.tsx on its own; nothing else was connected
 * both ways). This is deliberately small — a row of chips, not the full
 * `BRAND-SYSTEM.md` shell (top nav + sidebar) — see the proposal's "Two
 * small things noticed" section for why that's flagged separately rather
 * than silently built here.
 *
 * `worker/[id].tsx` and `register-supervisor.tsx` aren't in this row: both
 * are pushed detail/action screens reached by tapping into Roster, with a
 * native back button from the Stack header, not top-level destinations of
 * their own.
 */
const ITEMS: { key: string; label: string; href: string }[] = [
  { key: 'analytics', label: 'Analytics', href: '/(hr)/analytics' },
  { key: 'payroll-grid', label: 'Payroll', href: '/(hr)/payroll-grid' },
  { key: 'roster', label: 'Roster', href: '/(hr)/roster' },
  { key: 'cash-advances', label: 'Cash Advances', href: '/(hr)/cash-advances' },
  { key: 'separations-full', label: 'Separations', href: '/(hr)/separations-full' },
  { key: 'settings', label: 'Settings', href: '/(hr)/settings' },
];

export function HrDashboardNav({ current }: { current: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.row}
      contentContainerStyle={s.rowContent}
    >
      {ITEMS.map((item) => {
        const active = item.key === current;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              if (!active) router.push(item.href as never);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[s.chip, active && s.chipActive]}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.muted },
  chipTextActive: { color: colors.paper },
});
