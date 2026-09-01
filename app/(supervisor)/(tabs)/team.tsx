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
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import {
  Card,
  EmptyState,
  Loader,
  Pill,
  PrimaryButton,
  SecondaryButton,
  Section,
  StatusStrip,
} from '../../../src/components/ui';
import { colors, fonts, radius, spacing, type } from '../../../src/theme';
import { cutoffFor, dateRange, hours, initialsOf, toDateColumn } from '../../../src/lib/format';

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
 */
export default function TeamScreen() {
  const supervisor = useSupervisor();
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
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Team" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.eyebrow}>Current cutoff</Text>
        <Text style={type.greet}>{data?.window.label ?? '—'}</Text>
        <Text style={[type.subgreet, { marginBottom: 20 }]}>
          Hours and leave that feed payroll · no pay figures on this screen
        </Text>

        <StatusStrip
          chips={[
            { value: totals.workers, label: 'Active workers', tone: 'ok' },
            { value: Math.round(totals.hours), label: 'Hours logged', tone: 'pending' },
            { value: totals.flagged, label: 'Open flags', tone: 'warn' },
          ]}
        />

        {totals.flagged > 0 ? (
          <Card style={s.flagBanner}>
            <Text style={s.flagBannerTitle}>
              {totals.flagged} worker{totals.flagged === 1 ? '' : 's'} flagged
            </Text>
            <Text style={s.flagBannerBody}>
              Overlapping leave requests block the office from moving this period's payroll run out
              of draft. Open a flagged worker below to see and resolve the requests.
            </Text>
          </Card>
        ) : null}

        <Section title="Your team">
          {loading && !data ? (
            <Loader label="Adding up hours" />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No active workers"
              body="Workers you register appear here. Separated workers drop off this list."
            />
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {/* Horizontal scroll so the full column set stays readable on a
                  phone rather than being truncated into uselessness. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={[s.row, s.headRow]}>
                    <Text style={[s.cell, s.cellWorker, s.headText]}>Worker</Text>
                    <Text style={[s.cell, s.cellWide, s.headText]}>Position</Text>
                    <Text style={[s.cell, s.cellNum, s.headText]}>Days</Text>
                    <Text style={[s.cell, s.cellNum, s.headText]}>Hours</Text>
                    <Text style={[s.cell, s.cellNum, s.headText]}>Paid lv</Text>
                    <Text style={[s.cell, s.cellNum, s.headText]}>Unpaid lv</Text>
                    <Text style={[s.cell, s.cellFlag, s.headText]}>Flags</Text>
                    <Text style={[s.cell, s.cellWide, s.headText]}>Run status</Text>
                  </View>

                  {rows.map((r, i) => (
                    <Pressable
                      key={r.worker.id}
                      onPress={() => setDetail(r)}
                      style={({ pressed }) => [
                        s.row,
                        i === rows.length - 1 && s.rowLast,
                        pressed && { backgroundColor: colors.paper },
                      ]}
                    >
                      <View style={[s.cell, s.cellWorker, s.workerCell]}>
                        <View style={s.avatar}>
                          <Text style={s.initials}>{initialsOf(r.worker.full_name)}</Text>
                        </View>
                        <Text style={s.name} numberOfLines={1}>
                          {r.worker.full_name}
                        </Text>
                      </View>
                      <Text style={[s.cell, s.cellWide, s.body]} numberOfLines={1}>
                        {r.worker.position || '—'}
                      </Text>
                      <Text style={[s.cell, s.cellNum, s.body]}>{r.days}</Text>
                      <Text style={[s.cell, s.cellNum, s.body]}>{r.hours}</Text>
                      <Text style={[s.cell, s.cellNum, s.muted]}>n/a</Text>
                      <Text style={[s.cell, s.cellNum, s.body]}>{r.unpaidLeaveDays}</Text>
                      <View style={[s.cell, s.cellFlag]}>
                        {r.flagged ? (
                          <Pill label="Overlap" tone="warn" />
                        ) : (
                          <Text style={s.muted}>—</Text>
                        )}
                      </View>
                      <Text style={[s.cell, s.cellWide, s.muted]} numberOfLines={1}>
                        Office only
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Card>
          )}

          <Text style={s.footnote}>
            "Paid lv" and "Run status" are set by HR/Admin in tables supervisors have no access to,
            so they cannot be shown here. Every approved leave day this period is counted under
            "Unpaid lv".
          </Text>
        </Section>
      </ScreenBody>

      <TeamRowSheet row={detail} onClose={() => setDetail(null)} />
    </View>
  );
}

/**
 * Row detail — the same numbers, plus the actual overlapping leave requests so
 * the supervisor can go and fix the source of the flag rather than only seeing
 * that one exists.
 */
function TeamRowSheet({ row, onClose }: { row: TeamRow | null; onClose: () => void }) {
  if (!row) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}>
            <Text style={s.sheetTitle}>{row.worker.full_name}</Text>
            <Text style={s.sheetSub}>{row.worker.position || 'No position set'}</Text>

            <View style={s.statGrid}>
              <Stat label="Days worked" value={String(row.days)} />
              <Stat label="Hours" value={hours(row.hours)} />
              <Stat label="Leave days" value={String(row.unpaidLeaveDays)} />
            </View>

            {row.flagged ? (
              <>
                <Text style={[type.sectionTitle, { marginTop: spacing.xl, marginBottom: 8 }]}>
                  Overlapping leave requests
                </Text>
                {row.overlapping.length === 0 ? (
                  <Text style={s.sheetBody}>
                    The office's check reports an overlap for this worker. Open their leave requests
                    from the Approvals tab to resolve it.
                  </Text>
                ) : (
                  row.overlapping.map((l) => (
                    <View key={l.id} style={s.leaveRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.leaveTitle}>
                          {l.leave_type} · {dateRange(l.date_from, l.date_to)}
                        </Text>
                        <Text style={s.leaveSub}>{l.reason || 'No reason given'}</Text>
                      </View>
                      <Pill label={l.status} tone={l.status === 'pending' ? 'pending' : 'ok'} />
                    </View>
                  ))
                )}
                <Text style={s.sheetBody}>
                  Declining one of these clears the flag and unblocks the payroll run.
                </Text>
                <PrimaryButton
                  label="Go to leave approvals"
                  onPress={() => {
                    onClose();
                    router.push('/(supervisor)/(tabs)/approvals');
                  }}
                  style={{ marginTop: 12 }}
                />
              </>
            ) : (
              <Text style={[s.sheetBody, { marginTop: spacing.lg }]}>
                No open flags for this worker.
              </Text>
            )}

            <SecondaryButton
              label="Open worker profile"
              onPress={() => {
                onClose();
                router.push(`/(supervisor)/worker/${row.worker.id}`);
              }}
              style={{ marginTop: 10 }}
            />
            <SecondaryButton label="Close" onPress={onClose} style={{ marginTop: 10 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flagBanner: { backgroundColor: colors.warnBg, borderColor: colors.warn, gap: 4 },
  flagBannerTitle: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.warn },
  flagBannerBody: { fontSize: 11.5, color: colors.warn, lineHeight: 17, fontFamily: fonts.body },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  headRow: { backgroundColor: colors.paper },
  headText: { fontSize: 10, letterSpacing: 0.6, color: colors.muted, fontFamily: fonts.bodyBold },
  cell: { paddingRight: 12 },
  cellWorker: { width: 150 },
  cellWide: { width: 90 },
  cellNum: { width: 58, textAlign: 'right' },
  cellFlag: { width: 76 },
  workerCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 10, fontFamily: fonts.bodyBold, color: colors.steel },
  name: { flex: 1, fontSize: 12.5, fontFamily: fonts.bodySemi, color: colors.ink },
  body: { fontSize: 12.5, color: colors.ink, fontFamily: fonts.body },
  muted: { fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  footnote: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 12,
    fontFamily: fonts.body,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,27,24,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '85%',
  },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 22, fontWeight: '700', color: colors.ink },
  sheetSub: { fontSize: 12.5, color: colors.muted, marginTop: 2, fontFamily: fonts.body },
  sheetBody: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 10,
    fontFamily: fonts.body,
  },
  statGrid: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 12,
  },
  statValue: { fontFamily: fonts.serif, fontSize: 20, fontWeight: '700', color: colors.ink },
  statLabel: { fontSize: 10.5, color: colors.muted, marginTop: 3, fontFamily: fonts.body },
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  leaveTitle: { fontSize: 12.5, fontFamily: fonts.bodySemi, color: colors.ink },
  leaveSub: { fontSize: 11, color: colors.muted, marginTop: 2, fontFamily: fonts.body },
});
