import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import { fetchProjects, fetchRoster, fetchTodaysEntries } from '../../../src/lib/queries';
import { supabase } from '../../../src/lib/supabase';
import type { WaaAssignmentWithProject } from '../../../src/lib/types';
import { EmptyState } from '../../../src/components/ui';
import { useWebTheme } from '../../../src/web/webTheme';
import {
  Chip,
  DataRow,
  DataTable,
  GlassButton,
  GlassPullScreen,
  WebPill,
  WebSection,
  WorkerCell,
} from '../../../src/web/webUi';

/** Full team roster, filterable by site, and the entry point for registration. */
export default function RosterScreen() {
  const supervisor = useSupervisor();
  const { palette } = useWebTheme();
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

  const cols = [
    { key: 'worker', label: 'Worker', flex: 2 },
    { key: 'site', label: 'Site', flex: 1 },
    { key: 'status', label: 'Status', flex: 1, align: 'right' as const },
  ];

  return (
    <GlassPullScreen loading={loading} onRefresh={reload}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text }}>Your team</Text>
      <Text style={{ fontSize: 13, color: palette.muted, marginTop: 2, marginBottom: 16 }}>
        {data?.roster.length ?? 0} worker{(data?.roster.length ?? 0) === 1 ? '' : 's'} registered
      </Text>

      <GlassButton
        label="Register a worker"
        onPress={() => router.push('/(supervisor)/register-worker')}
        style={{ marginBottom: 18 }}
      />

      {/* --------------------------- Site filter ------------------------ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 18 }}>
        <Chip label="All sites" active={siteFilter === null} onPress={() => setSiteFilter(null)} />
        {(data?.projects ?? []).map((p) => (
          <Chip key={p.id} label={p.name} active={siteFilter === p.id} onPress={() => setSiteFilter(p.id)} />
        ))}
      </ScrollView>

      <WebSection title={siteFilter ? 'Workers at this site' : 'All workers'}>
        {loading && !data ? (
          <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 16 }}>Loading…</Text>
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
          <DataTable columns={cols}>
            {filtered.map((w, i) => {
              const live = liveStatus.get(w.id);
              const label =
                w.status !== 'complete' ? 'Incomplete' : live === 'in' ? 'In' : live === 'out' ? 'Out' : 'Off';
              const tone = w.status !== 'complete' ? 'bad' : live === 'in' ? 'good' : 'muted';
              const sites = sitesByWorker.get(w.id) ?? [];
              const primary = sites.find((a) => a.is_primary) ?? sites[0];
              return (
                <DataRow
                  key={w.id}
                  index={i}
                  columns={cols}
                  onPress={() => router.push(`/(supervisor)/worker/${w.id}`)}
                  values={{
                    worker: <WorkerCell name={w.full_name} sub={w.phone || 'No phone on file'} />,
                    site: (
                      <View>
                        <Text style={{ fontSize: 12.5, color: palette.text }}>{primary?.project?.name ?? 'No site'}</Text>
                        {sites.length > 1 ? (
                          <Text style={{ fontSize: 10.5, color: palette.muted }}>+{sites.length - 1} more</Text>
                        ) : null}
                      </View>
                    ),
                    status: <WebPill label={label} tone={tone} />,
                  }}
                />
              );
            })}
          </DataTable>
        )}
      </WebSection>
    </GlassPullScreen>
  );
}
