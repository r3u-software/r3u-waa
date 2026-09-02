/*
 * Payroll settings — overtime rates, deduction defaults, cutoff cadence. The
 * addendum lists this as explicitly web-only.
 *
 * Data layer: `waa_payroll_settings` reads through its own per-company SELECT
 * policy; the write goes through `waa-hr-settings`'s `update_settings`
 * action, and `waa_deduction_types` reads through that same function's
 * `get_deduction_types` action. Chrome is `WebShell`
 * (R3U-WAA-WEB-REDESIGN.md), replacing `ScreenBody` + `HrDashboardNav`; the
 * form fields below still come from `ui.tsx` (`Card`/`Field`/`PrimaryButton`)
 * since those are self-contained white cards that read fine on the glass
 * canvas — only the cutoff chips and section titles needed a theme-aware
 * swap, same as every other screen in this pass.
 *
 * Correction found while wiring this up originally: the "Deduction amounts"
 * section below used to claim these are flat hardcoded pesos in the payroll
 * engine. Checked the live `waa-generate-payroll-run` source — that was
 * stale. Amounts come from `waa_deduction_types.default_amount`, a real
 * per-company column, editable data, not a hardcoded map. Corrected below.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useHrAdmin } from '../../src/lib/session';
import { useAsync } from '../../src/lib/useAsync';
import {
  fetchDeductionTypes,
  fetchPayrollSettings,
  updatePayrollSettings,
} from '../../src/lib/queries';
import type { CutoffType } from '../../src/lib/types';
import { Card, Field, Pill } from '../../src/components/ui';
import { colors, type as textType } from '../../src/theme';
import { WebShell } from '../../src/web/WebShell';
import { useWebTheme } from '../../src/web/webTheme';
import { Chip, GlassButton, WebPageHeader, WebSection } from '../../src/web/webUi';

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
  const { palette } = useWebTheme();
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

  return (
    <WebShell active="settings" title="Settings" subtitle="Org-wide payroll rules">
      <WebPageHeader eyebrow="System" title="Payroll settings" sub="Cutoff cadence, overtime rates, and deduction defaults for the whole company." />

      {loading && !data ? (
        <Text style={{ color: palette.muted }}>Loading settings…</Text>
      ) : (
        <>
          {error ? (
            <View style={{ backgroundColor: palette.badBg, borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: palette.bad, fontSize: 12.5, lineHeight: 18, fontWeight: '600' }}>{error}</Text>
            </View>
          ) : null}

          <WebSection title="Cutoff cadence">
            <Card>
              <Text style={textType.cardSub}>
                One org-wide cadence, not per site. Changing this affects the default period the run
                generator suggests and the window the worker's running estimate covers.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {CUTOFFS.map((c) => (
                  <Chip key={c.value} label={c.label} active={cutoff === c.value} onPress={() => setCutoff(c.value)} />
                ))}
              </View>
            </Card>
          </WebSection>

          <WebSection title="Overtime and shift length">
            <Card style={{ padding: 20 }}>
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
              <GlassButton label={busy ? 'Saving…' : 'Save settings'} onPress={save} loading={busy} />
            </Card>
          </WebSection>

          <WebSection title="Deduction defaults">
            <Card>
              <Text style={textType.cardSub}>
                The org-wide on/off default for each statutory deduction. Override any of these for one
                worker from their profile under Roster — that override persists across periods.
              </Text>
              <View style={{ marginTop: 12, gap: 8 }}>
                {(data?.deductions ?? []).map((d) => (
                  <View
                    key={d.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.line,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{d.name}</Text>
                    <Pill label={d.active_by_default ? 'On' : 'Off'} tone={d.active_by_default ? 'ok' : 'muted'} />
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.muted, lineHeight: 16, marginTop: 12 }}>
                These defaults are read-only here for now — no write action for them was built in this
                pass, this screen only reads them. Per-worker overrides are fully editable via each
                worker's own profile and cover the same ground.
              </Text>
            </Card>
          </WebSection>

          <WebSection title="Deduction amounts" style={{ marginBottom: 36 }}>
            <Card>
              <Text style={textType.cardSub}>
                Each amount comes from this company's own `waa_deduction_types.default_amount` — real,
                editable per-company data, not a hardcoded map. Values are still illustrative pesos
                (SSS, Pag-IBIG, PhilHealth, Withholding Tax) rather than a real contribution-table
                lookup; do not treat them as legally correct figures yet.
              </Text>
            </Card>
          </WebSection>
        </>
      )}
    </WebShell>
  );
}
