import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useHrAdmin } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { fetchProjects } from '../../src/lib/queries';
import type { WaaProject } from '../../src/lib/types';
import { WebShell } from '../../src/web/WebShell';
import { useWebTheme } from '../../src/web/webTheme';
import {
  Chip,
  DataRow,
  DataTable,
  GlassCard,
  GlassPanel,
  MetricCard,
  WebPageHeader,
} from '../../src/web/webUi';
import {
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  CurrencyIcon,
  TeamIcon,
  WalletIcon,
} from '../../src/components/icons';
import { hours, periodLabel, peso, toDateColumn } from '../../src/lib/format';

/**
 * HR/Admin analytics — the web dashboard's landing page.
 *
 * Reskinned onto `WebShell`/`webUi` (R3U-WAA-WEB-REDESIGN.md); every fetch,
 * the period/granularity math, and the workweek edit flow below are
 * unchanged from the version this replaces. Per HR-ANALYTICS-ADDENDUM.md,
 * every metric here rolls up from data the system already records (payroll
 * runs, attendance, leave, cash advances, separations), cut by calendar
 * month / quarter / year and filterable by site, each against the
 * immediately preceding period of the same granularity.
 *
 * All of it comes from the `waa-hr-analytics` edge function — HR/Admin has no
 * direct table grant on the payroll tables to fall back on (Option A in
 * ADDENDA-PROPOSAL.md), and the function does its own `company_id` filtering
 * server-side with the service role. The site filter below is a *narrowing*
 * convenience, never the tenant boundary.
 *
 * One deliberate honesty cut from the earlier mockup this follows: that
 * mockup showed per-card sparklines and a 6-point cost trend line. The API
 * only ever returns a value and one trend_pct against the previous period —
 * never a real series — so cards below carry no sparkline, and the "cost
 * trend" panel is a two-bar this-period-vs-last comparison, with the prior
 * value derived from the real trend_pct rather than invented.
 */

/* ------------------------------------------------------------- Contract --- */

type Granularity = 'month' | 'quarter' | 'year';

interface Trend {
  value: number;
  trend_pct: number | null;
}

interface PeriodBounds {
  start: string;
  end: string;
  label: string;
}

interface AnalyticsSummary {
  period: PeriodBounds;
  previous_period: PeriodBounds;
  workdays_mask: number;
  metrics: {
    payroll_cost: { gross: Trend; deductions: Trend; net: Trend };
    headcount: {
      active_at_end: Trend;
      new_hires: Trend;
      separations: { terminated: number; awol: number; resigned: number };
    };
    attendance: {
      worked_worker_days: Trend;
      possible_worker_days: Trend;
      absence_rate: Trend;
    };
    leave: {
      total_days: Trend;
      by_type: Record<string, number>;
      paid_days: Trend;
      unpaid_days: Trend;
    };
    overtime: { hours: Trend; cost: Trend };
    cash_advances: { requested: Trend; approved: Trend; paid_out: Trend; settled: Trend };
  };
}

const ANALYTICS_FN = 'waa-hr-analytics';

async function callAnalytics<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(ANALYTICS_FN, { body });
  if (!error) return data as T;

  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    const parsed = await ctx
      .clone()
      .json()
      .catch(() => null);
    if (parsed && typeof parsed.error === 'string') throw new Error(parsed.error);
  }
  const legacyBody = (ctx as { body?: unknown } | undefined)?.body;
  if (typeof legacyBody === 'string' && legacyBody) throw new Error(legacyBody);
  throw new Error((error as { message?: string }).message || fallback);
}

function fetchSummary(
  granularity: Granularity,
  referenceDate: string,
  siteId: string | null
): Promise<AnalyticsSummary> {
  return callAnalytics<AnalyticsSummary>(
    { action: 'get_summary', granularity, reference_date: referenceDate, site_id: siteId },
    'Could not load the analytics summary.'
  );
}

function fetchWorkweek(): Promise<{ workdays_mask: number }> {
  return callAnalytics<{ workdays_mask: number }>(
    { action: 'get_workweek' },
    'Could not load the work week.'
  );
}

function saveWorkweek(mask: number): Promise<{ ok: true }> {
  return callAnalytics<{ ok: true }>(
    { action: 'update_workweek', workdays_mask: mask },
    'Could not save the work week.'
  );
}

/* --------------------------------------------------------- Period math --- */

function periodStartOf(g: Granularity, d: Date): Date {
  const y = d.getFullYear();
  if (g === 'year') return new Date(y, 0, 1);
  if (g === 'quarter') return new Date(y, Math.floor(d.getMonth() / 3) * 3, 1);
  return new Date(y, d.getMonth(), 1);
}

function shiftPeriod(g: Granularity, d: Date, step: number): Date {
  const start = periodStartOf(g, d);
  if (g === 'year') return new Date(start.getFullYear() + step, 0, 1);
  const months = g === 'quarter' ? step * 3 : step;
  return new Date(start.getFullYear(), start.getMonth() + months, 1);
}

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'month', label: 'Monthly' },
  { key: 'quarter', label: 'Quarterly' },
  { key: 'year', label: 'Yearly' },
];

/** bit0 = Mon … bit6 = Sun, matching the edge function's mask. */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Derives the previous period's absolute value from a real trend_pct —
 * never invented, just algebra on what the API actually returned. Null
 * when the trend itself is undefined (previous period was zero). */
function derivePrevious(metric: Trend | undefined): number | null {
  if (!metric || metric.trend_pct === null) return null;
  const denom = 1 + metric.trend_pct / 100;
  if (denom === 0) return null;
  return metric.value / denom;
}

/* ------------------------------------------------------------- Screen --- */

export default function HrAnalytics() {
  const hrAdmin = useHrAdmin();
  const { palette } = useWebTheme();

  const [granularity, setGranularity] = useState<Granularity>('month');
  const [reference, setReference] = useState<Date>(() => periodStartOf('month', new Date()));
  const [siteId, setSiteId] = useState<string | null>(null);

  const [workweekOpen, setWorkweekOpen] = useState(false);
  const [savingWorkweek, setSavingWorkweek] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const referenceDate = toDateColumn(reference);

  const { data, loading, error, reload } = useAsync(async () => {
    const [summary, workweek, sites] = await Promise.all([
      fetchSummary(granularity, referenceDate, siteId),
      fetchWorkweek(),
      fetchProjects(),
    ]);
    return { summary, mask: workweek.workdays_mask, sites };
  }, [hrAdmin.id, granularity, referenceDate, siteId]);

  const atLatest =
    periodStartOf(granularity, reference).getTime() >=
    periodStartOf(granularity, new Date()).getTime();

  function changeGranularity(next: Granularity) {
    setReference((prev) => periodStartOf(next, prev));
    setGranularity(next);
    setActionError(null);
  }

  async function toggleWorkday(index: number, mask: number) {
    const next = mask ^ (1 << index);
    if (next === 0) {
      setActionError('At least one day has to stay a work day.');
      return;
    }
    setSavingWorkweek(true);
    setActionError(null);
    try {
      await saveWorkweek(next);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save the work week.');
    } finally {
      setSavingWorkweek(false);
    }
  }

  const summary = data?.summary;
  const m = summary?.metrics;

  const prevNet = m ? derivePrevious(m.payroll_cost.net) : null;

  return (
    <WebShell
      active="analytics"
      title="Analytics"
      subtitle={summary ? `Company-wide, ${periodLabel(summary.period.start, summary.period.end)}` : 'Company-wide'}
    >
      <WebPageHeader
        eyebrow="Insights"
        title="Analytics"
        sub="Payroll, attendance, leave and advances across calendar periods, against the period before it."
      />

      {error ? <ErrorBanner message={error} /> : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}

      {/* ------------------------------ Controls ---------------------- */}
      <GlassCard style={{ marginBottom: 18 }}>
        <View style={s.chipRow}>
          {GRANULARITIES.map((g) => (
            <Chip key={g.key} label={g.label} active={g.key === granularity} onPress={() => changeGranularity(g.key)} />
          ))}
        </View>

        <View style={[s.periodNav, { borderColor: palette.border }]}>
          <NavArrow
            direction="prev"
            label="Previous period"
            onPress={() => setReference((prev) => shiftPeriod(granularity, prev, -1))}
          />
          <View style={s.periodMiddle}>
            <Text style={[s.periodLabel, { color: palette.text }]}>{summary?.period.label ?? '—'}</Text>
            <Text style={[s.periodRange, { color: palette.muted }]}>
              {summary ? periodLabel(summary.period.start, summary.period.end) : 'Loading period…'}
            </Text>
            {summary ? (
              <Text style={[s.periodPrev, { color: palette.muted2 }]}>vs {summary.previous_period.label}</Text>
            ) : null}
          </View>
          <NavArrow
            direction="next"
            label="Next period"
            disabled={atLatest}
            onPress={() => setReference((prev) => shiftPeriod(granularity, prev, 1))}
          />
        </View>

        <Text style={[s.fieldLabel, { color: palette.muted }]}>Site</Text>
        <View style={s.chipRow}>
          <Chip label="All sites" active={siteId === null} onPress={() => setSiteId(null)} />
          {(data?.sites ?? []).map((site: WaaProject) => (
            <Chip key={site.id} label={site.name} active={siteId === site.id} onPress={() => setSiteId(site.id)} />
          ))}
        </View>
      </GlassCard>

      {/* ------------------------------- Metrics ---------------------- */}
      {loading && !data ? (
        <GlassCard>
          <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 24 }}>Loading analytics…</Text>
        </GlassCard>
      ) : !m || !summary ? (
        error ? null : (
          <GlassCard>
            <Text style={{ color: palette.text, fontWeight: '700', textAlign: 'center' }}>No figures for this period</Text>
            <Text style={{ color: palette.muted, textAlign: 'center', marginTop: 6, fontSize: 12.5 }}>
              Nothing has been recorded for the selected period and site yet. Try another period, or clear the site filter.
            </Text>
          </GlassCard>
        )
      ) : (
        <>
          {/* nexus's `.grid.g6` KPI strip: each card leads with a tinted icon
              square, then the uppercase micro-label, then the figure. The
              icon tints are semantic (money/people/attendance/leave/OT/cash),
              matching how the reference colour-codes its own KPI row. */}
          <View style={s.grid}>
            <MetricCard
              style={s.metricItem}
              icon={<CurrencyIcon color={palette.accent2} size={17} />}
              iconBg={palette.accentBg}
              label="Payroll cost · net paid"
              value={peso(m.payroll_cost.net.value)}
              trendPct={m.payroll_cost.net.trend_pct}
              trendNote="vs last period"
            />
            <MetricCard
              style={s.metricItem}
              icon={<TeamIcon color={palette.good} size={17} />}
              iconBg={palette.goodBg}
              label="Headcount · active"
              value={m.headcount.active_at_end.value.toLocaleString()}
              trendPct={m.headcount.active_at_end.trend_pct}
              direction="up-good"
              trendNote="vs last period"
            />
            <MetricCard
              style={s.metricItem}
              icon={<ClockIcon color={palette.warn} size={17} />}
              iconBg={palette.warnBg}
              label="Absence rate"
              value={`${m.attendance.absence_rate.value.toFixed(1)}%`}
              trendPct={m.attendance.absence_rate.trend_pct}
              direction="down-good"
              trendNote="vs last period"
            />
            <MetricCard
              style={s.metricItem}
              icon={<CalendarIcon color={palette.info} size={17} />}
              iconBg={palette.infoBg}
              label="Leave taken"
              value={`${m.leave.total_days.value.toLocaleString()} days`}
              trendPct={m.leave.total_days.trend_pct}
              trendNote="vs last period"
            />
            <MetricCard
              style={s.metricItem}
              icon={<ClockIcon color={palette.accent} size={17} />}
              iconBg={palette.accentBg}
              label="Overtime cost"
              value={peso(m.overtime.cost.value)}
              trendPct={m.overtime.cost.trend_pct}
              trendNote="vs last period"
            />
            <MetricCard
              style={s.metricItem}
              icon={<WalletIcon color={palette.bad} size={17} />}
              iconBg={palette.badBg}
              label="Cash advances · requested"
              value={peso(m.cash_advances.requested.value)}
              trendPct={m.cash_advances.requested.trend_pct}
              trendNote="vs last period"
            />
          </View>

          <View style={s.grid2}>
            <GlassPanel title="Payroll cost" hint="Net paid, this period vs last" style={s.panelItem}>
              {prevNet === null ? (
                <Text style={{ fontSize: 12, color: palette.muted }}>
                  No comparable figure in the previous period.
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  <CompareBar label={summary.previous_period.label} value={prevNet} max={Math.max(prevNet, m.payroll_cost.net.value)} tone="muted" />
                  <CompareBar label={summary.period.label} value={m.payroll_cost.net.value} max={Math.max(prevNet, m.payroll_cost.net.value)} tone="accent" />
                </View>
              )}
              <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12, gap: 6 }}>
                <DetailRow label="Gross" value={peso(m.payroll_cost.gross.value)} />
                <DetailRow label="Deductions" value={peso(m.payroll_cost.deductions.value)} />
                <DetailRow label="Net paid" value={peso(m.payroll_cost.net.value)} strong />
              </View>
            </GlassPanel>

            <GlassPanel title="Work week" hint="Denominator behind the absence rate above" style={s.panelItem}>
              <Text style={{ fontSize: 11.5, color: palette.muted, lineHeight: 17, marginBottom: 12 }}>
                Which days count as work days. Possible worker-days is active workers multiplied by the work
                days in the period, so changing it re-scales every attendance figure above.
              </Text>
              {workweekOpen ? (
                <View style={s.dayRow}>
                  {DAY_LABELS.map((day, i) => {
                    const mask = data?.mask ?? 0;
                    const on = ((mask >> i) & 1) === 1;
                    return (
                      <Pressable
                        key={day}
                        disabled={savingWorkweek || !data}
                        onPress={() => toggleWorkday(i, mask)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${day}, ${on ? 'a work day' : 'not a work day'}`}
                        style={[
                          s.dayChip,
                          { borderColor: palette.border, backgroundColor: on ? palette.accent : palette.panelSolid },
                          (savingWorkweek || !data) && { opacity: 0.5 },
                        ]}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: on ? '#fff' : palette.muted }}>{day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={{ fontSize: 12.5, color: palette.text, fontWeight: '600' }}>
                  {data ? describeWorkweek(data.mask) : 'Loading…'}
                </Text>
              )}
              <Pressable
                onPress={() => {
                  setWorkweekOpen((open) => !open);
                  setActionError(null);
                }}
                style={{ marginTop: 12 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.accent }}>
                  {workweekOpen ? 'Hide' : 'Edit work week'}
                </Text>
              </Pressable>
              {savingWorkweek ? (
                <Text style={{ fontSize: 11.5, color: palette.muted, marginTop: 8 }}>Saving and recalculating…</Text>
              ) : null}
            </GlassPanel>
          </View>

          <View style={s.grid2}>
            <GlassPanel title="Headcount" hint="New hires and separations this period" style={s.panelItem}>
              <DetailRow label="New hires" value={m.headcount.new_hires.value.toLocaleString()} />
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  Separations
                </Text>
                <DetailRow label="Terminated" value={(m.headcount.separations?.terminated ?? 0).toLocaleString()} />
                <DetailRow label="AWOL" value={(m.headcount.separations?.awol ?? 0).toLocaleString()} />
                <DetailRow label="Resigned" value={(m.headcount.separations?.resigned ?? 0).toLocaleString()} />
              </View>
            </GlassPanel>

            <GlassPanel title="Leave" hint="Paid vs unpaid, and by type" style={s.panelItem}>
              <DetailRow label="Paid days" value={m.leave.paid_days.value.toLocaleString()} />
              <DetailRow label="Unpaid days" value={m.leave.unpaid_days.value.toLocaleString()} />
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 10 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  By type · days
                </Text>
                {Object.entries(m.leave.by_type ?? {}).filter(([, d]) => Number(d) > 0).length === 0 ? (
                  <Text style={{ fontSize: 11.5, color: palette.muted }}>No leave taken in this period.</Text>
                ) : (
                  Object.entries(m.leave.by_type ?? {})
                    .filter(([, d]) => Number(d) > 0)
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .map(([leaveType, days]) => <DetailRow key={leaveType} label={leaveType} value={Number(days).toLocaleString()} />)
                )}
              </View>
            </GlassPanel>
          </View>

          <GlassPanel title="Overtime & cash advances" style={{ marginBottom: 24 }}>
            <DataTable columns={[{ key: 'k', label: 'Metric', flex: 2 }, { key: 'v', label: 'Value', align: 'right' }]}>
              <DataRow index={0} columns={[{ key: 'k', flex: 2 }, { key: 'v', align: 'right' }]} values={{ k: 'Overtime hours', v: hours(m.overtime.hours.value) }} />
              <DataRow index={1} columns={[{ key: 'k', flex: 2 }, { key: 'v', align: 'right' }]} values={{ k: 'Overtime cost', v: peso(m.overtime.cost.value) }} />
              <DataRow index={2} columns={[{ key: 'k', flex: 2 }, { key: 'v', align: 'right' }]} values={{ k: 'Cash advances approved', v: peso(m.cash_advances.approved.value) }} />
              <DataRow index={3} columns={[{ key: 'k', flex: 2 }, { key: 'v', align: 'right' }]} values={{ k: 'Cash advances paid out', v: peso(m.cash_advances.paid_out.value) }} />
              <DataRow index={4} columns={[{ key: 'k', flex: 2 }, { key: 'v', align: 'right' }]} values={{ k: 'Cash advances settled', v: peso(m.cash_advances.settled.value) }} />
            </DataTable>
          </GlassPanel>
        </>
      )}
    </WebShell>
  );
}

/* --------------------------------------------------------- Sub-components --- */

function NavArrow({
  direction,
  label,
  onPress,
  disabled,
}: {
  direction: 'prev' | 'next';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { palette } = useWebTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.navBtn,
        { borderColor: palette.border },
        disabled && { opacity: 0.35 },
        pressed && !disabled && { backgroundColor: palette.hover },
      ]}
    >
      <View style={direction === 'prev' ? s.mirrored : undefined}>
        <ChevronRightIcon size={17} color={palette.text} />
      </View>
    </Pressable>
  );
}

function ErrorBanner({ message }: { message: string }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ backgroundColor: palette.badBg, borderRadius: 12, padding: 12, marginBottom: 14 }}>
      <Text style={{ color: palette.bad, fontSize: 12.5, lineHeight: 18, fontWeight: '600' }}>{message}</Text>
    </View>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { palette } = useWebTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 10 }}>
      <Text style={{ flex: 1, fontSize: strong ? 13 : 12.5, color: strong ? palette.text : palette.muted, fontWeight: strong ? '700' : '400' }}>
        {label}
      </Text>
      <Text style={{ fontSize: strong ? 13.5 : 12.5, color: palette.text, fontWeight: strong ? '700' : '600' }}>{value}</Text>
    </View>
  );
}

function CompareBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'accent' | 'muted' }) {
  const { palette } = useWebTheme();
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 11.5, color: palette.muted }}>{label}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.text }}>{peso(value)}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 999, backgroundColor: palette.hover, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            backgroundColor: tone === 'accent' ? palette.accent : palette.muted2,
          }}
        />
      </View>
    </View>
  );
}

/** "Mon–Fri" style summary of the mask, for the collapsed work-week card. */
function describeWorkweek(mask: number): string {
  const on = DAY_LABELS.filter((_, i) => ((mask >> i) & 1) === 1);
  if (on.length === 7) return 'All seven days count as work days.';
  if (on.length === 0) return 'No work days set.';
  return `${on.join(' · ')} — ${on.length} day${on.length === 1 ? '' : 's'} a week.`;
}

/* --------------------------------------------------------------- Styles --- */

const s = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    marginTop: 14,
  },
  periodMiddle: { flex: 1, alignItems: 'center' },
  periodLabel: { fontSize: 20, fontWeight: '700' },
  periodRange: { fontSize: 12, marginTop: 2 },
  periodPrev: { fontSize: 10.5, marginTop: 3, fontWeight: '600' },
  navBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mirrored: { transform: [{ scaleX: -1 }] },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  // nexus's `.grid.g6` — six across at desktop width, wrapping down to
  // three/two as the pane narrows. `flexBasis: 150` is what actually gets
  // six on a row at ~1180px of content; the old 250 basis only ever fit
  // four, which is why the KPI strip read as two ragged rows.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 15 },
  metricItem: { flexGrow: 1, flexBasis: 150, minWidth: 148 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 14 },
  panelItem: { flexGrow: 1, flexBasis: 380, minWidth: 300 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { flex: 1, minWidth: 40, paddingVertical: 10, borderRadius: 11, borderWidth: 1, alignItems: 'center' },
});
