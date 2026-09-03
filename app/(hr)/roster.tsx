/*
 * The org-wide worker roster — was `(hr)/(tabs)/roster.tsx`, the Roster tab,
 * before HR-ADMIN-MOBILE-ACCESS-ADDENDUM.md narrowed HR/Admin's mobile
 * surface to three single-decision actions. This screen belongs to the full
 * HR/Admin surface, which lives on the web dashboard.
 *
 * Its data layer went through `waa-hr-roster` (company-scoped edge function)
 * in HR-DASHBOARD-RELOCATION-PROPOSAL.md's Stage A; the chrome below is
 * `WebShell` (R3U-WAA-WEB-REDESIGN.md), replacing `TopBar` + `ScreenBody` +
 * `HrDashboardNav`. Every list row still renders inside the plain `ui.tsx`
 * `Card`/`Pill` — a white card on the glass canvas reads fine as-is — so
 * only the chrome and the bits that used to sit directly on the paper
 * background (heading, filter chips, the unresolved-supervisor note) needed
 * a theme-aware color instead of `colors.*`.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useHrAdmin } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { fetchAllWorkers, fetchProjects, fetchSupervisors } from '../../src/lib/queries';
import { EmptyState, Loader, StatusStrip } from '../../src/components/ui';
import { toneForStatus } from '../../src/theme';
import { initialsOf } from '../../src/lib/format';
import { WebShell } from '../../src/web/WebShell';
import { useWebTheme } from '../../src/web/webTheme';
import {
  Chip,
  DataRow,
  DataTable,
  GlassButton,
  WebPageHeader,
  WebPill,
  WebSection,
  webToneFor,
} from '../../src/web/webUi';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * There is no "which workers report to which supervisor" table; the grouping
 * is just `waa_workers.supervisor_id`. Supervisor *names* need a SELECT on
 * `waa_supervisors`, which HR/Admin has no policy for in the deployed
 * schema — the group falls back to a short id label when the name can't be
 * resolved.
 */
export default function HrRoster() {
  const hrAdmin = useHrAdmin();
  const { palette } = useWebTheme();
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
    <WebShell active="roster" title="Roster" subtitle={`Across ${data?.projects.length ?? 0} site${(data?.projects.length ?? 0) === 1 ? '' : 's'}`}>
      <WebPageHeader eyebrow="Workforce" title="Everyone" sub="Every worker, grouped by the supervisor they report to." />

      <StatusStrip
        chips={[
          { value: active, label: 'Active workers', tone: 'ok' },
          { value: supervisorCount, label: 'Supervisors', tone: 'pending' },
          { value: separated, label: 'Separated', tone: 'warn' },
        ]}
      />

      <GlassButton
        label="Register a supervisor"
        onPress={() => router.push('/(hr)/register-supervisor')}
        style={{ marginBottom: 18 }}
      />

      <View style={s.filterRow}>
        {[
          { key: false, label: 'Active only' },
          { key: true, label: 'Include separated' },
        ].map((f) => (
          <Chip key={String(f.key)} label={f.label} active={showSeparated === f.key} onPress={() => setShowSeparated(f.key)} />
        ))}
      </View>

      {loading && !data ? (
        <Loader label="Loading roster" />
      ) : groups.length === 0 ? (
        <EmptyState
          title="No workers yet"
          body="Register a supervisor first — supervisors register their own workers."
        />
      ) : (
        groups.map((g) => {
          const cols = [
            { key: 'worker', label: 'Worker', flex: 2 },
            { key: 'phone', label: 'Phone', flex: 1 },
            { key: 'status', label: 'Status', flex: 1, align: 'right' as const },
          ];
          return (
            <WebSection key={g.key} title={g.label}>
              <DataTable columns={cols}>
                {g.workers.map((w, i) => (
                  <DataRow
                    key={w.id}
                    index={i}
                    columns={cols}
                    onPress={() => router.push(`/(hr)/worker/${w.id}`)}
                    values={{
                      worker: <WorkerCell name={w.full_name} sub={w.position || 'No position'} />,
                      phone: w.phone || '—',
                      status: <WebPill label={w.employment_status} tone={webToneFor(toneForStatus(w.employment_status))} />,
                    }}
                  />
                ))}
              </DataTable>
            </WebSection>
          );
        })
      )}

      {(data?.supervisors.length ?? 0) === 0 ? (
        <Text style={{ fontSize: 11, color: palette.muted, lineHeight: 16, marginBottom: 30 }}>
          Supervisor names can't be resolved from this account — `waa_supervisors` has no HR/Admin
          SELECT policy in the deployed schema, so groups are labelled by id.
        </Text>
      ) : null}
    </WebShell>
  );
}

/** The `.tname` pattern from the reference dashboard — a gradient avatar
 * initials mark, a bold name, a muted subtitle — used for every "who" column
 * across the redesigned data tables (Roster here; Payroll grid reuses it). */
export function WorkerCell({ name, sub }: { name: string; sub?: string }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LinearGradient
        colors={[palette.accent, palette.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{initialsOf(name)}</Text>
      </LinearGradient>
      <View style={{ minWidth: 0 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: palette.text }} numberOfLines={1}>
          {name}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 10.5, color: palette.muted }} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
});
