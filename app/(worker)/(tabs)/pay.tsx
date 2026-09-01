import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useWorker } from '../../../src/lib/session';
import { useAsync } from '../../../src/lib/useAsync';
import {
  fetchLeaveInWindow,
  fetchMyHourlyRate,
  fetchMyPayslips,
  fetchPayrollSettings,
  fetchWorkerCashAdvances,
  fetchWorkerTimeEntries,
} from '../../../src/lib/queries';
import type { WaaPayslip } from '../../../src/lib/types';
import { ScreenBody, TopBar } from '../../../src/components/Screen';
import {
  Card,
  EmptyState,
  ListCard,
  Loader,
  Pill,
  PrimaryButton,
  Section,
  StatusStrip,
} from '../../../src/components/ui';
import { CashIcon, FileIcon, SiteGlyph } from '../../../src/components/icons';
import { colors, fonts, radius, spacing, toneForStatus, type } from '../../../src/theme';
import {
  cutoffFor,
  hours,
  peso,
  relativeStamp,
  shortDate,
  timeOfDay,
  toDateColumn,
} from '../../../src/lib/format';

/**
 * Pay tab.
 *
 * Two halves:
 *
 * 1. A **running estimate** for the current, unfinished cutoff, computed
 *    client-side from the worker's own approved punches and the org-wide
 *    settings row (both of which they can read). It is explicitly labelled an
 *    estimate: the leave-pay master switch and the deduction overrides live in
 *    tables only HR/Admin can read, so nothing here can resolve whether a
 *    given leave day is paid or which statutory lines apply. Those figures
 *    only become real on the payslip.
 *
 * 2. **Past payslips**, from runs that actually reached `paid`. The worker has
 *    no policy on `waa_payroll_runs`, so the visible marker is the payslip's
 *    own `paid_at` stamp rather than the parent run's status.
 */
export default function WorkerPay() {
  const worker = useWorker();
  const [open, setOpen] = useState<WaaPayslip | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const settings = await fetchPayrollSettings();
    const window = cutoffFor(settings?.cutoff_type ?? 'semi_monthly');
    const periodStart = toDateColumn(window.start);
    const periodEnd = toDateColumn(window.end);

    const [rate, entries, leaves, advances, payslips] = await Promise.all([
      fetchMyHourlyRate(worker.id),
      fetchWorkerTimeEntries(worker.id, 120),
      fetchLeaveInWindow(worker.id, periodStart, periodEnd),
      fetchWorkerCashAdvances(worker.id),
      fetchMyPayslips(worker.id),
    ]);

    return { settings, window, periodStart, periodEnd, rate, entries, leaves, advances, payslips };
  }, [worker.id]);

  /** Punches inside the current cutoff, newest first. */
  const cutoffEntries = useMemo(() => {
    if (!data) return [];
    const startMs = data.window.start.getTime();
    const endMs = data.window.end.getTime();
    return data.entries.filter((e) => {
      const t = new Date(e.entry_timestamp).getTime();
      return t >= startMs && t <= endMs;
    });
  }, [data]);

  /**
   * Pair each day's first 'in' with its last 'out' — the same rule the payroll
   * engine uses, so the estimate and the eventual payslip line up.
   */
  const estimate = useMemo(() => {
    const standard = Number(data?.settings?.standard_hours_per_day ?? 8);
    const otRate = Number(data?.settings?.overtime_rate_ordinary ?? 1.25);
    const rate = data?.rate ?? null;

    const byDay = new Map<string, { in?: string; out?: string }>();
    for (const e of cutoffEntries) {
      if (e.status !== 'approved') continue;
      const key = e.entry_timestamp.slice(0, 10);
      const slot = byDay.get(key) ?? {};
      if (e.type === 'in' && !slot.in) slot.in = e.entry_timestamp;
      if (e.type === 'out') slot.out = e.entry_timestamp;
      byDay.set(key, slot);
    }

    let worked = 0;
    let overtime = 0;
    let days = 0;
    for (const slot of byDay.values()) {
      if (!slot.in || !slot.out) continue;
      days += 1;
      const raw = Math.max(
        0,
        (new Date(slot.out).getTime() - new Date(slot.in).getTime()) / 3_600_000
      );
      worked += Math.min(raw, standard);
      overtime += Math.max(0, raw - standard);
    }

    const regularPay = rate == null ? null : worked * rate;
    const overtimePay = rate == null ? null : overtime * rate * otRate;
    const gross = regularPay == null || overtimePay == null ? null : regularPay + overtimePay;

    return { days, worked, overtime, otRate, standard, rate, regularPay, overtimePay, gross };
  }, [cutoffEntries, data]);

  const leaveDays = useMemo(() => {
    if (!data) return 0;
    return data.leaves.reduce((sum, l) => {
      const from = l.date_from > data.periodStart ? l.date_from : data.periodStart;
      const to = l.date_to < data.periodEnd ? l.date_to : data.periodEnd;
      const fromMs = new Date(`${from}T00:00:00Z`).getTime();
      const toMs = new Date(`${to}T00:00:00Z`).getTime();
      if (toMs < fromMs) return sum;
      return sum + Math.round((toMs - fromMs) / 86_400_000) + 1;
    }, 0);
  }, [data]);

  /** Advances released but not yet deducted — they'll land on a future slip. */
  const outstandingAdvances = useMemo(
    () => (data?.advances ?? []).filter((a) => a.status === 'paid_out'),
    [data?.advances]
  );
  const outstandingTotal = outstandingAdvances.reduce(
    (sum, a) => sum + Number(a.money?.amount ?? 0),
    0
  );

  const pending = cutoffEntries.filter((e) => e.status === 'pending').length;

  /* Group punches by calendar day for the day-by-day list. */
  const byDay = useMemo(() => {
    const map = new Map<string, typeof cutoffEntries>();
    for (const e of cutoffEntries) {
      const key = new Date(e.entry_timestamp).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return Array.from(map.entries());
  }, [cutoffEntries]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Pay" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <Text style={type.eyebrow}>Current cutoff</Text>
        <Text style={type.greet}>{data?.window.label ?? '—'}</Text>
        <Text style={[type.subgreet, { marginBottom: 20 }]}>
          Running estimate · final figures come from your payslip
        </Text>

        {loading && !data ? (
          <Loader label="Working out your estimate" />
        ) : (
          <>
            {/* ------------------------ Running estimate -------------------- */}
            <Card style={s.estimateCard}>
              <Text style={s.estimateLabel}>Estimated gross so far</Text>
              <Text style={s.estimateAmount}>
                {estimate.gross == null ? '—' : peso(estimate.gross)}
              </Text>
              {estimate.rate == null ? (
                <Text style={s.estimateNote}>
                  No hourly rate is on file for you yet, so we can't estimate an amount. The office
                  sets this.
                </Text>
              ) : (
                <Text style={s.estimateNote}>
                  {estimate.days} day{estimate.days === 1 ? '' : 's'} · {hours(estimate.worked)}{' '}
                  worked at {peso(estimate.rate)}/hr
                  {estimate.overtime > 0
                    ? ` · ${hours(estimate.overtime)} overtime at ${Math.round(
                        estimate.otRate * 100
                      )}%`
                    : ''}
                </Text>
              )}
              <Text style={s.estimateDisclaimer}>
                This is an estimate from your approved punches only. Leave pay, statutory
                deductions and any cash advance are worked out by the office when payroll runs.
              </Text>
            </Card>

            <StatusStrip
              chips={[
                { value: estimate.days, label: 'Days worked', tone: 'ok' },
                { value: pending, label: 'Awaiting review', tone: 'pending' },
                { value: leaveDays, label: 'Leave days', tone: 'warn' },
              ]}
            />

            {outstandingTotal > 0 ? (
              <Card style={s.advanceCard}>
                <Text style={s.advanceLabel}>Advances released, not yet deducted</Text>
                <Text style={s.advanceAmount}>{peso(outstandingTotal)}</Text>
                <Text style={s.advanceNote}>
                  This will be taken off an upcoming payslip.
                </Text>
              </Card>
            ) : null}

            {/* --------------------------- Payslips ------------------------- */}
            <Section title="Payslips">
              {(data?.payslips.length ?? 0) === 0 ? (
                <EmptyState
                  title="No payslips yet"
                  body="A payslip appears here once the office marks its payroll run as paid."
                />
              ) : (
                data!.payslips.map((p) => (
                  <ListCard
                    key={p.id}
                    iconBg={colors.okBg}
                    icon={<FileIcon size={17} color={colors.ok} />}
                    title={peso(p.net_pay)}
                    subtitle={`Net pay · paid ${
                      p.paid_at ? relativeStamp(p.paid_at) : 'recently'
                    }\n${hours(p.worked_hours)} worked${
                      Number(p.overtime_hours) > 0 ? ` · ${hours(p.overtime_hours)} OT` : ''
                    }`}
                    tone="ok"
                    pillLabel="Paid"
                    onPress={() => setOpen(p)}
                  />
                ))
              )}
            </Section>

            {/* ------------------------ Days this cutoff -------------------- */}
            <Section title="Days in this cutoff">
              {byDay.length === 0 ? (
                <EmptyState
                  title="No punches this cutoff"
                  body="Days you clock in and out will be listed here."
                />
              ) : (
                byDay.map(([day, dayEntries]) => {
                  const inPunch = dayEntries.find((e) => e.type === 'in');
                  const outPunch = dayEntries.find((e) => e.type === 'out');
                  const worstStatus = dayEntries.some((e) => e.status === 'declined')
                    ? 'declined'
                    : dayEntries.some((e) => e.status === 'pending')
                      ? 'pending'
                      : 'approved';
                  return (
                    <ListCard
                      key={day}
                      iconBg={colors.neutralBg}
                      icon={<SiteGlyph size={17} color={colors.steel} />}
                      title={new Date(day).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                      subtitle={`In ${inPunch ? timeOfDay(inPunch.entry_timestamp) : '—'} · Out ${
                        outPunch ? timeOfDay(outPunch.entry_timestamp) : '—'
                      }\n${inPunch?.project?.name ?? outPunch?.project?.name ?? ''}`}
                      tone={toneForStatus(worstStatus)}
                      pillLabel={worstStatus}
                    />
                  );
                })
              )}
            </Section>

            {/* --------------------------- Advances ------------------------- */}
            <Section title="Cash advances">
              {(data?.advances.length ?? 0) === 0 ? (
                <EmptyState title="No advances" body="Advances you ask for will be listed here." />
              ) : (
                data!.advances.slice(0, 8).map((a) => (
                  <ListCard
                    key={a.id}
                    iconBg={colors.neutralBg}
                    icon={<CashIcon size={17} color={colors.steel} />}
                    title={a.money ? peso(a.money.amount) : 'Cash advance'}
                    subtitle={`${a.reason || 'No reason given'} · ${relativeStamp(a.created_at)}`}
                    tone={toneForStatus(a.status)}
                    pillLabel={a.status === 'pending' ? 'requested' : a.status.replace('_', ' ')}
                  />
                ))
              )}
            </Section>
          </>
        )}
      </ScreenBody>

      {/* ------------------------- Payslip breakdown ---------------------- */}
      <PayslipSheet slip={open} onClose={() => setOpen(null)} />
    </View>
  );
}

/** The full per-line breakdown, matching the layout of a printed payslip. */
function PayslipSheet({ slip, onClose }: { slip: WaaPayslip | null; onClose: () => void }) {
  if (!slip) return null;
  const statutory =
    Number(slip.sss_deducted) +
    Number(slip.pagibig_deducted) +
    Number(slip.philhealth_deducted) +
    Number(slip.withholding_tax_deducted);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}>
            <View style={s.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Payslip</Text>
                <Text style={s.sheetSub}>
                  Paid {slip.paid_at ? shortDate(slip.paid_at.slice(0, 10)) : '—'}
                </Text>
              </View>
              <Pill label="Paid" tone="ok" />
            </View>

            <Line label="Worked hours" value={hours(slip.worked_hours)} amount={slip.regular_pay} />
            <Line
              label="Overtime"
              value={hours(slip.overtime_hours)}
              amount={slip.overtime_pay}
            />
            <Line
              label="Paid leave"
              value={hours(slip.paid_leave_hours)}
              amount={slip.leave_pay}
            />
            <Line
              label="Unpaid leave"
              value={`${slip.unpaid_leave_days} day${
                Number(slip.unpaid_leave_days) === 1 ? '' : 's'
              }`}
              amount={0}
            />

            <View style={s.rule} />
            <Line label="Gross pay" amount={slip.gross_pay} strong />

            <View style={s.rule} />
            <Line label="Cash advance" amount={-Number(slip.cash_advance_deducted)} />
            <Line label="SSS" amount={-Number(slip.sss_deducted)} />
            <Line label="Pag-IBIG" amount={-Number(slip.pagibig_deducted)} />
            <Line label="PhilHealth" amount={-Number(slip.philhealth_deducted)} />
            <Line label="Withholding tax" amount={-Number(slip.withholding_tax_deducted)} />
            <Line label="Total statutory" amount={-statutory} />

            <View style={s.rule} />
            <View style={s.netRow}>
              <Text style={s.netLabel}>Net pay</Text>
              <Text style={s.netValue}>{peso(slip.net_pay)}</Text>
            </View>

            <Text style={s.proofNote}>
              {slip.proof_url
                ? 'Proof of payment is on file with the office for this slip.'
                : 'No proof of payment is attached to this slip yet.'}
            </Text>

            <PrimaryButton label="Close" tone="ink" onPress={onClose} style={{ marginTop: 18 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Line({
  label,
  value,
  amount,
  strong,
}: {
  label: string;
  value?: string;
  amount: number;
  strong?: boolean;
}) {
  const n = Number(amount);
  return (
    <View style={s.line}>
      <View style={{ flex: 1 }}>
        <Text style={[s.lineLabel, strong && s.lineStrong]}>{label}</Text>
        {value ? <Text style={s.lineValue}>{value}</Text> : null}
      </View>
      <Text style={[s.lineAmount, strong && s.lineStrong, n < 0 && { color: colors.warn }]}>
        {n < 0 ? `−${peso(Math.abs(n))}` : peso(n)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  estimateCard: { backgroundColor: colors.ink, borderColor: colors.ink, gap: 4, marginBottom: 22 },
  estimateLabel: {
    fontSize: 10.5,
    letterSpacing: 1,
    color: colors.mutedOnDark,
    fontFamily: fonts.bodySemi,
  },
  estimateAmount: { fontFamily: fonts.serif, fontSize: 32, fontWeight: '700', color: colors.safety },
  estimateNote: { fontSize: 12, color: colors.paper, lineHeight: 17, fontFamily: fonts.body },
  estimateDisclaimer: {
    fontSize: 11,
    color: colors.mutedOnDark,
    lineHeight: 16,
    marginTop: 6,
    fontFamily: fonts.body,
  },
  advanceCard: {
    backgroundColor: colors.pendingBg,
    borderColor: colors.safety,
    gap: 3,
    marginBottom: 22,
  },
  advanceLabel: {
    fontSize: 10.5,
    letterSpacing: 1,
    color: colors.safetyDeep,
    fontFamily: fonts.bodySemi,
  },
  advanceAmount: { fontFamily: fonts.serif, fontSize: 24, fontWeight: '700', color: colors.ink },
  advanceNote: { fontSize: 11.5, color: colors.muted, lineHeight: 16, fontFamily: fonts.body },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,27,24,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '88%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 22, fontWeight: '700', color: colors.ink },
  sheetSub: { fontSize: 12.5, color: colors.muted, marginTop: 2, fontFamily: fonts.body },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 },
  lineLabel: { fontSize: 13, color: colors.ink, fontFamily: fonts.body },
  lineValue: { fontSize: 11, color: colors.muted, marginTop: 1, fontFamily: fonts.body },
  lineAmount: { fontSize: 13, color: colors.ink, fontFamily: fonts.bodySemi },
  lineStrong: { fontFamily: fonts.bodyBold },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: 4,
  },
  netLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.mutedOnDark,
    fontFamily: fonts.bodyBold,
  },
  netValue: { fontFamily: fonts.serif, fontSize: 26, fontWeight: '700', color: colors.safety },
  proofNote: {
    fontSize: 11.5,
    color: colors.muted,
    lineHeight: 17,
    marginTop: 12,
    fontFamily: fonts.body,
  },
});
