import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useHrAdmin } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import { fetchProjects } from '../../src/lib/queries';
import type { WaaProject } from '../../src/lib/types';
import { ScreenBody, TopBar } from '../../src/components/Screen';
import {
  Card,
  EmptyState,
  ErrorNote,
  Loader,
  Section,
} from '../../src/components/ui';
import { ChevronRightIcon } from '../../src/components/icons';
import { colors, fonts, radius, spacing, type } from '../../src/theme';
import { hours, periodLabel, peso, toDateColumn } from '../../src/lib/format';

/**
 * HR/Admin analytics — the web dashboard's landing page.
 *
 * Per HR-ANALYTICS-ADDENDUM.md: every metric here rolls up from data the
 * system already records (payroll runs, attendance, leave, cash advances,
 * separations), cut by calendar month / quarter / year and filterable by site,
 * each against the immediately preceding period of the same granularity.
 *
 * All of it comes from the `waa-hr-analytics` edge function — HR/Admin has no
 * direct table grant on the payroll tables to fall back on (Option A in
 * ADDENDA-PROPOSAL.md), and the function does its own `company_id` filtering
 * server-side with the service role. The site filter below is a *narrowing*
 * convenience, never the tenant boundary.
 *
 * The root guard in app/_layout.tsx is what makes this web-only, so there is
 * deliberately no `Platform.OS` branching in here — this is plain React Native
 * that react-native-web renders.
 */

/* ------------------------------------------------------------- Contract --- */

type Granularity = 'month' | 'quarter' | 'year';

/**
 * Every metric leaf except the two plain number maps (`separations`,
 * `by_type`). `trend_pct` is a percent — 4.3 means +4.3% — and is null when the
 * previous period was zero, i.e. the trend is undefined rather than flat.
 */
interface Trend {
  value: number;
  trend_pct: number | null;
}

interface PeriodBounds {
  start: string;
  end: string;
  /** "2026-07", "2026-Q3", "2026". */
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

/**
 * Mirrors the private `callHrFunction` in src/lib/hrMobile.ts — the functions
 * answer `{ error: string }` on a non-2xx, which supabase-js buries inside
 * `FunctionsHttpError.context`. Unwrapped here so a real reason surfaces
 * instead of "Edge Function returned a non-2xx status code". Duplicated rather
 * than imported because that helper is module-private to hrMobile.ts.
 */
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

/** First day of the calendar period containing `d`. Periods are calendar-based. */
function periodStartOf(g: Granularity, d: Date): Date {
  const y = d.getFullYear();
  if (g === 'year') return new Date(y, 0, 1);
  if (g === 'quarter') return new Date(y, Math.floor(d.getMonth() / 3) * 3, 1);
  return new Date(y, d.getMonth(), 1);
}

/**
 * One period forward (+1) or back (-1). Always lands on a period start, so the
 * arrows can't drift (Jan 31 + 1 month would otherwise overshoot February).
 * `new Date(y, m ± n, 1)` normalises month overflow into the year itself.
 */
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

/* ------------------------------------------------------------- Screen --- */

export default function HrAnalytics() {
  const hrAdmin = useHrAdmin();

  const [granularity, setGranularity] = useState<Granularity>('month');
  const [reference, setReference] = useState<Date>(() => periodStartOf('month', new Date()));
  const [siteId, setSiteId] = useState<string | null>(null);

  const [workweekOpen, setWorkweekOpen] = useState(false);
  const [savingWorkweek, setSavingWorkweek] = useState(false);
  /** Write-side failures, kept apart from the fetch error `useAsync` owns. */
  const [actionError, setActionError] = useState<string | null>(null);

  const referenceDate = toDateColumn(reference);

  // One load per control change, the same shape payroll-grid.tsx uses: the
  // work week and the site list are cheap and re-reading them here keeps the
  // toggles honest about the denominator that produced the numbers on screen.
  const { data, loading, error, reload } = useAsync(async () => {
    const [summary, workweek, sites] = await Promise.all([
      fetchSummary(granularity, referenceDate, siteId),
      fetchWorkweek(),
      fetchProjects(),
    ]);
    return { summary, mask: workweek.workdays_mask, sites };
  }, [hrAdmin.id, granularity, referenceDate, siteId]);

  /** No forward navigation past the period we're currently living in. */
  const atLatest =
    periodStartOf(granularity, reference).getTime() >=
    periodStartOf(granularity, new Date()).getTime();

  function changeGranularity(next: Granularity) {
    // Re-anchor to the containing period so the arrows and the "at latest"
    // check stay well-defined (March, monthly -> 2026-Q1, quarterly).
    setReference((prev) => periodStartOf(next, prev));
    setGranularity(next);
    setActionError(null);
  }

  async function toggleWorkday(index: number, mask: number) {
    const next = mask ^ (1 << index);
    if (next === 0) {
      // The function rejects anything outside 1-127; caught here so the user
      // gets the reason rather than a server error.
      setActionError('At least one day has to stay a work day.');
      return;
    }
    setSavingWorkweek(true);
    setActionError(null);
    try {
      await saveWorkweek(next);
      // The absence-rate denominator just changed, so every attendance figure
      // on screen is stale — refetch rather than patching the mask locally.
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save the work week.');
    } finally {
      setSavingWorkweek(false);
    }
  }

  const summary = data?.summary;
  const m = summary?.metrics;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar label="Analytics" />
      <ScreenBody refreshing={loading} onRefresh={reload}>
        <View style={s.page}>
          <Text style={type.greet}>Analytics</Text>
          <Text style={[type.subgreet, { marginBottom: 18 }]}>
            Payroll, attendance, leave and advances across calendar periods, against the period
            before it.
          </Text>

          {error ? <ErrorNote message={error} /> : null}
          {actionError ? <ErrorNote message={actionError} /> : null}

          {/* ------------------------------ Controls ---------------------- */}
          <Card style={s.controls}>
            <View style={s.chipRow}>
              {GRANULARITIES.map((g) => {
                const active = g.key === granularity;
                return (
                  <Pressable
                    key={g.key}
                    onPress={() => changeGranularity(g.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{g.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={s.periodNav}>
              <NavArrow
                direction="prev"
                label="Previous period"
                onPress={() => setReference((prev) => shiftPeriod(granularity, prev, -1))}
              />
              <View style={s.periodMiddle}>
                <Text style={s.periodLabel}>{summary?.period.label ?? '—'}</Text>
                <Text style={s.periodRange}>
                  {summary
                    ? periodLabel(summary.period.start, summary.period.end)
                    : 'Loading period…'}
                </Text>
                {summary ? (
                  <Text style={s.periodPrev}>
                    vs {summary.previous_period.label}
                  </Text>
                ) : null}
              </View>
              <NavArrow
                direction="next"
                label="Next period"
                disabled={atLatest}
                onPress={() => setReference((prev) => shiftPeriod(granularity, prev, 1))}
              />
            </View>

            <Text style={[type.label, { marginBottom: 8 }]}>Site</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.siteRow}
            >
              <SiteChip
                label="All sites"
                active={siteId === null}
                onPress={() => setSiteId(null)}
              />
              {(data?.sites ?? []).map((site: WaaProject) => (
                <SiteChip
                  key={site.id}
                  label={site.name}
                  active={siteId === site.id}
                  onPress={() => setSiteId(site.id)}
                />
              ))}
            </ScrollView>
          </Card>

          {/* ------------------------------- Metrics ---------------------- */}
          {loading && !data ? (
            <Loader label="Loading analytics…" />
          ) : !m || !summary ? (
            // A failed load already reports itself through the ErrorNote
            // above; an empty state stacked on top of it would misattribute
            // the failure to "there is no data".
            error ? null : (
              <EmptyState
                title="No figures for this period"
                body="Nothing has been recorded for the selected period and site yet. Try another period, or clear the site filter."
              />
            )
          ) : (
            <View style={s.grid}>
              <Section title="Payroll cost" style={s.gridItem}>
                <Card style={s.metricCard}>
                  <MetricRow label="Gross" metric={m.payroll_cost.gross} fmt="peso" />
                  <MetricRow label="Deductions" metric={m.payroll_cost.deductions} fmt="peso" />
                  <MetricRow label="Net paid" metric={m.payroll_cost.net} fmt="peso" strong />
                </Card>
              </Section>

              <Section title="Headcount" style={s.gridItem}>
                <Card style={s.metricCard}>
                  <MetricRow
                    label="Active at period end"
                    metric={m.headcount.active_at_end}
                    fmt="count"
                    direction="up-good"
                    strong
                  />
                  <MetricRow
                    label="New hires"
                    metric={m.headcount.new_hires}
                    fmt="count"
                    direction="up-good"
                  />
                  <Breakdown
                    title="Separations"
                    total={
                      Number(m.headcount.separations?.terminated ?? 0) +
                      Number(m.headcount.separations?.awol ?? 0) +
                      Number(m.headcount.separations?.resigned ?? 0)
                    }
                  >
                    <SubRow label="Terminated" value={m.headcount.separations?.terminated ?? 0} />
                    <SubRow label="AWOL" value={m.headcount.separations?.awol ?? 0} />
                    <SubRow label="Resigned" value={m.headcount.separations?.resigned ?? 0} />
                  </Breakdown>
                </Card>
              </Section>

              <Section title="Attendance" style={s.gridItem}>
                <Card style={s.metricCard}>
                  <MetricRow
                    label="Worker-days worked"
                    metric={m.attendance.worked_worker_days}
                    fmt="count"
                    direction="up-good"
                  />
                  <MetricRow
                    label="Possible worker-days"
                    metric={m.attendance.possible_worker_days}
                    fmt="count"
                  />
                  <MetricRow
                    label="Absence rate"
                    metric={m.attendance.absence_rate}
                    fmt="percent"
                    direction="down-good"
                    strong
                  />
                </Card>
              </Section>

              <Section title="Leave" style={s.gridItem}>
                <Card style={s.metricCard}>
                  <MetricRow
                    label="Total days taken"
                    metric={m.leave.total_days}
                    fmt="count"
                    strong
                  />
                  <MetricRow label="Paid days" metric={m.leave.paid_days} fmt="count" />
                  <MetricRow label="Unpaid days" metric={m.leave.unpaid_days} fmt="count" />
                  <LeaveByType byType={m.leave.by_type} />
                </Card>
              </Section>

              <Section title="Overtime" style={s.gridItem}>
                <Card style={s.metricCard}>
                  <MetricRow label="Hours" metric={m.overtime.hours} fmt="hours" />
                  <MetricRow label="Cost" metric={m.overtime.cost} fmt="peso" strong />
                </Card>
              </Section>

              <Section title="Cash advances" style={s.gridItem}>
                <Card style={s.metricCard}>
                  <MetricRow label="Requested" metric={m.cash_advances.requested} fmt="peso" />
                  <MetricRow label="Approved" metric={m.cash_advances.approved} fmt="peso" />
                  <MetricRow label="Paid out" metric={m.cash_advances.paid_out} fmt="peso" />
                  <MetricRow label="Settled" metric={m.cash_advances.settled} fmt="peso" />
                </Card>
              </Section>
            </View>
          )}

          {/* ------------------------------ Work week --------------------- */}
          <Section
            title="Work week"
            link={workweekOpen ? 'Hide' : 'Edit'}
            onLinkPress={() => {
              setWorkweekOpen((open) => !open);
              setActionError(null);
            }}
            style={s.workweek}
          >
            <Card>
              <Text style={s.workweekNote}>
                Which days count as work days. This is the denominator behind the absence rate —
                possible worker-days is active workers multiplied by the work days in the period,
                so changing it re-scales every attendance figure above.
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
                          on && s.dayChipOn,
                          (savingWorkweek || !data) && { opacity: 0.5 },
                        ]}
                      >
                        <Text style={[s.dayText, on && s.dayTextOn]}>{day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={s.workweekCurrent}>
                  {data ? describeWorkweek(data.mask) : 'Loading…'}
                </Text>
              )}
              {savingWorkweek ? <Loader label="Saving and recalculating…" /> : null}
            </Card>
          </Section>
        </View>
      </ScreenBody>
    </View>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.navBtn,
        disabled && { opacity: 0.35 },
        pressed && !disabled && { backgroundColor: colors.paper },
      ]}
    >
      {/* There is no ChevronLeftIcon in the icon set — the right-facing one is
          mirrored rather than adding a near-duplicate glyph. */}
      <View style={direction === 'prev' ? s.mirrored : undefined}>
        <ChevronRightIcon size={17} color={colors.ink} />
      </View>
    </Pressable>
  );
}

function SiteChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[s.chip, active && s.chipActive]}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

type Fmt = 'peso' | 'percent' | 'hours' | 'count';

function formatValue(value: number, fmt: Fmt): string {
  const n = Number(value);
  if (fmt === 'peso') return peso(n);
  if (fmt === 'percent') return `${n.toFixed(1)}%`;
  if (fmt === 'hours') return hours(n);
  return n.toLocaleString();
}

/**
 * Whether a rise is good news. Only stated where the direction genuinely has
 * one meaning — a bigger payroll bill can mean a bigger crew, and more leave or
 * more overtime cost is not self-evidently bad, so those stay neutral rather
 * than being colour-coded into a judgment the data doesn't support.
 */
type Direction = 'up-good' | 'down-good' | 'neutral';

function MetricRow({
  label,
  metric,
  fmt,
  direction = 'neutral',
  strong,
}: {
  label: string;
  metric: Trend | undefined;
  fmt: Fmt;
  direction?: Direction;
  strong?: boolean;
}) {
  const pct = metric?.trend_pct ?? null;

  // null is an *undefined* trend (the previous period was zero), not a flat
  // one — rendered as "—" so it can't be misread as "no change".
  const trendText =
    pct === null ? '—' : `${pct >= 0 ? '+' : '−'}${Math.abs(Number(pct)).toFixed(1)}%`;

  let trendColor: string = colors.muted;
  if (pct !== null && pct !== 0 && direction !== 'neutral') {
    const good = direction === 'up-good' ? pct > 0 : pct < 0;
    trendColor = good ? colors.ok : colors.warn;
  }

  return (
    <View style={s.metricRow}>
      <Text style={[s.metricLabel, strong && s.metricLabelStrong]}>{label}</Text>
      <Text style={[s.metricValue, strong && s.metricValueStrong]}>
        {metric ? formatValue(metric.value, fmt) : '—'}
      </Text>
      <Text
        style={[s.metricTrend, { color: trendColor }]}
        accessibilityLabel={
          pct === null
            ? `${label}: no comparable figure in the previous period`
            : `${label}: ${pct >= 0 ? 'up' : 'down'} ${Math.abs(Number(pct)).toFixed(1)} percent versus the previous period`
        }
      >
        {trendText}
      </Text>
    </View>
  );
}

/** A nested number map — no trend, so no trend column. */
function Breakdown({
  title,
  total,
  children,
}: {
  title: string;
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={s.breakdown}>
      <View style={s.breakdownHead}>
        <Text style={s.breakdownTitle}>{title}</Text>
        {total === undefined ? null : (
          <Text style={s.breakdownTotal}>{Number(total).toLocaleString()}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

function SubRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.subRow}>
      <Text style={s.subLabel}>{label}</Text>
      <Text style={s.subValue}>{Number(value).toLocaleString()}</Text>
    </View>
  );
}

/** `by_type` keys are whatever leave types were actually used, so this is dynamic. */
function LeaveByType({ byType }: { byType: Record<string, number> }) {
  const rows = Object.entries(byType ?? {})
    .filter(([, days]) => Number(days) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  return (
    <Breakdown title="By type · days">
      {rows.length === 0 ? (
        <Text style={s.breakdownEmpty}>No leave taken in this period.</Text>
      ) : (
        rows.map(([leaveType, days]) => (
          <SubRow key={leaveType} label={leaveType} value={Number(days)} />
        ))
      )}
    </Breakdown>
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
  // Desktop-first: the body itself stays full-bleed, the content is centred and
  // capped so the metric grid doesn't stretch into unreadable rows on a wide
  // monitor. Harmless on a narrow viewport, where maxWidth never binds.
  page: { width: '100%', maxWidth: 1080, alignSelf: 'center' },

  controls: { marginBottom: 22, gap: spacing.lg },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.muted },
  chipTextActive: { color: colors.paper },

  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
  },
  periodMiddle: { flex: 1, alignItems: 'center' },
  periodLabel: { fontFamily: fonts.serif, fontSize: 22, fontWeight: '700', color: colors.ink },
  periodRange: { fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: fonts.body },
  periodPrev: { fontSize: 10.5, color: colors.muted, marginTop: 3, fontFamily: fonts.bodySemi },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirrored: { transform: [{ scaleX: -1 }] },
  siteRow: { gap: 8, paddingRight: 8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  gridItem: { flexGrow: 1, flexBasis: 320, minWidth: 260, marginBottom: spacing.md },
  metricCard: { marginBottom: 0 },

  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  metricLabel: { flex: 1, fontSize: 12.5, color: colors.steel, fontFamily: fonts.body },
  metricLabelStrong: { color: colors.ink, fontFamily: fonts.bodySemi },
  metricValue: { fontSize: 13.5, color: colors.ink, fontFamily: fonts.bodySemi },
  metricValueStrong: { fontSize: 15, fontFamily: fonts.bodyBold },
  metricTrend: {
    width: 62,
    textAlign: 'right',
    fontSize: 11.5,
    fontFamily: fonts.bodyBold,
  },

  breakdown: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  breakdownHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownTitle: {
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    fontFamily: fonts.bodyBold,
  },
  breakdownTotal: { fontSize: 12.5, color: colors.ink, fontFamily: fonts.bodyBold },
  breakdownEmpty: { fontSize: 11.5, color: colors.muted, fontFamily: fonts.body, paddingVertical: 3 },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 10 },
  subLabel: { flex: 1, fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  subValue: { fontSize: 12, color: colors.ink, fontFamily: fonts.bodySemi },

  workweek: { marginTop: spacing.sm, marginBottom: 30 },
  workweekNote: { fontSize: 11.5, color: colors.muted, lineHeight: 17, fontFamily: fonts.body },
  workweekCurrent: {
    fontSize: 12.5,
    color: colors.ink,
    marginTop: 10,
    fontFamily: fonts.bodySemi,
  },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  dayChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.muted },
  dayTextOn: { color: colors.paper },
});
