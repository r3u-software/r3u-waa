/*
 * ORPHANED SCREEN — not reachable from the app's navigation.
 *
 * The full separation-case view — was `(hr)/(tabs)/separations.tsx`, the
 * Separations tab. Replaced on mobile by `(tabs)/separations.tsx`, which reads
 * the same context through `waa-hr-mobile-separations` and adds the decision
 * note the addendum asks for.
 *
 * Per HR-ADMIN-MOBILE-ACCESS-ADDENDUM.md (resolved as Option A in
 * ADDENDA-PROPOSAL.md), HR/Admin's mobile surface is now exactly three
 * single-decision actions plus Notifications and Profile. This screen belongs
 * to the full HR/Admin surface, which lives on the web dashboard — so nothing
 * in the tab bar or any link points at it any more.
 *
 * It is kept, unwired, as a starting point for that separate web dashboard.
 * As written it CANNOT WORK on mobile: it queries `waa_workers`, `waa_payroll_runs`, `waa_payslips` and `waa_cash_advance_money` directly, and
 * HR/Admin's direct-table RLS grants on those were revoked. Rebuilding it for
 * the web means rewiring every query here onto purpose-built edge functions
 * first.
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
import { ScreenBody, TopBar } from '../../src/components/Screen';
import { Card, EmptyState, Loader, Pill, Section, StatusStrip } from '../../src/components/ui';
import { colors, fonts, radius, toneForStatus, type } from '../../src/theme';
import { initialsOf, periodLabel, peso, relativeStamp } from '../../src/lib/format';

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
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Separations" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.greet}>Separation cases</Text>
        <Text style={[type.subgreet, { marginBottom: 18 }]}>
          Tagged by a supervisor · pay outcome is your call
        </Text>

        <StatusStrip
          chips={[
            { value: cases.length, label: 'Separated', tone: 'warn' },
            { value: withPending, label: 'With pending pay', tone: 'pending' },
            { value: cases.length - withPending, label: 'Nothing pending', tone: 'ok' },
          ]}
        />

        {loading && !data ? (
          <Loader label="Gathering cases" />
        ) : cases.length === 0 ? (
          <EmptyState
            title="No separation cases"
            body="Workers tagged Terminated, AWOL or Resigned by their supervisor appear here with their pending pay context."
          />
        ) : (
          <Section title="Cases">
            {cases.map((c) => (
              <Card key={c.worker.id}>
                <Pressable
                  onPress={() => router.push(`/(hr)/worker/${c.worker.id}`)}
                  style={({ pressed }) => [s.head, pressed && { opacity: 0.7 }]}
                >
                  <View style={s.avatar}>
                    <Text style={s.initials}>{initialsOf(c.worker.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.cardTitle}>{c.worker.full_name}</Text>
                    <Text style={type.cardSub}>
                      {c.worker.position || 'No position'} ·{' '}
                      {c.worker.employment_status_set_by
                        ? (supervisorName.get(c.worker.employment_status_set_by) ??
                          `supervisor ${c.worker.employment_status_set_by.slice(0, 8)}`)
                        : 'unknown supervisor'}
                    </Text>
                    <Text style={s.stamp}>
                      Tagged{' '}
                      {c.worker.employment_status_set_at
                        ? relativeStamp(c.worker.employment_status_set_at)
                        : 'at an unrecorded time'}
                    </Text>
                  </View>
                  <Pill
                    label={c.worker.employment_status}
                    tone={toneForStatus(c.worker.employment_status)}
                  />
                </Pressable>

                <View style={s.rule} />

                {c.slips.length === 0 && c.advances.length === 0 ? (
                  <Text style={s.clean}>
                    No unfinalized payslips and no outstanding cash advances. Nothing to decide.
                  </Text>
                ) : (
                  <>
                    {c.slips.map((sl) => (
                      <View key={sl.id} style={s.pendingRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.pendingTitle}>Payslip · {sl.runLabel}</Text>
                          <Text style={s.pendingSub}>Run is {sl.runStatus}</Text>
                        </View>
                        <Text style={s.pendingAmount}>{peso(sl.net_pay)}</Text>
                      </View>
                    ))}
                    {c.advances.map((a) => (
                      <View key={a.id} style={s.pendingRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.pendingTitle}>
                            Cash advance · {a.status.replace('_', ' ')}
                          </Text>
                          <Text style={s.pendingSub}>{a.reason || 'No reason given'}</Text>
                        </View>
                        <Text style={s.pendingAmount}>
                          {a.money ? peso(a.money.amount) : '—'}
                        </Text>
                      </View>
                    ))}
                    <Text style={s.judgement}>
                      Unpaid net {peso(c.owed)} · unsettled advances {peso(c.advanceTotal)}. Decide
                      by hand what happens to these — nothing here forfeits or releases anything
                      automatically.
                    </Text>
                  </>
                )}
              </Card>
            ))}
          </Section>
        )}
      </ScreenBody>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.steel },
  stamp: { fontSize: 11, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 12 },
  clean: { fontSize: 11.5, color: colors.ok, lineHeight: 17, fontFamily: fonts.bodySemi },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  pendingTitle: { fontSize: 12.5, fontFamily: fonts.bodySemi, color: colors.ink },
  pendingSub: { fontSize: 10.5, color: colors.muted, marginTop: 1, fontFamily: fonts.body },
  pendingAmount: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.ink },
  judgement: {
    fontSize: 11.5,
    color: colors.safetyDeep,
    lineHeight: 17,
    marginTop: 10,
    fontFamily: fonts.body,
  },
});
