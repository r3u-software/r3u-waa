/*
 * ORPHANED SCREEN — not reachable from the app's navigation.
 *
 * The org-wide worker roster — was `(hr)/(tabs)/roster.tsx`, the Roster tab.
 *
 * Per HR-ADMIN-MOBILE-ACCESS-ADDENDUM.md (resolved as Option A in
 * ADDENDA-PROPOSAL.md), HR/Admin's mobile surface is now exactly three
 * single-decision actions plus Notifications and Profile. This screen belongs
 * to the full HR/Admin surface, which lives on the web dashboard — so nothing
 * in the tab bar or any link points at it any more.
 *
 * It is kept, unwired, as a starting point for that separate web dashboard.
 * As written it CANNOT WORK on mobile: it queries `waa_workers`, `waa_projects` and `waa_supervisors` directly, and
 * HR/Admin's direct-table RLS grants on those were revoked. Rebuilding it for
 * the web means rewiring every query here onto purpose-built edge functions
 * first.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useHrAdmin } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { fetchAllWorkers, fetchProjects, fetchSupervisors } from '../../src/lib/queries';
import { ScreenBody, TopBar } from '../../src/components/Screen';
import {
  Card,
  EmptyState,
  Loader,
  Pill,
  PrimaryButton,
  Section,
  StatusStrip,
} from '../../src/components/ui';
import { colors, fonts, radius, toneForStatus, type } from '../../src/theme';
import { initialsOf } from '../../src/lib/format';

/**
 * HR/Admin roster — every worker on every site, grouped by the supervisor they
 * report to, plus the register-supervisor action.
 *
 * There is no "which workers report to which supervisor" table; the grouping
 * is just `waa_workers.supervisor_id`, which is what the analysis expected.
 * Supervisor *names* need a SELECT on `waa_supervisors`, which HR/Admin has no
 * policy for in the deployed schema — the group falls back to a short id label
 * when the name can't be resolved.
 */
export default function HrRoster() {
  const hrAdmin = useHrAdmin();
  const [showSeparated, setShowSeparated] = useState(false);

  const { data, loading, reload } = useAsync(async () => {
    const [workers, supervisors, projects] = await Promise.all([
      fetchAllWorkers(),
      fetchSupervisors(),
      fetchProjects(),
    ]);
    return { workers, supervisors, projects };
  }, [hrAdmin.id]);

  const supervisorName = useMemo(() => {
    const map = new Map<string, string>();
    for (const sup of data?.supervisors ?? []) map.set(sup.id, sup.full_name);
    return map;
  }, [data?.supervisors]);

  const groups = useMemo(() => {
    const visible = (data?.workers ?? []).filter((w) =>
      showSeparated ? true : w.employment_status === 'active'
    );
    const bySupervisor = new Map<string, typeof visible>();
    for (const w of visible) {
      const key = w.supervisor_id ?? 'unassigned';
      bySupervisor.set(key, [...(bySupervisor.get(key) ?? []), w]);
    }
    return Array.from(bySupervisor.entries()).map(([key, workers]) => ({
      key,
      label:
        key === 'unassigned'
          ? 'No supervisor'
          : (supervisorName.get(key) ?? `Supervisor ${key.slice(0, 8)}`),
      workers,
    }));
  }, [data?.workers, showSeparated, supervisorName]);

  const active = (data?.workers ?? []).filter((w) => w.employment_status === 'active').length;
  const separated = (data?.workers ?? []).length - active;
  const supervisorCount = new Set(
    (data?.workers ?? []).map((w) => w.supervisor_id).filter(Boolean)
  ).size;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Roster" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.greet}>Everyone</Text>
        <Text style={[type.subgreet, { marginBottom: 18 }]}>
          Across {data?.projects.length ?? 0} site{(data?.projects.length ?? 0) === 1 ? '' : 's'}
        </Text>

        <StatusStrip
          chips={[
            { value: active, label: 'Active workers', tone: 'ok' },
            { value: supervisorCount, label: 'Supervisors', tone: 'pending' },
            { value: separated, label: 'Separated', tone: 'warn' },
          ]}
        />

        <PrimaryButton
          label="Register a supervisor"
          onPress={() => router.push('/(hr)/register-supervisor')}
          style={{ marginBottom: 18 }}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {[
            { key: false, label: 'Active only' },
            { key: true, label: 'Include separated' },
          ].map((f) => (
            <Pressable
              key={String(f.key)}
              onPress={() => setShowSeparated(f.key)}
              style={[s.filterChip, showSeparated === f.key && s.filterChipActive]}
            >
              <Text style={[s.filterText, showSeparated === f.key && s.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && !data ? (
          <Loader label="Loading roster" />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No workers yet"
            body="Register a supervisor first — supervisors register their own workers."
          />
        ) : (
          groups.map((g) => (
            <Section key={g.key} title={g.label}>
              <Card>
                {g.workers.map((w, i) => (
                  <Pressable
                    key={w.id}
                    onPress={() => router.push(`/(hr)/worker/${w.id}`)}
                    style={({ pressed }) => [
                      s.row,
                      i === g.workers.length - 1 && s.rowLast,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={s.avatar}>
                      <Text style={s.initials}>{initialsOf(w.full_name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{w.full_name}</Text>
                      <Text style={s.sub}>
                        {w.position || 'No position'} · {w.phone || 'no phone'}
                      </Text>
                    </View>
                    <Pill
                      label={w.employment_status}
                      tone={toneForStatus(w.employment_status)}
                    />
                  </Pressable>
                ))}
              </Card>
            </Section>
          ))
        )}

        {(data?.supervisors.length ?? 0) === 0 ? (
          <Text style={s.note}>
            Supervisor names can't be resolved from this account — `waa_supervisors` has no
            HR/Admin SELECT policy in the deployed schema, so groups are labelled by id.
          </Text>
        ) : null}
      </ScreenBody>
    </View>
  );
}

const s = StyleSheet.create({
  filterRow: { gap: 8, paddingBottom: 18, paddingRight: 8 },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.muted },
  filterTextActive: { color: colors.paper },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.steel },
  name: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.ink },
  sub: { fontSize: 11, color: colors.muted, fontFamily: fonts.body },
  note: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginBottom: 30,
    fontFamily: fonts.body,
  },
});
