import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import { fetchProjects, fetchRoster, fetchTodaysEntries } from '../../../src/lib/queries';
import { supabase } from '../../../src/lib/supabase';
import type { WaaAssignmentWithProject } from '../../../src/lib/types';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import {
  Card,
  EmptyState,
  Loader,
  Pill,
  PrimaryButton,
  Section,
} from '../../../src/components/ui';
import { colors, fonts, radius, type } from '../../../src/theme';
import { initialsOf } from '../../../src/lib/format';

/** Full team roster, filterable by site, and the entry point for registration. */
export default function RosterScreen() {
  const supervisor = useSupervisor();
  const [siteFilter, setSiteFilter] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const [roster, projects, today] = await Promise.all([
      fetchRoster(),
      fetchProjects(),
      fetchTodaysEntries(),
    ]);

    // Assignments for every worker on the roster, so the site filter can match
    // borrowed workers too — not just their `current_project_id`.
    const workerIds = roster.map((w) => w.id);
    let assignments: WaaAssignmentWithProject[] = [];
    if (workerIds.length > 0) {
      const { data: rows } = await supabase
        .from('waa_worker_project_assignments')
        .select('*, project:waa_projects(*)')
        .in('worker_id', workerIds);
      assignments = (rows as WaaAssignmentWithProject[]) ?? [];
    }

    return { roster, projects, today, assignments };
  }, [supervisor.id]);

  const liveStatus = useMemo(() => {
    const map = new Map<string, 'in' | 'out'>();
    for (const e of data?.today ?? []) {
      if (!map.has(e.worker_id)) map.set(e.worker_id, e.type);
    }
    return map;
  }, [data?.today]);

  /** worker id -> the sites they're assigned to. */
  const sitesByWorker = useMemo(() => {
    const map = new Map<string, WaaAssignmentWithProject[]>();
    for (const a of data?.assignments ?? []) {
      map.set(a.worker_id, [...(map.get(a.worker_id) ?? []), a]);
    }
    return map;
  }, [data?.assignments]);

  const filtered = useMemo(() => {
    const roster = data?.roster ?? [];
    if (!siteFilter) return roster;
    return roster.filter((w) =>
      (sitesByWorker.get(w.id) ?? []).some((a) => a.project_id === siteFilter)
    );
  }, [data?.roster, siteFilter, sitesByWorker]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Roster" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.greet}>Your team</Text>
        <Text style={[type.subgreet, { marginBottom: 16 }]}>
          {data?.roster.length ?? 0} worker{(data?.roster.length ?? 0) === 1 ? '' : 's'} registered
        </Text>

        <PrimaryButton
          label="Register a worker"
          onPress={() => router.push('/(supervisor)/register-worker')}
          style={{ marginBottom: 20 }}
        />

        {/* --------------------------- Site filter ------------------------ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          <Pressable
            onPress={() => setSiteFilter(null)}
            style={[s.filterChip, siteFilter === null && s.filterChipActive]}
          >
            <Text style={[s.filterText, siteFilter === null && s.filterTextActive]}>All sites</Text>
          </Pressable>
          {(data?.projects ?? []).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setSiteFilter(p.id)}
              style={[s.filterChip, siteFilter === p.id && s.filterChipActive]}
            >
              <Text style={[s.filterText, siteFilter === p.id && s.filterTextActive]}>{p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Section title={siteFilter ? 'Workers at this site' : 'All workers'}>
          {loading && !data ? (
            <Loader />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={siteFilter ? 'Nobody assigned here' : 'No workers yet'}
              body={
                siteFilter
                  ? 'No worker under you is assigned to this site.'
                  : 'Register your first worker to issue their login credentials.'
              }
            />
          ) : (
            <Card>
              {filtered.map((w, i) => {
                const live = liveStatus.get(w.id);
                const label =
                  w.status !== 'complete'
                    ? 'Incomplete'
                    : live === 'in'
                      ? 'In'
                      : live === 'out'
                        ? 'Out'
                        : 'Off';
                const tone = w.status !== 'complete' ? 'warn' : live === 'in' ? 'ok' : 'muted';
                const sites = sitesByWorker.get(w.id) ?? [];
                const primary = sites.find((a) => a.is_primary) ?? sites[0];
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => router.push(`/(supervisor)/worker/${w.id}`)}
                    style={({ pressed }) => [
                      s.row,
                      i === filtered.length - 1 && s.rowLast,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={s.avatar}>
                      <Text style={s.initials}>{initialsOf(w.full_name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{w.full_name}</Text>
                      <Text style={s.sub}>
                        {primary?.project?.name ?? 'No site'}
                        {sites.length > 1 ? ` +${sites.length - 1}` : ''} · {w.phone || 'no phone'}
                      </Text>
                    </View>
                    <Pill label={label} tone={tone} />
                  </Pressable>
                );
              })}
            </Card>
          )}
        </Section>
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
});
