/*
 * ORPHANED SCREEN — not reachable from the app's navigation.
 *
 * Payroll settings — overtime rates, deduction defaults, cutoff cadence. The
 * addendum lists this as explicitly web-only.
 *
 * Per HR-ADMIN-MOBILE-ACCESS-ADDENDUM.md (resolved as Option A in
 * ADDENDA-PROPOSAL.md), HR/Admin's mobile surface is now exactly three
 * single-decision actions plus Notifications and Profile. This screen belongs
 * to the full HR/Admin surface, which lives on the web dashboard — so nothing
 * in the tab bar or any link points at it any more.
 *
 * It is kept, unwired, as a starting point for that separate web dashboard.
 * As written it CANNOT WORK on mobile: it queries `waa_payroll_settings`, `waa_deduction_types` and `waa_worker_leave_pay_types` directly, and
 * HR/Admin's direct-table RLS grants on those were revoked. Rebuilding it for
 * the web means rewiring every query here onto purpose-built edge functions
 * first.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useHrAdmin } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import {
  fetchDeductionTypes,
  fetchPayrollSettings,
  updatePayrollSettings,
} from '../../src/lib/queries';
import type { CutoffType } from '../../src/lib/types';
import { ScreenBody } from '../../src/components/Screen';
import {
  Card,
  ErrorNote,
  Field,
  Loader,
  Pill,
  PrimaryButton,
  Section,
} from '../../src/components/ui';
import { colors, fonts, radius, spacing, type } from '../../src/theme';

const CUTOFFS: { value: CutoffType; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'semi_monthly', label: 'Semi-monthly' },
  { value: 'monthly', label: 'Monthly' },
];

/**
 * Org-wide payroll settings — the singleton `waa_payroll_settings` row.
 *
 * Per-worker settings (rate, leave-pay master switch and per-type overrides,
 * deduction overrides) deliberately live on the worker's own detail screen
 * under Roster rather than here, since they're per-person exceptions to these
 * org-wide baselines rather than settings in their own right.
 */
export default function HrSettings() {
  const hrAdmin = useHrAdmin();
  const [cutoff, setCutoff] = useState<CutoffType>('semi_monthly');
  const [otOrdinary, setOtOrdinary] = useState('');
  const [otRestday, setOtRestday] = useState('');
  const [standardHours, setStandardHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const [settings, deductions] = await Promise.all([
      fetchPayrollSettings(),
      fetchDeductionTypes(),
    ]);
    return { settings, deductions };
  }, [hrAdmin.id]);

  // Seed the form once the row arrives. Percentages are stored as multipliers
  // (1.25 = 125%) but entered the way HR/Admin talks about them.
  useEffect(() => {
    const s2 = data?.settings;
    if (!s2) return;
    setCutoff(s2.cutoff_type);
    setOtOrdinary(String(Math.round(Number(s2.overtime_rate_ordinary) * 100)));
    setOtRestday(String(Math.round(Number(s2.overtime_rate_restday_holiday) * 100)));
    setStandardHours(String(Number(s2.standard_hours_per_day)));
  }, [data?.settings]);

  async function save() {
    if (!data?.settings) return;
    const ord = Number(otOrdinary);
    const rest = Number(otRestday);
    const std = Number(standardHours);

    if (!ord || ord < 100) {
      setError('Ordinary overtime must be at least 100%.');
      return;
    }
    if (!rest || rest < 100) {
      setError('Rest day / holiday overtime must be at least 100%.');
      return;
    }
    if (!std || std <= 0 || std > 24) {
      setError('Standard hours per day must be between 1 and 24.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await updatePayrollSettings(
        data.settings.id,
        {
          cutoff_type: cutoff,
          overtime_rate_ordinary: ord / 100,
          overtime_rate_restday_holiday: rest / 100,
          standard_hours_per_day: std,
        },
        hrAdmin.id
      );
      await reload();
      Alert.alert('Saved', 'These settings apply to every run generated from now on.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the settings.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <ScreenBody>
        <Loader label="Loading settings" />
      </ScreenBody>
    );
  }

  return (
    <ScreenBody refreshing={loading} onRefresh={reload}>
      <Section title="Cutoff cadence">
        {error ? <ErrorNote message={error} /> : null}
        <Card>
          <Text style={type.cardSub}>
            One org-wide cadence, not per site. Changing this affects the default period the run
            generator suggests and the window the worker's running estimate covers.
          </Text>
          <View style={s.chipRow}>
            {CUTOFFS.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => setCutoff(c.value)}
                style={[s.chip, cutoff === c.value && s.chipActive]}
              >
                <Text style={[s.chipText, cutoff === c.value && s.chipTextActive]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </Section>

      <Section title="Overtime and shift length">
        <Card style={{ padding: spacing.xl }}>
          <Field
            label="Ordinary overtime (%)"
            value={otOrdinary}
            onChangeText={setOtOrdinary}
            keyboardType="numeric"
            placeholder="125"
            hint="Applied to every hour past the standard day. Counted per day, not across the week."
          />
          <Field
            label="Rest day / holiday overtime (%)"
            value={otRestday}
            onChangeText={setOtRestday}
            keyboardType="numeric"
            placeholder="130"
            hint="Stored, but not yet applied — WAA has no rest-day or holiday calendar, so the payroll engine currently uses the ordinary rate for all overtime."
          />
          <Field
            label="Standard hours per day"
            value={standardHours}
            onChangeText={setStandardHours}
            keyboardType="numeric"
            placeholder="8"
            hint="Anything logged beyond this in a single day counts as overtime."
          />
          <PrimaryButton label={busy ? 'Saving…' : 'Save settings'} onPress={save} loading={busy} />
        </Card>
      </Section>

      <Section title="Deduction defaults">
        <Card>
          <Text style={type.cardSub}>
            The org-wide on/off default for each statutory deduction. Override any of these for one
            worker from their profile under Roster — that override persists across periods.
          </Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            {(data?.deductions ?? []).map((d) => (
              <View key={d.id} style={s.deductionRow}>
                <Text style={s.deductionName}>{d.name}</Text>
                <Pill
                  label={d.active_by_default ? 'On' : 'Off'}
                  tone={d.active_by_default ? 'ok' : 'muted'}
                />
              </View>
            ))}
          </View>
          <Text style={s.note}>
            These defaults are read-only in the app: `waa_deduction_types` has no HR/Admin UPDATE
            policy in the deployed schema, so a toggle here would be rejected by the database.
            Per-worker overrides are fully editable and cover the same ground.
          </Text>
        </Card>
      </Section>

      <Section title="Deduction amounts">
        <Card>
          <Text style={type.cardSub}>
            Amounts are flat illustrative pesos hardcoded in the payroll engine — SSS ₱250,
            Pag-IBIG ₱100, PhilHealth ₱150, Withholding Tax ₱0. Real contribution-table lookups are
            a later pass; do not treat these as correct figures.
          </Text>
        </Card>
      </Section>
    </ScreenBody>
  );
}

const s = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontFamily: fonts.bodySemi, color: colors.muted },
  chipTextActive: { color: colors.paper },
  deductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  deductionName: { fontSize: 13, fontFamily: fonts.bodySemi, color: colors.ink },
  note: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 12,
    fontFamily: fonts.body,
  },
});
