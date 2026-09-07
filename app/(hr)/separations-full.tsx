/*
 * The full separation-case view — was `(hr)/(tabs)/separations.tsx`, the
 * Separations tab. Replaced on mobile by `(tabs)/separations.tsx`, which
 * reads the same context through `waa-hr-mobile-separations` and adds the
 * decision note the addendum asks for.
 *
 * Its data layer: no dedicated function was built for this screen; it
 * composes the same three functions built for the other screens
 * (`waa-hr-roster`'s list actions, `waa-hr-payroll-grid`'s list actions, and
 * `waa-hr-mobile-cash-advances`'s `list_all`) rather than duplicating
 * identical company-scoped queries in a fourth. Linked in `WebShell`'s nav
 * under "separations-full" since HR-DASHBOARD-RELOCATION-PROPOSAL.md's
 * Stage A (this file's header previously claimed otherwise — stale, fixed
 * 2026-09-07, see the same correction on payroll-grid.tsx).
 *
 * Reskinned onto the glass system 2026-09-07 — this was the one screen the
 * "Actual data tables, not white cards on a dark canvas" pass (CLAUDE.md)
 * never actually reached despite the rest of the dashboard having been
 * converted: each case still rendered inside `ui.tsx`'s `Card`, with
 * `colors.paper`/`colors.ink`/`colors.steel` hardcoded throughout its own
 * style sheet — a paper-white card sitting directly on the dark glass
 * canvas. All fetch/derive logic below is unchanged.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useHrAdmin } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import {
  fetchAllCashAdvances,
  fetchAllWorkers,
  fetchPayrollRuns,
  fetchPayslipsForRun,
  fetchSupervisors,
} from '../../src/lib/queries';
import type { WaaPayslip } from '../../src/lib/types';
import { EmptyState, Loader } from '../../src/components/ui';
import { toneForStatus } from '../../src/theme';
import { initialsOf, periodLabel, peso, relativeStamp } from '../../src/lib/format';
import { WebShell } from '../../src/web/WebShell';
import { useWebTheme } from '../../src/web/webTheme';
import { DoorExitIcon, WalletIcon } from '../../src/components/icons';
import {
  GlassCard,
  MetricCard,
  WebPageHeader,
  WebPill,
  WebSection,
  webToneFor,
} from '../../src/web/webUi';
import { BODY, T } from '../../src/web/nexusType';

/**
 * Separation inbox.
 *
 * Deliberately has no "decide" button and no status to set — the brief makes
 * this a manual judgment call every time, not an automated rule. What this
 * screen owes HR/Admin is the *context* for that call: who tagged the worker
 * and when, plus any pay that hasn't landed yet — payslips on runs that aren't
 * `paid`, and cash advances that aren't `settled`.
 *
 * Excluding a separated worker from future runs already happens on its own:
 * `waa-generate-payroll-run` only pulls `employment_status = 'active'`.
 */
export default function HrSeparations() {
  const hrAdmin = useHrAdmin();
  const { palette } = useWebTheme();

  const { data, loading, reload } = useAsync(async () => {
    const [workers, runs, advances, supervisors] = await Promise.all([
      fetchAllWorkers(),
      fetchPayrollRuns(),
      fetchAllCashAdvances(),
      fetchSupervisors(),
    ]);

    const separated = workers.filter((w) => w.employment_status !== 'active');

    // Only runs that haven't been paid out carry pending pay context.
    const openRuns = runs.filter((r) => r.status !== 'paid');
    const openSlips: (WaaPayslip & { runLabel: string; runStatus: string })[] = [];
    if (separated.length > 0) {
      const perRun = await Promise.all(
        openRuns.map(async (r) => {
          const slips = await fetchPayslipsForRun(r.id);
          return slips.map((sl) => ({
            ...sl,
            runLabel: periodLabel(r.period_start, r.period_end),
            runStatus: r.status,
          }));
        })
      );
      openSlips.push(...perRun.flat());
    }

    return { separated, openSlips, advances, supervisors };
  }, [hrAdmin.id]);

  const supervisorName = useMemo(() => {
    const map = new Map<string, string>();
    for (const sup of data?.supervisors ?? []) map.set(sup.id, sup.full_name);
    return map;
  }, [data?.supervisors]);

  const cases = useMemo(() => {
    return (data?.separated ?? []).map((w) => {
      const slips = (data?.openSlips ?? []).filter((sl) => sl.worker_id === w.id);
      const advances = (data?.advances ?? []).filter(
        (a) => a.worker_id === w.id && a.status !== 'settled' && a.status !== 'declined'
      );
      const owed = slips.reduce((sum, sl) => sum + Number(sl.net_pay), 0);
      const advanceTotal = advances.reduce((sum, a) => sum + Number(a.money?.amount ?? 0), 0);
      return { worker: w, slips, advances, owed, advanceTotal };
    });
  }, [data]);

  const withPending = cases.filter((c) => c.slips.length > 0 || c.advances.length > 0).length;

  return (
    <WebShell active="separations-full" title="Separations" subtitle="Tagged by a supervisor · pay outcome is your call">
      <WebPageHeader eyebrow="System" title="Separation cases" sub="Tagged by a supervisor · pay outcome is your call." />

      <View style={s.statGrid}>
        <MetricCard
          style={s.statItem}
          icon={<DoorExitIcon color={palette.warn} size={17} />}
          iconBg={palette.warnBg}
          label="Separated"
          value={cases.length.toLocaleString()}
          trendPct={null}
        />
        <MetricCard
          style={s.statItem}
          icon={<WalletIcon color={palette.info} size={17} />}
          iconBg={palette.infoBg}
          label="With pending pay"
          value={withPending.toLocaleString()}
          trendPct={null}
        />
        <MetricCard
          style={s.statItem}
          icon={<DoorExitIcon color={palette.good} size={17} />}
          iconBg={palette.goodBg}
          label="Nothing pending"
          value={(cases.length - withPending).toLocaleString()}
          trendPct={null}
        />
      </View>

        {loading && !data ? (
          <Loader label="Gathering cases" />
        ) : cases.length === 0 ? (
          <EmptyState
            title="No separation cases"
            body="Workers tagged Terminated, AWOL or Resigned by their supervisor appear here with their pending pay context."
          />
        ) : (
          <WebSection title="Cases">
            {cases.map((c) => (
              <GlassCard key={c.worker.id} style={{ marginBottom: 12 }}>
                <Pressable
                  onPress={() => router.push(`/(hr)/worker/${c.worker.id}`)}
                  style={({ pressed }) => [s.head, pressed && { opacity: 0.7 }]}
                >
                  <View style={[s.avatar, { backgroundColor: palette.hover, borderColor: palette.border }]}>
                    <Text style={{ fontSize: 12, fontFamily: BODY.bold, color: palette.text }}>
                      {initialsOf(c.worker.full_name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.cardTitle, { color: palette.text }]}>{c.worker.full_name}</Text>
                    <Text style={[T.bodySm, { color: palette.muted, marginTop: 2 }]}>
                      {c.worker.position || 'No position'} ·{' '}
                      {c.worker.employment_status_set_by
                        ? (supervisorName.get(c.worker.employment_status_set_by) ??
                          `supervisor ${c.worker.employment_status_set_by.slice(0, 8)}`)
                        : 'unknown supervisor'}
                    </Text>
                    <Text style={[T.bodySm, { color: palette.muted2, marginTop: 3 }]}>
                      Tagged{' '}
                      {c.worker.employment_status_set_at
                        ? relativeStamp(c.worker.employment_status_set_at)
                        : 'at an unrecorded time'}
                    </Text>
                  </View>
                  <WebPill
                    label={c.worker.employment_status}
                    tone={webToneFor(toneForStatus(c.worker.employment_status))}
                  />
                </Pressable>

                <View style={[s.rule, { backgroundColor: palette.border }]} />

                {c.slips.length === 0 && c.advances.length === 0 ? (
                  <Text style={[T.bodySm, { color: palette.good, lineHeight: 17, fontFamily: BODY.semibold }]}>
                    No unfinalized payslips and no outstanding cash advances. Nothing to decide.
                  </Text>
                ) : (
                  <>
                    {c.slips.map((sl) => (
                      <View key={sl.id} style={s.pendingRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[T.bodySm, { fontFamily: BODY.semibold, color: palette.text, fontSize: 12.5 }]}>
                            Payslip · {sl.runLabel}
                          </Text>
                          <Text style={[T.bodySm, { color: palette.muted, marginTop: 1 }]}>Run is {sl.runStatus}</Text>
                        </View>
                        <Text style={[T.figureStrong, { color: palette.text, fontSize: 13 }]}>{peso(sl.net_pay)}</Text>
                      </View>
                    ))}
                    {c.advances.map((a) => (
                      <View key={a.id} style={s.pendingRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[T.bodySm, { fontFamily: BODY.semibold, color: palette.text, fontSize: 12.5 }]}>
                            Cash advance · {a.status.replace('_', ' ')}
                          </Text>
                          <Text style={[T.bodySm, { color: palette.muted, marginTop: 1 }]}>{a.reason || 'No reason given'}</Text>
                        </View>
                        <Text style={[T.figureStrong, { color: palette.text, fontSize: 13 }]}>
                          {a.money ? peso(a.money.amount) : '—'}
                        </Text>
                      </View>
                    ))}
                    <Text style={[T.bodySm, { color: palette.warn, lineHeight: 17, marginTop: 10 }]}>
                      Unpaid net {peso(c.owed)} · unsettled advances {peso(c.advanceTotal)}. Decide
                      by hand what happens to these — nothing here forfeits or releases anything
                      automatically.
                    </Text>
                  </>
                )}
              </GlassCard>
            ))}
          </WebSection>
        )}
    </WebShell>
  );
}

const s = StyleSheet.create({
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  statItem: { flexGrow: 1, flexBasis: 180, minWidth: 160 },
  head: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rule: { height: 1, marginVertical: 12 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
});
