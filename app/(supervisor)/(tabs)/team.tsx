import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSupervisor } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchPayrollSettings,
  fetchTeamRows,
  fetchWorkerLeaveOverlapFlag,
  type TeamRow,
} from '../../../src/lib/queries';
import { EmptyState } from '../../../src/components/ui';
import { useWebTheme } from '../../../src/web/webTheme';
import { GlassButton, GlassCard, GlassOutlineButton, GlassPullScreen, MetricCard, WebPill, WorkerCell } from '../../../src/web/webUi';
import { WebPalette } from '../../../src/web/webTheme';
import { cutoffFor, dateRange, hours, toDateColumn } from '../../../src/lib/format';

/**
 * Supervisor Team tab.
 *
 * Deliberately money-free: Worker | Position | Days | Hours | Paid leave |
 * Unpaid leave | Flags | Run status, and nothing else. There is no Regular,
 * Overtime, Leave pay, Gross, Cash advance, Statutory or Net pay column here —
 * not hidden, absent. Every table those figures live in (`waa_worker_pay`,
 * `waa_payslips`, `waa_cash_advance_money`, …) has zero Supervisor RLS policy,
 * so a supervisor's own API calls cannot return one regardless of what this
 * screen renders.
 *
 * Scope is the supervisor's own `employment_status = 'active'` workers — the
 * active filter is applied in the query, which is what makes a separated
 * worker disappear from here immediately after tagging.
 *
 * Same "keep the hand-rolled fixed-width table, only make its colors
 * theme-reactive" call `(hr)/payroll-grid.tsx` made — this is a dense
 * 8-column table too, not a fit for the generic flex-based `DataTable`.
 */
export default function TeamScreen() {
  const supervisor = useSupervisor();
  const { palette } = useWebTheme();
  const gs = useMemo(() => glassStyles(palette), [palette]);
  const [detail, setDetail] = useState<TeamRow | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const settings = await fetchPayrollSettings();
    const window = cutoffFor(settings?.cutoff_type ?? 'semi_monthly');
    const rows = await fetchTeamRows(toDateColumn(window.start), toDateColumn(window.end));

    // The locally-computed overlap above is what lets us list the offending
    // requests; this RPC is the same function the draft -> reviewed trigger
    // calls, so the badge shown here matches what will actually block HR's run.
    const flags = await Promise.all(
      rows.map((r) => fetchWorkerLeaveOverlapFlag(r.worker.id).catch(() => r.flagged))
    );

    return {
      window,
      rows: rows.map((r, i) => ({ ...r, flagged: flags[i] })),
    };
  }, [supervisor.id]);

  const rows = data?.rows ?? [];

  const totals = useMemo(
    () => ({
      workers: rows.length,
      hours: rows.reduce((sum, r) => sum + r.hours, 0),
      flagged: rows.filter((r) => r.flagged).length,
    }),
    [rows]
  );

  return (
    <GlassPullScreen loading={loading} onRefresh={reload}>
      <Text style={{ fontSize: 11, letterSpacing: 1, color: palette.muted, fontWeight: '700' }}>CURRENT CUTOFF</Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginTop: 3 }}>{data?.window.label ?? '—'}</Text>
      <Text style={{ fontSize: 13, color: palette.muted, marginTop: 2, marginBottom: 16 }}>
        Hours and leave that feed payroll · no pay figures on this screen
      </Text>

      <View style={{ flexDirection: 'row', gap: 9, marginBottom: 16 }}>
        <MetricCard style={{ flex: 1, padding: 12 }} label="Active workers" value={String(totals.workers)} trendPct={null} />
        <MetricCard style={{ flex: 1, padding: 12 }} label="Hours logged" value={String(Math.round(totals.hours))} trendPct={null} />
        <MetricCard style={{ flex: 1, padding: 12 }} label="Open flags" value={String(totals.flagged)} trendPct={null} />
      </View>

      {totals.flagged > 0 ? (
        <GlassCard style={{ marginBottom: 16, borderColor: palette.bad, gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: palette.bad }}>
            {totals.flagged} worker{totals.flagged === 1 ? '' : 's'} flagged
          </Text>
          <Text style={{ fontSize: 11.5, color: palette.bad, lineHeight: 17 }}>
            Overlapping leave requests block the office from moving this period's payroll run out
            of draft. Open a flagged worker below to see and resolve the requests.
          </Text>
        </GlassCard>
      ) : null}

      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 10 }}>Your team</Text>
      {loading && !data ? (
        <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 16 }}>Adding up hours…</Text>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No active workers"
          body="Workers you register appear here. Separated workers drop off this list."
        />
      ) : (
        <View style={[gs.tableWrap]}>
          {/* Horizontal scroll so the full column set stays readable on a
              phone rather than being truncated into uselessness. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[s.row, gs.headRow]}>
                <Text style={[s.cell, s.cellWorker, gs.headText]}>Worker</Text>
                <Text style={[s.cell, s.cellWide, gs.headText]}>Position</Text>
                <Text style={[s.cell, s.cellNum, gs.headText]}>Days</Text>
                <Text style={[s.cell, s.cellNum, gs.headText]}>Hours</Text>
                <Text style={[s.cell, s.cellNum, gs.headText]}>Paid lv</Text>
                <Text style={[s.cell, s.cellNum, gs.headText]}>Unpaid lv</Text>
                <Text style={[s.cell, s.cellFlag, gs.headText]}>Flags</Text>
                <Text style={[s.cell, s.cellWide, gs.headText]}>Run status</Text>
              </View>

              {rows.map((r, i) => (
                <Pressable
                  key={r.worker.id}
                  onPress={() => setDetail(r)}
                  style={({ pressed }) => [
                    s.row,
                    gs.rowBorder,
                    i === rows.length - 1 && s.rowLast,
                    pressed && { backgroundColor: palette.hover },
                  ]}
                >
                  <View style={[s.cell, s.cellWorker]}>
                    <WorkerCell name={r.worker.full_name} />
                  </View>
                  <Text style={[s.cell, s.cellWide, gs.body]} numberOfLines={1}>
                    {r.worker.position || '—'}
                  </Text>
                  <Text style={[s.cell, s.cellNum, gs.body]}>{r.days}</Text>
                  <Text style={[s.cell, s.cellNum, gs.body]}>{r.hours}</Text>
                  <Text style={[s.cell, s.cellNum, gs.muted]}>n/a</Text>
                  <Text style={[s.cell, s.cellNum, gs.body]}>{r.unpaidLeaveDays}</Text>
                  <View style={[s.cell, s.cellFlag]}>
                    {r.flagged ? <WebPill label="Overlap" tone="bad" /> : <Text style={gs.muted}>—</Text>}
                  </View>
                  <Text style={[s.cell, s.cellWide, gs.muted]} numberOfLines={1}>
                    Office only
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <Text style={{ fontSize: 11, color: palette.muted, lineHeight: 16, marginTop: 12 }}>
        "Paid lv" and "Run status" are set by HR/Admin in tables supervisors have no access to, so
        they cannot be shown here. Every approved leave day this period is counted under
        "Unpaid lv".
      </Text>

      <TeamRowSheet row={detail} onClose={() => setDetail(null)} />
    </GlassPullScreen>
  );
}

/**
 * Row detail — the same numbers, plus the actual overlapping leave requests so
 * the supervisor can go and fix the source of the flag rather than only seeing
 * that one exists.
 */
function TeamRowSheet({ row, onClose }: { row: TeamRow | null; onClose: () => void }) {
  const { palette } = useWebTheme();
  if (!row) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: palette.panelSolid,
            borderWidth: 1,
            borderColor: palette.border,
            borderBottomWidth: 0,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            maxHeight: '85%',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{row.worker.full_name}</Text>
            <Text style={{ fontSize: 12.5, color: palette.muted, marginTop: 2 }}>{row.worker.position || 'No position set'}</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Stat label="Days worked" value={String(row.days)} />
              <Stat label="Hours" value={hours(row.hours)} />
              <Stat label="Leave days" value={String(row.unpaidLeaveDays)} />
            </View>

            {row.flagged ? (
              <>
                <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginTop: 22, marginBottom: 8 }}>
                  Overlapping leave requests
                </Text>
                {row.overlapping.length === 0 ? (
                  <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 18, marginTop: 10 }}>
                    The office's check reports an overlap for this worker. Open their leave requests
                    from the Approvals tab to resolve it.
                  </Text>
                ) : (
                  row.overlapping.map((l) => (
                    <View
                      key={l.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: palette.hover,
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12.5, fontWeight: '600', color: palette.text }}>
                          {l.leave_type} · {dateRange(l.date_from, l.date_to)}
                        </Text>
                        <Text style={{ fontSize: 11, color: palette.muted, marginTop: 2 }}>
                          {l.reason || 'No reason given'}
                        </Text>
                      </View>
                      <WebPill label={l.status} tone={l.status === 'pending' ? 'info' : 'good'} />
                    </View>
                  ))
                )}
                <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 18, marginTop: 10 }}>
                  Declining one of these clears the flag and unblocks the payroll run.
                </Text>
                <GlassButton
                  label="Go to leave approvals"
                  onPress={() => {
                    onClose();
                    router.push('/(supervisor)/(tabs)/approvals');
                  }}
                  style={{ marginTop: 12 }}
                />
              </>
            ) : (
              <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 18, marginTop: 16 }}>
                No open flags for this worker.
              </Text>
            )}

            <GlassOutlineButton
              label="Open worker profile"
              onPress={() => {
                onClose();
                router.push(`/(supervisor)/worker/${row.worker.id}`);
              }}
              style={{ marginTop: 10 }}
            />
            <GlassOutlineButton label="Close" onPress={onClose} style={{ marginTop: 10 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ flex: 1, backgroundColor: palette.hover, borderRadius: 14, padding: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{value}</Text>
      <Text style={{ fontSize: 10.5, color: palette.muted, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

/** Only the color-bearing keys — layout-only keys stay in the static `s`
 * StyleSheet below, same split `(hr)/payroll-grid.tsx` uses. */
function glassStyles(palette: WebPalette) {
  return StyleSheet.create({
    tableWrap: { backgroundColor: palette.panelSolid, borderWidth: 1, borderColor: palette.border, borderRadius: 15, overflow: 'hidden' },
    headRow: { backgroundColor: palette.hover, borderBottomColor: palette.border },
    headText: { fontSize: 10, letterSpacing: 0.6, color: palette.muted, fontWeight: '700' },
    rowBorder: { borderBottomColor: palette.border },
    body: { fontSize: 12.5, color: palette.text },
    muted: { fontSize: 12, color: palette.muted },
  });
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  cell: { paddingRight: 12 },
  cellWorker: { width: 150 },
  cellWide: { width: 90 },
  cellNum: { width: 58, textAlign: 'right' },
  cellFlag: { width: 76 },
});
