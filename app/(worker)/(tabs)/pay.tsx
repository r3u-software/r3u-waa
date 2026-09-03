import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { EmptyState, Pill } from '../../../src/components/ui';
import { CashIcon, FileIcon, SiteGlyph } from '../../../src/components/icons';
import { toneForStatus } from '../../../src/theme';
import {
  cutoffFor,
  hours,
  peso,
  relativeStamp,
  shortDate,
  timeOfDay,
  toDateColumn,
} from '../../../src/lib/format';
import { useWebTheme } from '../../../src/web/webTheme';
import { GlassButton, GlassCard, GlassListRow, MetricCard, webToneFor } from '../../../src/web/webUi';
import { LinearGradient } from 'expo-linear-gradient';

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
  const { palette } = useWebTheme();
  const insets = useSafeAreaInsets();
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
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.muted} />}
      >
        <Text style={{ fontSize: 11, letterSpacing: 1, color: palette.muted, fontWeight: '700' }}>Current cutoff</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginTop: 3 }}>{data?.window.label ?? '—'}</Text>
        <Text style={{ fontSize: 13, color: palette.muted, marginTop: 3, marginBottom: 20 }}>
          Running estimate · final figures come from your payslip
        </Text>

        {loading && !data ? (
          <GlassCard>
            <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 20 }}>Working out your estimate…</Text>
          </GlassCard>
        ) : (
          <>
            {/* ------------------------ Running estimate -------------------- */}
            <View style={s.gradWrap}>
              <LinearGradient colors={[palette.accent, palette.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gradCard}>
                <Text style={{ fontSize: 10.5, letterSpacing: 1, color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>
                  ESTIMATED GROSS SO FAR
                </Text>
                <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 4 }}>
                  {estimate.gross == null ? '—' : peso(estimate.gross)}
                </Text>
                {estimate.rate == null ? (
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 17, marginTop: 6 }}>
                    No hourly rate is on file for you yet, so we can't estimate an amount. The office sets this.
                  </Text>
                ) : (
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 17, marginTop: 6 }}>
                    {estimate.days} day{estimate.days === 1 ? '' : 's'} · {hours(estimate.worked)} worked at {peso(estimate.rate)}/hr
                    {estimate.overtime > 0 ? ` · ${hours(estimate.overtime)} overtime at ${Math.round(estimate.otRate * 100)}%` : ''}
                  </Text>
                )}
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 16, marginTop: 8 }}>
                  This is an estimate from your approved punches only. Leave pay, statutory deductions and any cash advance are worked
                  out by the office when payroll runs.
                </Text>
              </LinearGradient>
            </View>

            <View style={s.statRow}>
              <MetricCard style={s.statItem} label="Days worked" value={String(estimate.days)} trendPct={null} />
              <MetricCard style={s.statItem} label="Awaiting review" value={String(pending)} trendPct={null} />
              <MetricCard style={s.statItem} label="Leave days" value={String(leaveDays)} trendPct={null} />
            </View>

            {outstandingTotal > 0 ? (
              <GlassCard style={{ marginBottom: 20, borderColor: palette.accent }}>
                <Text style={{ fontSize: 10.5, letterSpacing: 1, color: palette.accent2, fontWeight: '700' }}>
                  ADVANCES RELEASED, NOT YET DEDUCTED
                </Text>
                <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text, marginTop: 4 }}>{peso(outstandingTotal)}</Text>
                <Text style={{ fontSize: 11.5, color: palette.muted, marginTop: 3 }}>This will be taken off an upcoming payslip.</Text>
              </GlassCard>
            ) : null}

            {/* --------------------------- Payslips ------------------------- */}
            <SectionTitle>Payslips</SectionTitle>
            {(data?.payslips.length ?? 0) === 0 ? (
              <EmptyState title="No payslips yet" body="A payslip appears here once the office marks its payroll run as paid." />
            ) : (
              data!.payslips.map((p) => (
                <GlassListRow
                  key={p.id}
                  icon={<FileIcon size={17} color={palette.good} />}
                  title={peso(p.net_pay)}
                  subtitle={`Net pay · paid ${p.paid_at ? relativeStamp(p.paid_at) : 'recently'} · ${hours(p.worked_hours)} worked${
                    Number(p.overtime_hours) > 0 ? ` · ${hours(p.overtime_hours)} OT` : ''
                  }`}
                  tone="good"
                  pillLabel="Paid"
                  onPress={() => setOpen(p)}
                />
              ))
            )}

            {/* ------------------------ Days this cutoff -------------------- */}
            <SectionTitle>Days in this cutoff</SectionTitle>
            {byDay.length === 0 ? (
              <EmptyState title="No punches this cutoff" body="Days you clock in and out will be listed here." />
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
                  <GlassListRow
                    key={day}
                    icon={<SiteGlyph size={17} color={palette.text} />}
                    title={new Date(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    subtitle={`In ${inPunch ? timeOfDay(inPunch.entry_timestamp) : '—'} · Out ${
                      outPunch ? timeOfDay(outPunch.entry_timestamp) : '—'
                    } · ${inPunch?.project?.name ?? outPunch?.project?.name ?? ''}`}
                    tone={webToneFor(toneForStatus(worstStatus))}
                    pillLabel={worstStatus}
                  />
                );
              })
            )}

            {/* --------------------------- Advances ------------------------- */}
            <SectionTitle>Cash advances</SectionTitle>
            {(data?.advances.length ?? 0) === 0 ? (
              <EmptyState title="No advances" body="Advances you ask for will be listed here." />
            ) : (
              data!.advances.slice(0, 8).map((a) => (
                <GlassListRow
                  key={a.id}
                  icon={<CashIcon size={17} color={palette.text} />}
                  title={a.money ? peso(a.money.amount) : 'Cash advance'}
                  subtitle={`${a.reason || 'No reason given'} · ${relativeStamp(a.created_at)}`}
                  tone={webToneFor(toneForStatus(a.status))}
                  pillLabel={a.status === 'pending' ? 'requested' : a.status.replace('_', ' ')}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ------------------------- Payslip breakdown ---------------------- */}
      <PayslipSheet slip={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { palette } = useWebTheme();
  return <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginTop: 6, marginBottom: 10 }}>{children}</Text>;
}

/** The full per-line breakdown, matching the layout of a printed payslip. */
function PayslipSheet({ slip, onClose }: { slip: WaaPayslip | null; onClose: () => void }) {
  const { palette } = useWebTheme();
  if (!slip) return null;
  const statutory =
    Number(slip.sss_deducted) +
    Number(slip.pagibig_deducted) +
    Number(slip.philhealth_deducted) +
    Number(slip.withholding_tax_deducted);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: palette.panelSolid, borderColor: palette.border }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>Payslip</Text>
                <Text style={{ fontSize: 12.5, color: palette.muted, marginTop: 2 }}>
                  Paid {slip.paid_at ? shortDate(slip.paid_at.slice(0, 10)) : '—'}
                </Text>
              </View>
              <Pill label="Paid" tone="ok" />
            </View>

            <Line label="Worked hours" value={hours(slip.worked_hours)} amount={slip.regular_pay} />
            <Line label="Overtime" value={hours(slip.overtime_hours)} amount={slip.overtime_pay} />
            <Line label="Paid leave" value={hours(slip.paid_leave_hours)} amount={slip.leave_pay} />
            <Line label="Unpaid leave" value={`${slip.unpaid_leave_days} day${Number(slip.unpaid_leave_days) === 1 ? '' : 's'}`} amount={0} />

            <View style={[s.rule, { backgroundColor: palette.border }]} />
            <Line label="Gross pay" amount={slip.gross_pay} strong />

            <View style={[s.rule, { backgroundColor: palette.border }]} />
            <Line label="Cash advance" amount={-Number(slip.cash_advance_deducted)} />
            <Line label="SSS" amount={-Number(slip.sss_deducted)} />
            <Line label="Pag-IBIG" amount={-Number(slip.pagibig_deducted)} />
            <Line label="PhilHealth" amount={-Number(slip.philhealth_deducted)} />
            <Line label="Withholding tax" amount={-Number(slip.withholding_tax_deducted)} />
            <Line label="Total statutory" amount={-statutory} />

            <View style={[s.rule, { backgroundColor: palette.border }]} />
            <LinearGradient colors={[palette.accent, palette.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.netRow}>
              <Text style={{ fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>NET PAY</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{peso(slip.net_pay)}</Text>
            </LinearGradient>

            <Text style={{ fontSize: 11.5, color: palette.muted, lineHeight: 17, marginTop: 14 }}>
              {slip.proof_url ? 'Proof of payment is on file with the office for this slip.' : 'No proof of payment is attached to this slip yet.'}
            </Text>

            <GlassButton label="Close" onPress={onClose} style={{ marginTop: 16 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Line({ label, value, amount, strong }: { label: string; value?: string; amount: number; strong?: boolean }) {
  const { palette } = useWebTheme();
  const n = Number(amount);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: palette.text, fontWeight: strong ? '700' : '400' }}>{label}</Text>
        {value ? <Text style={{ fontSize: 11, color: palette.muted, marginTop: 1 }}>{value}</Text> : null}
      </View>
      <Text style={{ fontSize: 13, color: n < 0 ? palette.bad : palette.text, fontWeight: strong ? '700' : '600' }}>
        {n < 0 ? `−${peso(Math.abs(n))}` : peso(n)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  gradWrap: { borderRadius: 18, overflow: 'hidden', marginBottom: 16 },
  gradCard: { padding: 20 },
  statRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
  statItem: { flex: 1, padding: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, maxHeight: '88%' },
  rule: { height: 1, marginVertical: 8 },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, padding: 14, marginTop: 4 },
});
